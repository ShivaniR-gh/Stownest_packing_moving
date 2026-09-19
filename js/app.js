(function () {
  StorageService.ensureSeeded();

  const titles = {
    "/": "Dashboard",
    "/calculator": "Order Calculator",
    "/orders": "Orders",
    "/items": "Item Master",
    "/vehicles": "Vehicle Master",
    "/routes": "Cities & Lanes",
    "/rates": "Rate Configuration",
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

  function render() {
    const { path, params, parts } = parseHash();
    const settings = SettingsService.get();
    document.getElementById("companyName").textContent = settings.companyName.split(" ")[0] || "GreenShift";
    document.getElementById("pageTitle").textContent = titles[path] || "GreenShift";
    document.getElementById("pageMeta").textContent = new Date().toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    setActive(path === "/calculator" ? "/calculator" : path === "/orders" ? "/orders" : path);
    document.body.classList.remove("nav-open");

    const view = document.getElementById("view");
    view.innerHTML = "";

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
  }

  window.addEventListener("hashchange", render);
  function boot() {
    bindNav();
    render();
  }
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
