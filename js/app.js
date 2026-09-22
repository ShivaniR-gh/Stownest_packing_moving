(function () {
  const titles = {
    "/": "Home",
    "/calculator": "Quote Calculator",
    "/items": "Item Master",
    "/vehicles": "Vehicle Master",
    "/routes": "Cities & Lanes",
    "/services": "Extra Services",
    "/settings": "Settings & Users",
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
      a.classList.toggle("active", href === path);
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

  /** Shared "view only" banner used by every master page. */
  function viewOnlyNote(tab) {
    const link = AppConfig.sheetUrl
      ? ` <a href="${Helpers.escapeHtml(AppConfig.sheetUrl)}" target="_blank" rel="noopener">Open Google Sheet ↗</a>`
      : "";
    return `<div class="card-bd help view-only-note">View only — data comes from the Google Sheet tab <strong>${Helpers.escapeHtml(tab)}</strong>. Edit it there, then click <strong>Refresh from sheet</strong>.${link}</div>`;
  }

  window.UI = { toast, confirmModal, viewOnlyNote };

  function applyChrome() {
    const admin = AuthService.isAdmin();
    document.querySelectorAll("[data-admin]").forEach((el) => {
      el.style.display = admin ? "" : "none";
    });
    const user = AuthService.current();
    const signedIn = !!user;
    document.getElementById("whoami").textContent = user ? user.name + " · " + user.role : "";
    document.getElementById("logoutBtn").style.display = signedIn ? "" : "none";
    document.getElementById("refreshBtn").style.display = signedIn && DataStore.ready() ? "" : "none";

    const settings = DataStore.settings();
    const nameEl = document.getElementById("companyName");
    if (nameEl) nameEl.textContent = (settings.companyName || "StowNest").split(" ")[0];
    const meta = document.getElementById("pageMeta");
    const at = DataStore.loadedAt();
    meta.textContent = at
      ? "Sheet data · " + new Date(at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
      : "";
  }

  function showMessage(view, title, body, action) {
    view.innerHTML = `<div class="empty"><h4>${Helpers.escapeHtml(title)}</h4><p>${body}</p>${action || ""}</div>`;
  }

  async function render() {
    const { path, params } = parseHash();
    const view = document.getElementById("view");
    document.body.classList.remove("nav-open");
    setActive(path);

    if (!SheetApi.configured()) {
      document.getElementById("pageTitle").textContent = "Setup needed";
      applyChrome();
      showMessage(
        view,
        "Google Sheet API not connected",
        "Deploy <code>apps-script/Code.gs</code> as a web app and paste its <code>/exec</code> URL into <code>js/config.js → sheetApiUrl</code>."
      );
      return;
    }

    if (!AuthService.current()) {
      DataStore.clear();
      document.getElementById("pageTitle").textContent = "Sign in";
      applyChrome();
      Pages.login(view);
      return;
    }

    if (!DataStore.ready()) {
      document.getElementById("pageTitle").textContent = "Loading…";
      view.innerHTML = `<div class="empty"><div class="spinner"></div><p>Fetching data from Google Sheet…</p></div>`;
      try {
        await DataStore.load();
      } catch (err) {
        if (err.code === "auth") {
          AuthService.logout();
          toast(err.message || "Please sign in again.", "error");
          return render();
        }
        document.getElementById("pageTitle").textContent = "Could not load data";
        applyChrome();
        showMessage(view, "Could not read the Google Sheet", Helpers.escapeHtml(err.message || String(err)), `<button class="btn" id="retry">Try again</button>`);
        view.querySelector("#retry").addEventListener("click", render);
        return;
      }
    }

    applyChrome();
    if (!AuthService.canOpen(path)) {
      toast("Admins only.", "error");
      location.hash = "#/calculator";
      return;
    }
    document.getElementById("pageTitle").textContent = titles[path] || "StowNest";
    view.innerHTML = "";

    if (path === "/calculator") Pages.calculator(view, params);
    else if (path === "/items") Pages.items(view);
    else if (path === "/vehicles") Pages.vehicles(view);
    else if (path === "/routes") Pages.routes(view);
    else if (path === "/services") Pages.services(view);
    else if (path === "/settings") Pages.settings(view);
    else Pages.dashboard(view);
  }

  async function refresh() {
    const btn = document.getElementById("refreshBtn");
    btn.disabled = true;
    btn.textContent = "Refreshing…";
    try {
      await DataStore.load(true);
      toast("Latest data loaded from Google Sheet.");
    } catch (err) {
      if (err.code === "auth") AuthService.logout();
      toast(err.message || "Could not read the sheet.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "↻ Refresh from sheet";
      render();
    }
  }

  window.App = { render, refresh };

  // Background refresh finished: update the screen if the sheet changed.
  DataStore.onUpdate((changed, err) => {
    if (err && err.code === "auth") {
      AuthService.logout();
      DataStore.clear();
      render();
      return;
    }
    applyChrome();
    if (!changed) return;
    if (parseHash().path === "/calculator") {
      toast("Latest prices loaded from the sheet.");
      render(); // quote inputs are kept in the draft, so nothing typed is lost
    } else {
      render();
    }
  });

  function bindChrome() {
    document.getElementById("menuBtn").addEventListener("click", () => document.body.classList.toggle("nav-open"));
    document.getElementById("navScrim").addEventListener("click", () => document.body.classList.remove("nav-open"));
    document.getElementById("refreshBtn").addEventListener("click", refresh);
    document.getElementById("logoutBtn").addEventListener("click", (e) => {
      e.preventDefault();
      DataStore.clear();
      AuthService.logout();
      location.hash = "#/";
      render();
    });
  }

  window.addEventListener("hashchange", render);
  function boot() {
    bindChrome();
    render();
  }
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
