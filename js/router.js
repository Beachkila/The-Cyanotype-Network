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
    negatives: (v)      => Negatives.render(v),
    cmyk:      (v)      => Separations.render(v),
    account:   (v)      => Mine.account(v),
    gallerybench: (v)   => GalleryBench.render(v),
    tags:      (v)      => TagMaker.render(v),
    enlarger:  (v)      => Enlarger.render(v),
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
      Shell.signedOut();
      Auth.render(Router.view);
      return;
    }
    Shell.signedIn();
    const fn = Router.routes[name] || Router.routes.feed;
    const tab = { print: "feed", upload: "mine", edit: "mine" }[name] || name;
    Shell.setActive(tab, name);
    window.scrollTo({ top: 0 });
    await fn(Router.view, arg);
  },

  onAuthChange() { Router.handle(); }
};

window.addEventListener("hashchange", () => Router.handle());
window.addEventListener("DOMContentLoaded", async () => {
  Router.view = document.getElementById("view");
  Shell.init();
  await DB.init();
  Router.handle();
});
