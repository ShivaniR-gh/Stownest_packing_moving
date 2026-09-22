/**
 * In-memory, read-only view of the Google Sheet.
 * Nothing is persisted in the browser and nothing is written back.
 * Every page load (and the Refresh button) fetches fresh data from the sheet.
 */
(function (global) {
  let data = null;
  let loading = null;

  const empty = () => ({
    loadedAt: null,
    settings: {},
    vehicles: [],
    items: [],
    cities: [],
    lanes: [],
    services: [],
    users: [],
  });

  function byName(a, b) {
    return String(a.name).localeCompare(String(b.name));
  }

  /*
   * Speed: the last sheet snapshot is kept in this browser so pages open instantly,
   * and a fresh copy is fetched from the sheet in the background on every page load.
   * "Refresh from sheet" always waits for a fresh read. The sheet stays the only source of truth.
   */
  const CACHE_PREFIX = "stownest_sheet_cache:";
  let revalidated = false;
  let listener = null;

  function cacheKey() {
    const u = AuthService.current();
    return u ? CACHE_PREFIX + u.username : null;
  }
  function readCache() {
    try {
      const k = cacheKey();
      return k ? JSON.parse(localStorage.getItem(k) || "null") : null;
    } catch {
      return null;
    }
  }
  function writeCache(payload) {
    try {
      const k = cacheKey();
      if (k) localStorage.setItem(k, JSON.stringify(payload));
    } catch {
      /* storage full or blocked — cache is optional */
    }
  }
  function fingerprint(p) {
    const { loadedAt, user, ...rest } = p || {};
    return JSON.stringify(rest);
  }
  function fetchFresh(force) {
    const token = AuthService.token();
    if (!token) return Promise.reject(Object.assign(new Error("Not signed in."), { code: "auth" }));
    return SheetApi.load(token, force);
  }

  global.DataStore = {
    ready() {
      return !!data;
    },
    /** Called after login with the data returned by the login request. */
    set(payload) {
      data = { ...empty(), ...payload };
      revalidated = true;
      writeCache(data);
    },
    /** Called when a background refresh brings changed data. */
    onUpdate(fn) {
      listener = fn;
    },
    async load(force) {
      if (data && !force) return data;
      if (loading) return loading;

      if (!force) {
        const cached = readCache();
        if (cached) {
          data = { ...empty(), ...cached };
          this.revalidate();
          return data;
        }
      }
      loading = fetchFresh(force)
        .then((payload) => {
          data = { ...empty(), ...payload };
          revalidated = true;
          writeCache(data);
          return data;
        })
        .finally(() => {
          loading = null;
        });
      return loading;
    },
    /** Background check against the sheet; notifies the app only if something changed. */
    revalidate() {
      if (revalidated) return;
      revalidated = true;
      fetchFresh(false)
        .then((payload) => {
          const changed = fingerprint(payload) !== fingerprint(data);
          data = { ...empty(), ...payload };
          writeCache(data);
          if (listener) listener(changed);
        })
        .catch((err) => {
          if (listener) listener(false, err);
        });
    },
    clear() {
      try {
        Object.keys(localStorage)
          .filter((k) => k.indexOf(CACHE_PREFIX) === 0)
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        /* ignore */
      }
      data = null;
      revalidated = false;
    },
    loadedAt() {
      return data && data.loadedAt;
    },
    settings() {
      return (data && data.settings) || {};
    },
    currency() {
      return this.settings().currencySymbol || "₹";
    },
    items(includeInactive) {
      const list = (data && data.items) || [];
      return includeInactive ? list : list.filter((i) => i.active !== false);
    },
    item(id) {
      return this.items(true).find((i) => i.id === id) || null;
    },
    vehicles(includeInactive) {
      const list = ((data && data.vehicles) || []).slice().sort((a, b) => Helpers.number(a.maxCft) - Helpers.number(b.maxCft));
      return includeInactive ? list : list.filter((v) => v.active !== false);
    },
    services(includeInactive) {
      const list = (data && data.services) || [];
      return includeInactive ? list : list.filter((s) => s.active !== false);
    },
    lanes() {
      return (data && data.lanes) || [];
    },
    cityRecords() {
      return ((data && data.cities) || []).slice().sort(byName);
    },
    /** City names for pickup/drop: the Cities tab plus any city used on a lane. */
    cities() {
      const seen = new Set();
      const out = [];
      const add = (c) => {
        const key = Helpers.slug(c);
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(String(c).trim());
      };
      this.cityRecords().forEach((c) => add(c.name));
      this.lanes().forEach((l) => {
        add(l.from);
        add(l.to);
      });
      return out.sort((a, b) => a.localeCompare(b));
    },
    /** alias (lower-case) → canonical city (lower-case), from the Cities tab "aliases" column */
    aliasMap() {
      const map = {};
      this.cityRecords().forEach((c) => {
        (c.aliases || []).forEach((a) => {
          map[Helpers.slug(a)] = Helpers.slug(c.name);
        });
      });
      return map;
    },
    users() {
      return (data && data.users) || [];
    },
  };
})(window);
