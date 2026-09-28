// THE CYANOTYPE NETWORK · enlarger.js — Negative Enlarger (embedded tool)
const Enlarger = {
  _off: null,
  render(view) {
    if (Enlarger._off) { Enlarger._off(); Enlarger._off = null; }
    view.innerHTML =
      '<iframe id="enlargerFrame" title="Negative Enlarger" src="negative-enlarger.html" ' +
      'style="display:block;width:100vw;position:relative;left:50%;transform:translateX(-50%);' +
      'border:0;background:transparent"></iframe>';
    const frame = view.querySelector('#enlargerFrame');
    const fit = () => {
      const top = frame.getBoundingClientRect().top;
      frame.style.height = Math.max(480, Math.round(window.innerHeight - top - 16)) + 'px';
    };
    fit(); setTimeout(fit, 120);
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    Enlarger._off = () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }
};
