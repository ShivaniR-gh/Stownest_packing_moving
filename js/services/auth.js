/**
 * Session handling. Users and passwords live in the sheet's Users tab;
 * the Apps Script verifies them and returns a signed, expiring token.
 */
(function (global) {
  const KEY = "stownest_session";

  function read() {
    try {
      const s = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (!s || !s.token || !s.user || Date.now() > Number(s.user.exp || 0)) return null;
      return s;
    } catch {
      return null;
    }
  }

  global.AuthService = {
    async login(username, password) {
      const res = await SheetApi.login(String(username || "").trim(), String(password || ""));
      sessionStorage.setItem(KEY, JSON.stringify({ token: res.token, user: res.user }));
      if (res.data && global.DataStore) DataStore.set(res.data); // login already carries the sheet data
      return res.user;
    },
    logout() {
      sessionStorage.removeItem(KEY);
    },
    token() {
      const s = read();
      return s ? s.token : null;
    },
    current() {
      const s = read();
      return s ? s.user : null;
    },
    isAdmin() {
      const u = this.current();
      return !!(u && u.role === "admin");
    },
    canOpen(path) {
      const adminOnly = ["/items", "/vehicles", "/routes", "/services", "/settings"];
      return !adminOnly.includes(path) || this.isAdmin();
    },
  };
})(window);
