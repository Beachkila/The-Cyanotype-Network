// THE CYANOTYPE NETWORK · separations.js — Separation Bench (embedded tool)
const Separations = {
  _off: null,
  render(view) {
    if (Separations._off) { Separations._off(); Separations._off = null; }
    view.innerHTML =
      '<iframe id="sepFrame" title="CMYK Separation Bench" src="cmyk.html" ' +
      'style="display:block;width:100vw;position:relative;left:50%;transform:translateX(-50%);' +
      'border:0;background:transparent"></iframe>';
    const frame = view.querySelector('#sepFrame');
    const fit = () => {
      const top = frame.getBoundingClientRect().top;
      frame.style.height = Math.max(480, Math.round(window.innerHeight - top - 16)) + 'px';
    };
    fit(); setTimeout(fit, 120);
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    Separations._off = () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }
};
