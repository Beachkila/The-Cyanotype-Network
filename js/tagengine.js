// Artist tag engine — shared by Small Works and The Cyanotype Network tag makers.
// Draws a folding tag as two separate panels: the front, and the back signature panel.
// Both are upright; the print template flips the back so it reads correctly once folded.
const TagEngine = (() => {
  const W = 5600;          // same width as the Beach-Tag
  const FACE_H = 1600;     // each panel is 3.5 : 1

  // Frame geometry (inside each panel)
  const PAD_X = 130, PAD_TOP = 110, PAD_BOTTOM = 170;
  const FACE = { x: PAD_X, y: PAD_TOP, w: W - PAD_X * 2, h: FACE_H - PAD_TOP - PAD_BOTTOM, r: 30 };

  const SANS = "Oswald, 'Arial Narrow', Arial, sans-serif";
  const PLAIN = "Arial, Helvetica, sans-serif";
  const SERIF = "'Libre Baskerville', Georgia, 'Times New Roman', serif";

  async function loadFonts() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.all([
        document.fonts.load(`500 100px Oswald`),
        document.fonts.load(`700 100px Oswald`),
        document.fonts.load(`400 100px 'Libre Baskerville'`),
        document.fonts.load(`italic 400 100px 'Libre Baskerville'`),
        document.fonts.load(`700 100px 'Libre Baskerville'`),
      ]);
    } catch (e) { /* fall back to system fonts */ }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function setSpacing(ctx, px) {
    if ("letterSpacing" in ctx) ctx.letterSpacing = px + "px";
  }

  // Largest font size (<= size) that keeps text within maxWidth.
  function fit(ctx, text, font, size, maxWidth, spacing = 0) {
    let s = size;
    for (let i = 0; i < 40; i++) {
      ctx.font = font(s);
      setSpacing(ctx, spacing * s);
      if (!text || ctx.measureText(text).width <= maxWidth) break;
      s = Math.floor(s * 0.95);
    }
    return s;
  }

  function text(ctx, str, x, y, font, color, align = "left", spacing = 0) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    setSpacing(ctx, spacing);
    ctx.fillText(str || "", x, y);
    setSpacing(ctx, 0);
  }

  function qrMatrix(link) {
    if (!link || typeof qrcode !== "function") return null;
    try {
      if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs["UTF-8"]) {
        qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
      }
      const q = qrcode(0, "M");
      q.addData(link);
      q.make();
      return q;
    } catch (e) {
      return null; // link too long for a QR code
    }
  }

  function drawQR(ctx, q, x, y, size, color) {
    const n = q.getModuleCount();
    const cell = size / n;
    ctx.fillStyle = color;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (q.isDark(r, c)) {
          ctx.fillRect(Math.floor(x + c * cell), Math.floor(y + r * cell), Math.ceil(cell), Math.ceil(cell));
        }
      }
    }
  }

  function drawPanel(ctx, c) {
    // square outer corners: the frame runs to the edge for trimming
    ctx.fillStyle = c.frame;
    ctx.fillRect(0, 0, W, FACE_H);
    ctx.fillStyle = c.face;
    roundRect(ctx, FACE.x, FACE.y, FACE.w, FACE.h, FACE.r);
    ctx.fill();
  }

  function drawTab(ctx, c, brand) {
    const tw = 1200, th = 230;
    const tx = (W - tw) / 2, ty = FACE_H - th;
    ctx.fillStyle = c.tabBg;
    roundRect(ctx, tx, ty, tw, th + 30, 24);
    ctx.fill();
    text(ctx, brand.top, W / 2, ty + 80, `400 62px ${SERIF}`, c.tabInk, "center", 6);
    const s = fit(ctx, brand.bottom, (px) => `700 ${px}px ${SERIF}`, 118, tw - 120, 0.04);
    text(ctx, brand.bottom, W / 2, ty + 80 + s * 0.98, `700 ${s}px ${SERIF}`, c.tabInk, "center", s * 0.04);
  }

  const up = (s) => (s || "").toUpperCase();

  // ---------- Front layouts ----------
  function frontSlab(ctx, d, c, q) {
    const left = FACE.x + 110;
    const right = FACE.x + FACE.w - 110;
    const top = FACE.y + 70;
    const qrSize = q ? 600 : 0;
    const rightCol = q ? right - qrSize - 110 : right;

    // right column
    const edSize = fit(ctx, up(d.edition), (px) => `${px}px ${PLAIN}`, 230, 1100);
    const yrSize = fit(ctx, up(d.year), (px) => `${px}px ${PLAIN}`, 230, 1100);
    ctx.font = `${edSize}px ${PLAIN}`; const edW = ctx.measureText(up(d.edition)).width;
    ctx.font = `${yrSize}px ${PLAIN}`; const yrW = ctx.measureText(up(d.year)).width;
    const rightW = Math.max(edW, yrW);
    text(ctx, up(d.edition), rightCol, top + 200, `${edSize}px ${PLAIN}`, c.ink, "right");
    text(ctx, up(d.year), rightCol, top + 470, `${yrSize}px ${PLAIN}`, c.ink, "right");

    // left column
    const maxW = rightCol - rightW - 160 - left;
    const t = up(d.title), by = d.artist ? "BY: " + up(d.artist) : "";
    const big = Math.min(
      fit(ctx, t, (px) => `${px}px ${PLAIN}`, 230, maxW),
      fit(ctx, by, (px) => `${px}px ${PLAIN}`, 230, maxW));
    text(ctx, t, left, top + 200, `${big}px ${PLAIN}`, c.ink);
    text(ctx, by, left, top + 470, `${big}px ${PLAIN}`, c.ink);
    const med = [up(d.medium), up(d.size)].filter(Boolean).join(" · ");
    const medSize = fit(ctx, med, (px) => `${px}px ${PLAIN}`, 140, maxW);
    text(ctx, med, left, top + 700, `${medSize}px ${PLAIN}`, c.soft);

    if (q) drawQR(ctx, q, right - qrSize, top + 20, qrSize, c.ink);
  }

  function frontMuseum(ctx, d, c, q) {
    const left = FACE.x + 120;
    const right = FACE.x + FACE.w - 120;
    const qrSize = q ? 600 : 0;
    const midY = FACE.y + FACE.h / 2 - 40;

    // edition block on the right
    const edBlockRight = q ? right - qrSize - 140 : right;
    const edSize = fit(ctx, d.edition, (px) => `400 ${px}px ${SERIF}`, 220, 1000);
    ctx.font = `400 ${edSize}px ${SERIF}`;
    const edW = Math.max(ctx.measureText(d.edition || "").width, 420);
    const edCx = edBlockRight - edW / 2;
    if (d.edition) {
      text(ctx, "EDITION", edCx, midY - 120, `400 60px ${SERIF}`, c.soft, "center", 18);
      text(ctx, d.edition, edCx, midY + 140, `400 ${edSize}px ${SERIF}`, c.ink, "center");
    }

    const maxW = edCx - edW / 2 - 200 - left;
    const tSize = fit(ctx, d.title, (px) => `italic 400 ${px}px ${SERIF}`, 230, maxW);
    text(ctx, d.title, left, midY - 60, `italic 400 ${tSize}px ${SERIF}`, c.ink);
    const by = [d.artist, d.year].filter(Boolean).join(", ");
    const bySize = fit(ctx, by, (px) => `400 ${px}px ${SERIF}`, 125, maxW);
    text(ctx, by, left, midY + 130, `400 ${bySize}px ${SERIF}`, c.ink);
    ctx.fillStyle = c.line;
    ctx.fillRect(left, midY + 210, Math.min(maxW, 3300), 10);
    const med = [d.medium, d.size].filter(Boolean).join("  ·  ");
    const medSize = fit(ctx, med, (px) => `400 ${px}px ${SERIF}`, 92, maxW, 0.04);
    text(ctx, med, left, midY + 360, `400 ${medSize}px ${SERIF}`, c.soft, "left", medSize * 0.04);

    if (q) drawQR(ctx, q, right - qrSize, FACE.y + (FACE.h - qrSize) / 2 - 40, qrSize, c.ink);
  }

  function frontLedger(ctx, d, c, q) {
    const bandW = 1300;
    ctx.save();
    roundRect(ctx, FACE.x, FACE.y, FACE.w, FACE.h, FACE.r);
    ctx.clip();
    ctx.fillStyle = c.band;
    ctx.fillRect(FACE.x, FACE.y, bandW, FACE.h);
    ctx.restore();

    const bx = FACE.x + 120;
    const midY = FACE.y + FACE.h / 2 - 40;
    if (d.edition) text(ctx, "EDITION", bx, midY - 230, `500 76px ${SANS}`, c.bandInk, "left", 14);
    const edSize = fit(ctx, up(d.edition), (px) => `700 ${px}px ${SANS}`, 400, bandW - 240);
    text(ctx, up(d.edition), bx, midY + 130, `700 ${edSize}px ${SANS}`, c.bandInk);
    text(ctx, up(d.year), bx, midY + 300, `500 130px ${SANS}`, c.bandInk, "left", 12);

    const qrSize = q ? 600 : 0;
    const right = FACE.x + FACE.w - 120;
    const left = FACE.x + bandW + 140;
    const maxW = (q ? right - qrSize - 140 : right) - left;
    const t = up(d.title);
    const tSize = fit(ctx, t, (px) => `700 ${px}px ${SANS}`, 320, maxW);
    text(ctx, t, left, midY - 30, `700 ${tSize}px ${SANS}`, c.ink);
    const by = d.artist ? "BY " + up(d.artist) : "";
    const bySize = fit(ctx, by, (px) => `500 ${px}px ${SANS}`, 160, maxW);
    text(ctx, by, left, midY + 170, `500 ${bySize}px ${SANS}`, c.ink);
    const med = [up(d.medium), up(d.size)].filter(Boolean).join(" · ");
    const medSize = fit(ctx, med, (px) => `500 ${px}px ${SANS}`, 105, maxW, 0.03);
    text(ctx, med, left, midY + 330, `500 ${medSize}px ${SANS}`, c.soft, "left", medSize * 0.03);

    if (q) drawQR(ctx, q, right - qrSize, FACE.y + (FACE.h - qrSize) / 2 - 40, qrSize, c.ink);
  }

  // ---------- Back (signature) panel ----------
  function back(ctx, d, c, layout) {
    const nameFont = layout === "museum" ? (px) => `400 ${px}px ${SERIF}` : (px) => `700 ${px}px ${SANS}`;
    const left = FACE.x + 220, right = FACE.x + FACE.w - 220;
    const sigY = FACE.y + 560;
    ctx.fillStyle = c.ink;
    ctx.fillRect(left, sigY, right - left, 12);
    text(ctx, "ARTIST SIGNATURE", left, sigY + 110, `500 66px ${SANS}`, c.soft, "left", 16);

    const name = layout === "museum" ? (d.artist || "") : up(d.artist);
    const nSize = fit(ctx, name, nameFont, 150, right - left);
    text(ctx, name, left, sigY + 380, nameFont(nSize), c.ink);
    ctx.fillStyle = c.line;
    ctx.fillRect(left, sigY + 420, right - left, 6);
    const meta = ["PRINTED NAME", up(d.edition), up(d.year)].filter(Boolean).join("  ·  ");
    text(ctx, meta, left, sigY + 520, `500 66px ${SANS}`, c.soft, "left", 16);
  }

  // ---------- Public API ----------
  // scale < 1 draws a smaller copy (e.g. for the feed); drawing coordinates stay the same.
  function setup(canvas, scale = 1) {
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(FACE_H * scale);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, FACE_H);
    return ctx;
  }

  function drawFront(ctx, data, color, layout, brand, q) {
    drawPanel(ctx, color);
    if (layout === "museum") frontMuseum(ctx, data, color, q);
    else if (layout === "ledger") frontLedger(ctx, data, color, q);
    else frontSlab(ctx, data, color, q);
    drawTab(ctx, color, brand);
  }

  // Front only, at any scale (used by the Network feed and upload preview).
  function renderFront(canvas, data, color, layout, brand, scale = 1) {
    const q = data.qr ? qrMatrix(data.qr) : null;
    drawFront(setup(canvas, scale), data, color, layout, brand, q);
  }

  // Draws the front onto frontCanvas and the back onto backCanvas.
  async function render(frontCanvas, backCanvas, data, color, layout, brand) {
    const q = data.qr ? qrMatrix(data.qr) : null;

    const f = setup(frontCanvas);
    drawFront(f, data, color, layout, brand, q);

    // back, upright: the print template flips it so it reads correctly once folded
    const k = setup(backCanvas);
    drawPanel(k, color);
    back(k, data, color, layout);

    return { qrOk: !data.qr || !!q };
  }

  // Thumbnail of the front panel only, for the log.
  function thumbnail(canvas, width = 400) {
    const h = Math.round(width * FACE_H / W);
    const t = document.createElement("canvas");
    t.width = width;
    t.height = h;
    t.getContext("2d").drawImage(canvas, 0, 0, width, h);
    return t.toDataURL("image/jpeg", 0.75);
  }

  return { render, renderFront, thumbnail, loadFonts };
})();
