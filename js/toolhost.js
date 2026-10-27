// THE CYANOTYPE NETWORK · toolhost.js — keeps the maker tools loaded
// Each tool is a self-contained page in its own iframe. Frames are created the
// first time a tool is opened and then kept (hidden) while you visit other
// screens, so the image, settings and zoom are still there when you come back.
const ToolHost = {
  V: "12",
  TOOLS: {
    negatives:    { src: "negatives.html",          title: "SoLaT Digital Negatives" },
    cmyk:         { src: "cmyk.html",               title: "CMYK Separation Bench" },
    enlarger:     { src: "negative-enlarger.html",  title: "Negative Enlarger" },
    gallerybench: { src: "gallerybench.html",       title: "Gallery Bench" },
    tags:         { src: "tcntags.html",            title: "Tag Maker" },
  },
  frames: {},
  deck: null,
  current: null,
  _wired: false,

  isTool(name) { return Object.prototype.hasOwnProperty.call(ToolHost.TOOLS, name); },

  ensureDeck() {
    if (ToolHost.deck) return ToolHost.deck;
    const view = document.getElementById("view");
    const deck = document.createElement("div");
    deck.id = "toolDeck";
    deck.className = "tool-deck";
    deck.hidden = true;
    view.parentNode.insertBefore(deck, view.nextSibling);
    ToolHost.deck = deck;
    if (!ToolHost._wired) {
      ToolHost._wired = true;
      const refit = () => ToolHost.fit();
      window.addEventListener("resize", refit);
      window.addEventListener("orientationchange", () => setTimeout(refit, 150));
      if (window.visualViewport) window.visualViewport.addEventListener("resize", refit);
    }
    return deck;
  },

  show(name) {
    const t = ToolHost.TOOLS[name];
    if (!t) return;
    const deck = ToolHost.ensureDeck();
    const view = document.getElementById("view");
    view.hidden = true;
    deck.hidden = false;
    document.body.classList.add("in-tool");
    Object.keys(ToolHost.frames).forEach(k => { ToolHost.frames[k].hidden = (k !== name); });
    let f = ToolHost.frames[name];
    if (!f) {
      f = document.createElement("iframe");
      f.className = "tool-frame";
      f.title = t.title;
      f.src = t.src + "?v=" + ToolHost.V;
      f.setAttribute("allow", "camera; clipboard-read; clipboard-write");
      deck.appendChild(f);
      ToolHost.frames[name] = f;
    }
    ToolHost.current = name;
    ToolHost.fit();
    setTimeout(ToolHost.fit, 120);
  },

  hide() {
    const view = document.getElementById("view");
    if (view) view.hidden = false;
    if (ToolHost.deck) ToolHost.deck.hidden = true;
    document.body.classList.remove("in-tool");
    ToolHost.current = null;
  },

  // Signing out drops every open tool, so the next person starts clean.
  reset() {
    ToolHost.hide();
    Object.keys(ToolHost.frames).forEach(k => ToolHost.frames[k].remove());
    ToolHost.frames = {};
  },

  // The frame fills the space between the header and the phone tab bar.
  fit() {
    if (!ToolHost.deck || ToolHost.deck.hidden) return;
    const top = ToolHost.deck.getBoundingClientRect().top;
    const bar = document.getElementById("tabBar");
    const barH = (bar && !bar.hidden && getComputedStyle(bar).display !== "none") ? bar.offsetHeight : 0;
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const h = Math.max(360, Math.round(vh - top - barH));
    ToolHost.deck.style.height = h + "px";
  }
};
