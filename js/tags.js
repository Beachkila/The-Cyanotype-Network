// THE CYANOTYPE NETWORK · tags.js — Tag Maker (embedded tool)
// Loads the self-contained tool page in an isolated iframe so its styles/scripts
// never collide with the app shell. The tool hides its own masthead when framed.
const TagMaker = {
  _off: null,
  render(view) {
    if (TagMaker._off) { TagMaker._off(); TagMaker._off = null; }
    view.innerHTML =
      '<iframe id="tagFrame" title="Tag Maker" src="tcntags.html" ' +
      'style="display:block;width:100vw;position:relative;left:50%;transform:translateX(-50%);' +
      'border:0;background:transparent"></iframe>';
    const frame = view.querySelector('#tagFrame');
    const fit = () => {
      const top = frame.getBoundingClientRect().top;
      frame.style.height = Math.max(480, Math.round(window.innerHeight - top - 16)) + 'px';
    };
    fit(); setTimeout(fit, 120);
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    TagMaker._off = () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }
};
