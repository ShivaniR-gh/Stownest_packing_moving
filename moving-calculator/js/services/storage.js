/**
 * Persistence layer. UI never talks to localStorage directly.
 * Swap this implementation for REST later without rewriting pages.
 */
(function (global) {
  const PREFIX = "gsmc_v1_";
  const KEYS = {
    items: PREFIX + "items",
    vehicles: PREFIX + "vehicles",
    distance: PREFIX + "distance",
    services: PREFIX + "services",
    orders: PREFIX + "orders",
    settings: PREFIX + "settings",
    seedVersion: PREFIX + "seed_version",
    draft: PREFIX + "draft",
    routes: PREFIX + "routes",
    cities: PREFIX + "cities",
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return structuredClone(fallback);
      return JSON.parse(raw);
    } catch {
      return structuredClone(fallback);
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function ensureSeeded() {
    const defaults = global.AppDefaults;
    const current = String(defaults.seedVersion || 1);
    const stored = localStorage.getItem(KEYS.seedVersion);
    let existingItems = [];
    try {
      existingItems = JSON.parse(localStorage.getItem(KEYS.items) || "[]");
    } catch {
      existingItems = [];
    }
    if (
      stored !== current ||
      !Array.isArray(existingItems) ||
      existingItems.length < (defaults.items || []).length
    ) {
      write(KEYS.items, defaults.items);
      write(KEYS.services, defaults.services);
      write(KEYS.vehicles, defaults.vehicles);
      write(KEYS.routes, defaults.routes || []);
      write(KEYS.cities, defaults.cities || []);
      localStorage.setItem(KEYS.seedVersion, current);
    }
    if (!localStorage.getItem(KEYS.vehicles)) write(KEYS.vehicles, defaults.vehicles);
    if (!localStorage.getItem(KEYS.routes)) write(KEYS.routes, defaults.routes || []);
    if (!localStorage.getItem(KEYS.cities)) write(KEYS.cities, defaults.cities || []);
    if (!localStorage.getItem(KEYS.distance)) write(KEYS.distance, defaults.distance);
    else {
      const dist = read(KEYS.distance, defaults.distance);
      let changed = false;
      if (dist.perCftRate == null) {
        dist.perCftRate = defaults.distance.perCftRate;
        changed = true;
      }
      if (!Number(dist.ratePerKm) && !Number(dist.additionalKmRate)) {
        dist.ratePerKm = defaults.distance.ratePerKm;
        dist.additionalKmRate = defaults.distance.additionalKmRate;
        changed = true;
      }
      if (Number(dist.baseDistanceIncluded)) {
        dist.baseDistanceIncluded = 0;
        changed = true;
      }
      if (changed) write(KEYS.distance, dist);
    }
    if (!localStorage.getItem(KEYS.services)) write(KEYS.services, defaults.services);
    if (!localStorage.getItem(KEYS.orders)) write(KEYS.orders, defaults.orders);
    if (!localStorage.getItem(KEYS.settings)) write(KEYS.settings, defaults.settings);
  }

  global.StorageService = {
    keys: KEYS,
    ensureSeeded,
    getItems() {
      ensureSeeded();
      return read(KEYS.items, global.AppDefaults.items);
    },
    setItems(list) {
      return write(KEYS.items, list);
    },
    getVehicles() {
      ensureSeeded();
      return read(KEYS.vehicles, global.AppDefaults.vehicles);
    },
    setVehicles(list) {
      return write(KEYS.vehicles, list);
    },
    getDistance() {
      ensureSeeded();
      return read(KEYS.distance, global.AppDefaults.distance);
    },
    setDistance(cfg) {
      return write(KEYS.distance, cfg);
    },
    getServices() {
      ensureSeeded();
      return read(KEYS.services, global.AppDefaults.services);
    },
    setServices(list) {
      return write(KEYS.services, list);
    },
    getOrders() {
      ensureSeeded();
      return read(KEYS.orders, []);
    },
    setOrders(list) {
      return write(KEYS.orders, list);
    },
    getSettings() {
      ensureSeeded();
      return read(KEYS.settings, global.AppDefaults.settings);
    },
    setSettings(cfg) {
      return write(KEYS.settings, cfg);
    },
    getDraft() {
      try {
        const raw = localStorage.getItem(KEYS.draft);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    setDraft(order) {
      localStorage.setItem(KEYS.draft, JSON.stringify(order));
    },
    clearDraft() {
      localStorage.removeItem(KEYS.draft);
    },
    getRoutes() {
      ensureSeeded();
      return read(KEYS.routes, global.AppDefaults.routes || []);
    },
    setRoutes(list) {
      return write(KEYS.routes, list);
    },
    getCities() {
      ensureSeeded();
      return read(KEYS.cities, global.AppDefaults.cities || []);
    },
    setCities(list) {
      return write(KEYS.cities, list);
    },
    exportAll() {
      ensureSeeded();
      return {
        exportedAt: new Date().toISOString(),
        items: this.getItems(),
        vehicles: this.getVehicles(),
        distance: this.getDistance(),
        services: this.getServices(),
        routes: this.getRoutes(),
        cities: this.getCities(),
        orders: this.getOrders(),
        settings: this.getSettings(),
      };
    },
    importAll(payload) {
      if (!payload || typeof payload !== "object") throw new Error("Invalid backup file.");
      if (payload.items) write(KEYS.items, payload.items);
      if (payload.vehicles) write(KEYS.vehicles, payload.vehicles);
      if (payload.distance) write(KEYS.distance, payload.distance);
      if (payload.services) write(KEYS.services, payload.services);
      if (payload.routes) write(KEYS.routes, payload.routes);
      if (payload.cities) write(KEYS.cities, payload.cities);
      if (payload.orders) write(KEYS.orders, payload.orders);
      if (payload.settings) write(KEYS.settings, payload.settings);
    },
    factoryReset() {
      Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
      ensureSeeded();
    },
  };
})(window);
