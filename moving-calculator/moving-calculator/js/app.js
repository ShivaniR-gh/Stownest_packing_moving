(function () {
  StorageService.ensureSeeded();

  const titles = {
    "/": "Home",
    "/calculator": "Quote Calculator",
    "/orders": "Orders",
    "/items": "Item Master",
    "/vehicles": "Vehicle Master",
    "/routes": "Cities & Lanes",
    "/rates": "Extra Services",
    "/settings": "Settings",
  };

  function parseHash() {
    const raw = (location.hash || "#/").replace(/^#/, "") || "/";
    const [path, query] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    const params = {};
    if (query) {
      query.split("&").forEach((pair) => {
        const [k, v] = pair.split("=");
        params[decodeURIComponent(k)] = decodeURIComponent(v || "");
      });
    }
    return { path: "/" + (parts[0] || ""), parts, params };
  }

  function setActive(path) {
    document.querySelectorAll("#mainNav a").forEach((a) => {
      const href = a.getAttribute("href").replace(/^#/, "") || "/";
      a.classList.toggle("active", href === path || (path.startsWith(href) && href !== "/"));
      if (path === "/" && href === "/") a.classList.add("active");
    });
  }

  function toast(msg, type) {
    document.querySelectorAll(".toast").forEach((t) => t.remove());
    const el = document.createElement("div");
    el.className = "toast" + (type === "error" ? " error" : "");
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  function confirmModal({ title, body, confirmText, danger }) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "modal-back";
      wrap.innerHTML = `
        <div class="modal">
          <header><h3>${Helpers.escapeHtml(title)}</h3></header>
          <div class="body"><p>${Helpers.escapeHtml(body)}</p></div>
          <footer>
            <button class="btn secondary" data-a="no">Cancel</button>
            <button class="btn ${danger ? "danger" : ""}" data-a="yes">${Helpers.escapeHtml(confirmText || "Confirm")}</button>
          </footer>
        </div>`;
      document.body.appendChild(wrap);
      wrap.addEventListener("click", (e) => {
        const a = e.target.getAttribute("data-a");
        if (a === "yes") {
          wrap.remove();
          resolve(true);
        }
        if (a === "no" || e.target === wrap) {
          wrap.remove();
          resolve(false);
        }
      });
    });
  }

  window.UI = { toast, confirmModal };

  function applyNavAccess() {
    if (!window.AuthService) return;
    const admin = AuthService.isAdmin();
    document.querySelectorAll("[data-admin]").forEach((el) => {
      el.style.display = admin ? "" : "none";
    });
    const who = document.getElementById("whoami");
    const session = AuthService.current();
    if (who) who.textContent = session ? session.name + " · " + session.role : "";
  }

  function render() {
    try {
      if (window.AuthService) AuthService.ensureUsers();
    } catch (e) {
      console.error(e);
    }
    if (window.GithubSync && GithubSync.ready() && !window.__ghPulled) {
      window.__ghPulled = true;
      GithubSync.pull().catch((err) => console.warn(err));
    }
    const { path, params, parts } = parseHash();
    const settings = SettingsService.get();
    const nameEl = document.getElementById("companyName");
    if (nameEl) nameEl.textContent = (settings.companyName || "StowNest").split(" ")[0];
    document.getElementById("pageTitle").textContent = titles[path] || "StowNest";
    document.getElementById("pageMeta").textContent = new Date().toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    setActive(path === "/calculator" ? "/calculator" : path === "/orders" ? "/orders" : path);
    document.body.classList.remove("nav-open");
    applyNavAccess();

    const view = document.getElementById("view");
    view.innerHTML = "";

    if (window.AuthService && AuthService.requireLogin() && !AuthService.session()) {
      document.getElementById("pageTitle").textContent = "Sign in";
      if (Pages.login) Pages.login(view);
      else view.innerHTML = `<div class="empty"><h4>Sign in file missing</h4><p>Copy js/pages/login.js and js/services/auth.js then refresh.</p></div>`;
      return;
    }
    if (window.AuthService && !AuthService.canOpen(path)) {
      UI.toast("Admins only.", "error");
      location.hash = "#/calculator";
      return;
    }

    if (path === "/" || path === "") Pages.dashboard(view);
    else if (path === "/calculator") Pages.calculator(view, params);
    else if (path === "/orders") {
      if (parts[1] === "view" && parts[2]) Pages.orderDetail(view, parts[2]);
      else Pages.orders(view);
    } else if (path === "/items") Pages.items(view);
    else if (path === "/vehicles") Pages.vehicles(view);
    else if (path === "/routes") Pages.routes(view);
    else if (path === "/rates") Pages.rates(view);
    else if (path === "/settings") Pages.settings(view);
    else Pages.dashboard(view);
  }

  function bindNav() {
    const btn = document.getElementById("menuBtn");
    const scrim = document.getElementById("navScrim");
    if (btn) btn.addEventListener("click", () => document.body.classList.toggle("nav-open"));
    if (scrim) scrim.addEventListener("click", () => document.body.classList.remove("nav-open"));
    document.querySelectorAll("#mainNav a").forEach((a) => {
      a.addEventListener("click", () => document.body.classList.remove("nav-open"));
    });
    const out = document.getElementById("logoutBtn");
    if (out) {
      out.addEventListener("click", (e) => {
        e.preventDefault();
        try {
          if (window.AuthService) AuthService.logout();
        } catch (err) {}
        sessionStorage.removeItem("gsmc_v1_session");
        location.hash = "#/";
        location.reload();
      });
    }
  }

  window.addEventListener("hashchange", render);
  function boot() {
    bindNav();
    render();
  }
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
