// THE CYANOTYPE NETWORK · router.js — hash routes + login gate (stage 4)
const Router = {
  view: null,

  routes: {
    feed:      (v)      => Feed.render(v),
    forecast:  (v)      => Forecast.render(v),
    print:     (v, arg) => Feed.detail(v, arg),
    mine:      (v)      => Mine.render(v),
    upload:    (v)      => Mine.uploadForm(v),
    edit:      (v, arg) => Mine.uploadForm(v, arg),
    collected: (v)      => Collected.render(v),
    account:   (v)      => Mine.account(v),
  },

  go(route) { location.hash = "#/" + route; },

  current() {
    const h = location.hash.replace(/^#\/?/, "");
    const [name, arg] = h.split("/");
    return { name: name || "feed", arg };
  },

  async handle() {
    const { name, arg } = Router.current();
    if (!DB.session) {
      Router.safe(() => Shell.signedOut());
      Router.safe(() => ToolHost.reset());
      Auth.render(Router.view);
      return;
    }
    Router.safe(() => Shell.signedIn());
    const tool = ToolHost.isTool(name);
    const fn = Router.routes[name] || Router.routes.feed;
    const tab = { print: "feed", upload: "mine", edit: "mine" }[name] || name;
    Router.safe(() => Shell.setActive(tab, name));
    window.scrollTo({ top: 0 });
    // Maker tools stay loaded in the background; everything else renders into #view.
    if (tool) { ToolHost.show(name); return; }
    ToolHost.hide();
    await fn(Router.view, arg);
  },

  onAuthChange() { Router.handle(); },

  // The menus should never be able to stop a page from loading.
  safe(fn) {
    try { fn(); } catch (e) { console.error("Menu error:", e); }
  }
};

window.addEventListener("hashchange", () => Router.handle());
window.addEventListener("DOMContentLoaded", async () => {
  Router.view = document.getElementById("view");
  Router.safe(() => Shell.init());
  await DB.init();
  Router.handle();
});
