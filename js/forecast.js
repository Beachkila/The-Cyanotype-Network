// THE CYANOTYPE NETWORK · forecast.js — SUNPRINT integration (stage 5)
// Open-Meteo forecast + geocoding, saved location (city-level, in notif_prefs),
// adjustable exposure timer that hands off to a pre-filled field report.
const Forecast = {

  BANDS: [
    { max: 2,  label: "LOW",       range: "30–60 min", def: 45 },
    { max: 5,  label: "MODERATE",  range: "20–45 min", def: 30 },
    { max: 7,  label: "HIGH",      range: "10–15 min", def: 12 },
    { max: 10, label: "VERY HIGH", range: "6–10 min",  def: 8  },
    { max: 99, label: "EXTREME",   range: "4–7 min",   def: 5  }
  ],
  band(uvi) { return Forecast.BANDS.find(b => uvi <= b.max); },

  timerMin: null,
  _interval: null,

  async savedLocation() {
    const { data } = await sb.from("notif_prefs")
      .select("saved_location").eq("user_id", DB.uid()).maybeSingle();
    if (!data?.saved_location) return null;
    const [label, coords] = data.saved_location.split("|");
    const [lat, lon] = (coords || "").split(",").map(Number);
    return (label && isFinite(lat) && isFinite(lon)) ? { label, lat, lon } : null;
  },

  async saveLocation(loc) {
    await sb.from("notif_prefs").upsert({
      user_id: DB.uid(),
      saved_location: `${loc.label}|${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`
    });
  },

  async render(view) {
    Forecast.stopTimer();
    view.innerHTML = `<div class="empty">Loading forecast…</div>`;
    const loc = await Forecast.savedLocation();
    if (!loc) return Forecast.picker(view);

    let fc;
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=uv_index_max&timezone=auto&forecast_days=7`);
      fc = await r.json();
      if (!fc?.daily?.uv_index_max) throw new Error();
    } catch {
      view.innerHTML = `<div class="empty">Couldn't reach the forecast service. Check your connection and try again.</div>`;
      return;
    }

    const days = fc.daily.time.map((t, i) => ({
      date: new Date(t + "T12:00"),
      uvi: Math.round(fc.daily.uv_index_max[i] ?? 0)
    }));

    view.innerHTML = "";
    view.appendChild(el(`
      <div>
        <div class="page-head">
          <div><h1>Forecast</h1>
          <div class="page-sub">SUNPRINT · ${new Date().toLocaleDateString(undefined,{weekday:"short",month:"long",day:"numeric"})}</div></div>
          <button class="btn secondary" id="locBtn">${esc(loc.label)} ▾</button>
        </div>
        <div class="fc-body">
          <div class="fc-now" id="fcNow"></div>
          <div class="fc-strip" id="fcStrip" role="tablist" aria-label="7-day UV forecast"></div>
          <div class="page-sub" style="margin-bottom:16px">Daily peak UVI · tap a day</div>
          <div id="fcTimer"></div>
          <table class="report" style="margin-top:22px">
            <caption>UV INDEX → EXPOSURE (from the Almanac)</caption>
            <tr><td>UVI 0–2 · low</td><td>30–60 min</td></tr>
            <tr><td>UVI 3–5 · moderate</td><td>20–45 min</td></tr>
            <tr><td>UVI 6–7 · high</td><td>10–15 min</td></tr>
            <tr><td>UVI 8–10 · very high</td><td>6–10 min</td></tr>
            <tr><td>UVI 11+ · extreme</td><td>4–7 min</td></tr>
          </table>
          <div class="page-sub">Starting points for classic-formula contact prints in direct sun. Always run a test strip.</div>
        </div>
      </div>`));

    view.querySelector("#locBtn").onclick = () => Forecast.picker(view);

    const strip = view.querySelector("#fcStrip");
    days.forEach((d, i) => {
      const cell = el(`
        <button class="fc-day ${i === 0 ? "sel" : ""}" role="tab" aria-selected="${i === 0}">
          <span class="fc-dow">${d.date.toLocaleDateString(undefined,{weekday:"short"}).toUpperCase()}</span>
          <span class="fc-uvi">${d.uvi}</span>
        </button>`);
      cell.onclick = () => {
        strip.querySelectorAll(".fc-day").forEach(c => { c.classList.remove("sel"); c.setAttribute("aria-selected","false"); });
        cell.classList.add("sel"); cell.setAttribute("aria-selected","true");
        Forecast.showDay(view, d, i === 0);
      };
      strip.appendChild(cell);
    });
    Forecast.showDay(view, days[0], true);
  },

  showDay(view, d, isToday) {
    const b = Forecast.band(d.uvi);
    Forecast.timerMin = b.def;
    view.querySelector("#fcNow").innerHTML = `
      <div class="fc-big">${d.uvi}</div>
      <div>
        <div style="font-size:15px; font-weight:700">${b.label} ·
          ${isToday ? "today" : d.date.toLocaleDateString(undefined,{weekday:"long"})}</div>
        <div class="page-sub">Suggested exposure: <b style="color:var(--ink)">${b.range}</b> · classic formula, direct sun</div>
      </div>`;

    const t = view.querySelector("#fcTimer");
    if (!isToday) {
      t.innerHTML = `<div class="form-note">The exposure timer runs on today's forecast — switch back to today to start a print.</div>`;
      return;
    }
    t.innerHTML = "";
    t.appendChild(el(`
      <div>
        <div class="fc-timer-row">
          <button class="btn secondary" id="tMinus" aria-label="One minute less">−</button>
          <button class="btn" id="tStart">Start a print · <span id="tLabel">${Forecast.timerMin}</span> min timer</button>
          <button class="btn secondary" id="tPlus" aria-label="One minute more">+</button>
        </div>
        <div class="form-note" style="margin-top:10px">Suggested from today's UVI — adjust for your paper, formula, or shade.</div>
      </div>`));
    const label = t.querySelector("#tLabel");
    t.querySelector("#tMinus").onclick = () => { Forecast.timerMin = Math.max(1, Forecast.timerMin - 1); label.textContent = Forecast.timerMin; };
    t.querySelector("#tPlus").onclick  = () => { Forecast.timerMin = Math.min(90, Forecast.timerMin + 1); label.textContent = Forecast.timerMin; };
    t.querySelector("#tStart").onclick = () => Forecast.runTimer(t, d.uvi, Forecast.timerMin);
  },

  runTimer(box, uvi, minutes) {
    Forecast.stopTimer();
    let remaining = minutes * 60;
    box.innerHTML = "";
    box.appendChild(el(`
      <div class="fc-running">
        <div class="fc-count" id="tCount" role="timer" aria-live="off"></div>
        <div class="page-sub">Exposing at UVI ${uvi} · keep this tab open</div>
        <div class="form-foot">
          <button class="btn" id="tDone">Done early — log it</button>
          <button class="btn secondary" id="tCancel">Cancel</button>
        </div>
      </div>`));
    const count = box.querySelector("#tCount");
    const started = Date.now();
    const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    const tick = () => {
      remaining = minutes * 60 - Math.floor((Date.now() - started) / 1000);
      if (remaining <= 0) {
        Forecast.stopTimer();
        document.title = "Time! · The Cyanotype Network";
        Forecast.handoff(uvi, minutes);
        return;
      }
      count.textContent = fmt(remaining);
      document.title = fmt(remaining) + " · exposing";
    };
    tick();
    Forecast._interval = setInterval(tick, 500);
    box.querySelector("#tCancel").onclick = () => { Forecast.stopTimer(); Router.handle(); };
    box.querySelector("#tDone").onclick = () => {
      const mins = Math.max(1, Math.round((Date.now() - started) / 60000 * 10) / 10);
      Forecast.stopTimer();
      Forecast.handoff(uvi, mins);
    };
  },

  stopTimer() {
    if (Forecast._interval) clearInterval(Forecast._interval);
    Forecast._interval = null;
    document.title = "The Cyanotype Network";
  },

  handoff(uvi, minutes) {
    sessionStorage.setItem("tcn_prefill", JSON.stringify({
      uvi: String(uvi),
      exposure: `${minutes} minutes, direct sun`
    }));
    Router.go("upload");
  },

  // ---------- location picker ----------
  picker(view) {
    view.innerHTML = "";
    view.appendChild(el(`
      <div>
        <div class="page-head"><div><h1>Set your location</h1>
        <div class="page-sub">Saved to your account, city-level only — used for the UV forecast.</div></div></div>
        <div class="form">
          <label for="locSearch">Search for a city</label>
          <input id="locSearch" type="text" placeholder="e.g. Los Angeles" autocomplete="off">
          <div id="locResults"></div>
          <div class="form-foot">
            <button class="btn secondary" id="locDevice">Use my current location</button>
          </div>
          <div class="msg" id="locMsg"></div>
        </div>
      </div>`));

    const results = view.querySelector("#locResults");
    const input = view.querySelector("#locSearch");
    let timer;
    input.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = input.value.trim();
        if (q.length < 2) { results.innerHTML = ""; return; }
        try {
          const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en`);
          const j = await r.json();
          results.innerHTML = "";
          (j.results || []).forEach(g => {
            const label = [g.name, g.admin1, g.country_code].filter(Boolean).join(", ");
            const b = el(`<button type="button" class="act" style="display:flex; width:100%">${esc(label)}</button>`);
            b.onclick = async () => {
              await Forecast.saveLocation({ label: `${g.name}${g.admin1 ? ", " + g.admin1 : ""}`, lat: g.latitude, lon: g.longitude });
              Forecast.render(view);
            };
            results.appendChild(b);
          });
          if (!(j.results || []).length) results.innerHTML = `<div class="form-note">No matches.</div>`;
        } catch { results.innerHTML = `<div class="form-note">Search failed — try again.</div>`; }
      }, 350);
    };

    view.querySelector("#locDevice").onclick = () => {
      const msg = view.querySelector("#locMsg");
      if (!navigator.geolocation) { msg.className = "msg err"; msg.textContent = "This device doesn't share location."; return; }
      navigator.geolocation.getCurrentPosition(async pos => {
        await Forecast.saveLocation({
          label: "My location",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        });
        Forecast.render(view);
      }, () => { msg.className = "msg err"; msg.textContent = "Location permission was declined — search for your city instead."; });
    };
  }
};
