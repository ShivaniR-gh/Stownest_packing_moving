(function (global) {
  const SESSION_KEY = "gsmc_v1_session";

  function hashPass(password, salt) {
    let h = 2166136261;
    const s = String(salt || "stownest") + ":" + String(password || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function uid() {
    return "usr-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function security() {
    const s = StorageService.getSettings() || {};
    return {
      requireLogin: s.requireLogin !== false,
      sessionMinutes: Math.max(15, Number(s.sessionMinutes) || 480),
    };
  }

  function users() {
    const list = StorageService.getUsers ? StorageService.getUsers() : [];
    return Array.isArray(list) ? list : [];
  }

  function saveUsers(list) {
    StorageService.setUsers(list);
  }

  function defaultAdmin() {
    const salt = "stownest";
    return {
      id: "usr-admin",
      name: "Admin",
      username: "admin",
      role: "admin",
      active: true,
      salt,
      passwordHash: hashPass("Admin@123", salt),
      createdAt: new Date().toISOString(),
    };
  }

  global.AuthService = {
    hashPass,
    ensureUsers() {
      let list = users();
      if (!list.length) {
        list = [defaultAdmin()];
        saveUsers(list);
      }
      const settings = StorageService.getSettings();
      if (settings.requireLogin == null) {
        StorageService.setSettings({ ...settings, requireLogin: true, sessionMinutes: 480 });
      }
      return list;
    },
    list() {
      this.ensureUsers();
      return users();
    },
    get(id) {
      return users().find((u) => u.id === id) || null;
    },
    save(user) {
      const list = users();
      const idx = list.findIndex((u) => u.id === user.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...user };
      else list.push(user);
      saveUsers(list);
      return user;
    },
    remove(id) {
      const list = users();
      if (list.length <= 1) throw new Error("Keep at least one user.");
      const target = list.find((u) => u.id === id);
      const admins = list.filter((u) => u.role === "admin" && u.id !== id);
      if (target && target.role === "admin" && !admins.length) {
        throw new Error("Keep at least one admin.");
      }
      saveUsers(list.filter((u) => u.id !== id));
    },
    create({ name, username, password, role }) {
      const uname = String(username || "").trim().toLowerCase();
      if (!uname) throw new Error("Username is required.");
      if (users().some((u) => String(u.username).toLowerCase() === uname)) {
        throw new Error("That username already exists.");
      }
      if (!password || String(password).length < 6) throw new Error("Password must be at least 6 characters.");
      const salt = uid();
      const user = {
        id: uid(),
        name: String(name || uname).trim(),
        username: uname,
        role: role === "employee" ? "employee" : "admin",
        active: true,
        salt,
        passwordHash: hashPass(password, salt),
        createdAt: new Date().toISOString(),
      };
      this.save(user);
      return user;
    },
    setPassword(id, password) {
      if (!password || String(password).length < 6) throw new Error("Password must be at least 6 characters.");
      const user = this.get(id);
      if (!user) throw new Error("User not found.");
      const salt = uid();
      this.save({ ...user, salt, passwordHash: hashPass(password, salt) });
    },
    login(username, password) {
      this.ensureUsers();
      const uname = String(username || "").trim().toLowerCase();
      const user = users().find((u) => String(u.username).toLowerCase() === uname && u.active !== false);
      if (!user || user.passwordHash !== hashPass(password, user.salt)) {
        throw new Error("Wrong username or password.");
      }
      const minutes = security().sessionMinutes;
      const session = {
        userId: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        exp: Date.now() + minutes * 60 * 1000,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
    },
    logout() {
      sessionStorage.removeItem(SESSION_KEY);
    },
    session() {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (!s || !s.exp || Date.now() > s.exp) {
          sessionStorage.removeItem(SESSION_KEY);
          return null;
        }
        const user = this.get(s.userId);
        if (!user || user.active === false) {
          sessionStorage.removeItem(SESSION_KEY);
          return null;
        }
        s.role = user.role;
        s.name = user.name;
        return s;
      } catch {
        return null;
      }
    },
    current() {
      if (!security().requireLogin) {
        return { userId: "usr-open", username: "open", role: "admin", name: "Open access", exp: Date.now() + 86400000 };
      }
      return this.session();
    },
    isAdmin() {
      const s = this.current();
      return !!(s && s.role === "admin");
    },
    requireLogin() {
      return security().requireLogin;
    },
    canOpen(path) {
      if (!this.requireLogin()) return true;
      if (!this.session()) return false;
      const adminOnly = ["/items", "/vehicles", "/routes", "/rates", "/settings"];
      if (adminOnly.includes(path) && !this.isAdmin()) return false;
      return true;
    },
  };
})(window);
