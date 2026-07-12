// THE CYANOTYPE NETWORK · auth.js — sign in / sign up / reset
const Auth = {

  render(view, mode = "signin") {
    const isUp = mode === "signup";
    view.innerHTML = "";
    view.appendChild(el(`
      <div class="auth-wrap">
        <h1>${isUp ? "Join the Network" : "Welcome back"}</h1>
        <div class="page-sub">${isUp
          ? "Post your prints, log field reports, collect the work you love."
          : "Sign in to see the feed."}</div>
        <div class="msg" id="authMsg"></div>
        <form class="form" style="padding:0" id="authForm">
          ${isUp ? `
          <label for="a-name">Display name</label>
          <input id="a-name" type="text" autocomplete="nickname" maxlength="40" required
                 placeholder="How your name appears on prints">` : ""}
          <label for="a-email">Email</label>
          <input id="a-email" type="email" autocomplete="email" required placeholder="you@example.com">
          <label for="a-pass">Password</label>
          <input id="a-pass" type="password" autocomplete="${isUp ? "new-password" : "current-password"}"
                 minlength="8" required placeholder="${isUp ? "At least 8 characters" : "Your password"}">
          <div class="form-foot">
            <button class="btn" type="submit" style="width:100%">
              ${isUp ? "Create account" : "Sign in"}</button>
          </div>
        </form>
        <div class="auth-toggle">
          ${isUp
            ? `Already have an account? <button id="swap">Sign in</button>`
            : `New here? <button id="swap">Create an account</button>
               · <button id="forgot">Forgot password</button>`}
        </div>
      </div>`));

    view.querySelector("#swap").onclick = () => Auth.render(view, isUp ? "signin" : "signup");
    const forgot = view.querySelector("#forgot");
    if (forgot) forgot.onclick = () => Auth.forgot(view);

    view.querySelector("#authForm").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      const email = view.querySelector("#a-email").value.trim();
      const password = view.querySelector("#a-pass").value;
      let error;
      if (isUp) {
        const display_name = view.querySelector("#a-name").value.trim();
        ({ error } = await sb.auth.signUp({
          email, password, options: { data: { display_name } }
        }));
        if (!error) {
          Auth.msg(view, "ok", "Account created. Check your email to confirm, then sign in.");
          btn.disabled = false;
          return;
        }
      } else {
        ({ error } = await sb.auth.signInWithPassword({ email, password }));
      }
      if (error) { Auth.msg(view, "err", error.message); btn.disabled = false; }
      // success: onAuthStateChange routes to the feed
    };
  },

  async forgot(view) {
    const email = view.querySelector("#a-email").value.trim();
    if (!email) return Auth.msg(view, "err", "Enter your email above first, then tap Forgot password.");
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname
    });
    Auth.msg(view, error ? "err" : "ok",
      error ? error.message : "Reset link sent — check your email.");
  },

  msg(view, kind, text) {
    const m = view.querySelector("#authMsg");
    m.className = "msg " + kind;
    m.textContent = text;
  },

  async signOut() { await sb.auth.signOut(); }
};
