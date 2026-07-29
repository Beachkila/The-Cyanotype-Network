// THE CYANOTYPE NETWORK · gallerybench.js — Gallery Bench (embedded tool)
// Loads the self-contained tool page in an isolated iframe so its styles/scripts
// never collide with the app shell. The tool hides its own masthead when framed.
const GalleryBench = {
  _off: null,
  render(view) {
    if (GalleryBench._off) { GalleryBench._off(); GalleryBench._off = null; }
    view.innerHTML =
      '<iframe id="galleryFrame" title="Gallery Bench" src="gallerybench.html" ' +
      'style="display:block;width:100vw;position:relative;left:50%;transform:translateX(-50%);' +
      'border:0;background:transparent"></iframe>';
    const frame = view.querySelector('#galleryFrame');
    const fit = () => {
      const top = frame.getBoundingClientRect().top;
      frame.style.height = Math.max(480, Math.round(window.innerHeight - top - 16)) + 'px';
    };
    fit(); setTimeout(fit, 120);
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    GalleryBench._off = () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }
};
