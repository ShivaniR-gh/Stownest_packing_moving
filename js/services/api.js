/**
 * Thin client for the Apps Script web app. Read-only: the only POST is login.
 */
(function (global) {
  function baseUrl() {
    return String((global.AppConfig && AppConfig.sheetApiUrl) || "").trim().replace(/\/$/, "");
  }

  function configured() {
    return /^https:\/\/script\.google(usercontent)?\.com\//.test(baseUrl());
  }

  async function parse(res) {
    if (!res.ok) throw new Error("Google Sheet API returned " + res.status + ".");
    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error("Google Sheet API did not return JSON. Check the web app deployment access is set to 'Anyone'.");
    }
    if (body && body.error) {
      const err = new Error(body.message || body.error);
      err.code = body.error;
      throw err;
    }
    return body;
  }

  async function login(username, password) {
    const res = await fetch(baseUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight
      body: JSON.stringify({ action: "login", username, password }),
    });
    return parse(res);
  }

  async function load(token, fresh) {
    const url = baseUrl() + "?token=" + encodeURIComponent(token) + (fresh ? "&fresh=1" : "") + "&t=" + Date.now();
    return parse(await fetch(url, { cache: "no-store" }));
  }

  global.SheetApi = { configured, login, load, baseUrl };
})(window);
