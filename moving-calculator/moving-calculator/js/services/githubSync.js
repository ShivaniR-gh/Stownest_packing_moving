(function (global) {
  const PATH = "data/masters.json";
  let timer = null;
  let lastSha = null;

  function cfg() {
    const s = (global.SettingsService && SettingsService.get()) || {};
    return {
      enabled: !!s.githubEnabled,
      owner: String(s.githubOwner || "").trim(),
      repo: String(s.githubRepo || "").trim(),
      branch: String(s.githubBranch || "main").trim() || "main",
      token: String(s.githubToken || "").trim(),
      path: String(s.githubPath || PATH).trim() || PATH,
    };
  }

  function ready() {
    const c = cfg();
    return c.enabled && c.owner && c.repo;
  }

  function apiUrl() {
    const c = cfg();
    return "https://api.github.com/repos/" + encodeURIComponent(c.owner) + "/" + encodeURIComponent(c.repo) + "/contents/" + c.path.replace(/^\/+/, "");
  }

  function headers(write) {
    const c = cfg();
    const h = { Accept: "application/vnd.github+json" };
    if (c.token) h.Authorization = "Bearer " + c.token;
    if (write) h["Content-Type"] = "application/json";
    return h;
  }

  function toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function fromBase64(str) {
    return decodeURIComponent(escape(atob(str.replace(/\n/g, ""))));
  }

  function snapshot() {
    const raw = StorageService.exportAll();
    const settings = { ...(raw.settings || {}) };
    delete settings.githubToken;
    return {
      exportedAt: new Date().toISOString(),
      items: raw.items,
      vehicles: raw.vehicles,
      services: raw.services,
      routes: raw.routes,
      cities: raw.cities,
      users: raw.users,
      settings,
    };
  }

  function apply(payload) {
    if (!payload || typeof payload !== "object") return;
    const local = SettingsService.get();
    const incoming = payload.settings || {};
    incoming.githubToken = local.githubToken || "";
    incoming.githubOwner = local.githubOwner || incoming.githubOwner;
    incoming.githubRepo = local.githubRepo || incoming.githubRepo;
    incoming.githubBranch = local.githubBranch || incoming.githubBranch;
    incoming.githubEnabled = local.githubEnabled;
    incoming.githubPath = local.githubPath || incoming.githubPath;
    StorageService.importAll({
      items: payload.items,
      vehicles: payload.vehicles,
      services: payload.services,
      routes: payload.routes,
      cities: payload.cities,
      users: payload.users,
      settings: incoming,
    });
  }

  async function pull() {
    if (!ready()) return { ok: false, reason: "GitHub sync is off or owner/repo is missing." };
    const c = cfg();
    const res = await fetch(apiUrl() + "?ref=" + encodeURIComponent(c.branch), { headers: headers(false) });
    if (res.status === 404) return { ok: false, reason: "masters.json not found yet. Click Publish to create it." };
    if (!res.ok) {
      const t = await res.text();
      throw new Error("GitHub read failed (" + res.status + "). " + t.slice(0, 160));
    }
    const body = await res.json();
    lastSha = body.sha;
    const payload = JSON.parse(fromBase64(body.content || ""));
    const remoteEmpty = !(payload.cities || []).length && !(payload.items || []).length && !(payload.routes || []).length;
    if (remoteEmpty && (StorageService.getCities().length || StorageService.getItems().length)) {
      return { ok: false, reason: "Remote file is empty. Click Publish first so other computers can load your cities." };
    }
    apply(payload);
    return { ok: true, at: payload.exportedAt };
  }

  async function push() {
    if (!ready()) return { ok: false, reason: "GitHub sync is off." };
    const c = cfg();
    if (!c.token) throw new Error("Add a GitHub token in Settings to publish.");
    const payload = snapshot();
    const content = toBase64(JSON.stringify(payload, null, 2));
    if (!lastSha) {
      const look = await fetch(apiUrl() + "?ref=" + encodeURIComponent(c.branch), { headers: headers(false) });
      if (look.ok) {
        const body = await look.json();
        lastSha = body.sha;
      }
    }
    const res = await fetch(apiUrl(), {
      method: "PUT",
      headers: headers(true),
      body: JSON.stringify({
        message: "Update cities, prices and masters",
        content,
        branch: c.branch,
        sha: lastSha || undefined,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error("GitHub write failed (" + res.status + "). " + t.slice(0, 180));
    }
    const body = await res.json();
    lastSha = body.content && body.content.sha;
    return { ok: true };
  }

  function schedulePush() {
    if (!ready() || !cfg().token) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      push().catch((err) => console.warn(err));
    }, 1200);
  }

  global.GithubSync = { pull, push, schedulePush, ready, cfg };
})(window);
