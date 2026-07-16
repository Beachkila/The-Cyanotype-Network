// THE CYANOTYPE NETWORK · negatives.js — SoLaT Digital Negatives (embedded tool)
// Loads the self-contained tool page in an isolated iframe so its styles/scripts
// never collide with the app shell. The tool hides its own masthead when framed.
const Negatives = {
  render(view) {
    view.innerHTML =
      '<iframe title="SoLaT Digital Negatives" src="negatives.html" ' +
      'style="display:block;width:100%;height:calc(100vh - 150px);' +
      'min-height:620px;border:0;background:transparent"></iframe>';
  }
};
