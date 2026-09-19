(function (global) {
  const S = () => global.StorageService;

  global.ItemService = {
    list(includeInactive = true) {
      const items = S().getItems();
      return includeInactive ? items : items.filter((i) => i.active !== false);
    },
    get(id) {
      return S().getItems().find((i) => i.id === id) || null;
    },
    save(item) {
      const list = S().getItems();
      const idx = list.findIndex((i) => i.id === item.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...item };
      else list.push(item);
      S().setItems(list);
      return item;
    },
    remove(id) {
      S().setItems(S().getItems().filter((i) => i.id !== id));
    },
    categories() {
      const set = new Set(S().getItems().map((i) => i.category).filter(Boolean));
      return Array.from(set).sort();
    },
  };

  global.VehicleService = {
    list(includeInactive = true) {
      const list = S().getVehicles();
      return includeInactive ? list : list.filter((v) => v.active !== false);
    },
    get(id) {
      return S().getVehicles().find((v) => v.id === id) || null;
    },
    save(vehicle) {
      const list = S().getVehicles();
      const idx = list.findIndex((v) => v.id === vehicle.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...vehicle };
      else list.push(vehicle);
      S().setVehicles(list);
      return vehicle;
    },
    remove(id) {
      S().setVehicles(S().getVehicles().filter((v) => v.id !== id));
    },
  };

  global.RateService = {
    getDistance() {
      return S().getDistance();
    },
    saveDistance(cfg) {
      S().setDistance(cfg);
      return cfg;
    },
    listServices(includeInactive = true) {
      const list = S().getServices();
      return includeInactive ? list : list.filter((s) => s.active !== false);
    },
    saveService(svc) {
      const list = S().getServices();
      const idx = list.findIndex((s) => s.id === svc.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...svc };
      else list.push(svc);
      S().setServices(list);
      return svc;
    },
    removeService(id) {
      S().setServices(S().getServices().filter((s) => s.id !== id));
    },
  };


  global.RouteService = {
    list() {
      return S().getRoutes();
    },
    get(id) {
      return S().getRoutes().find((r) => r.id === id) || null;
    },
    cities() {
      const stored = S().getCities() || [];
      const fromRoutes = [];
      S().getRoutes().forEach((r) => {
        if (r.from) fromRoutes.push(r.from);
        if (r.to) fromRoutes.push(r.to);
      });
      const seen = new Set();
      const out = [];
      stored.concat(fromRoutes).forEach((c) => {
        const key = String(c || "").trim().toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(String(c).trim());
      });
      return out.sort((a, b) => a.localeCompare(b));
    },
    save(route) {
      const list = S().getRoutes();
      const idx = list.findIndex((r) => r.id === route.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...route };
      else list.push(route);
      S().setRoutes(list);
      return route;
    },
    remove(id) {
      S().setRoutes(S().getRoutes().filter((r) => r.id !== id));
    },
    findLane(pickup, drop) {
      return global.Calc.findRoute(pickup, drop, S().getRoutes());
    },
    addCity(name) {
      const clean = String(name || "").trim();
      if (!clean) return null;
      const list = S().getCities() || [];
      const exists = list.some((c) => Helpers.slug(c) === Helpers.slug(clean));
      if (!exists) {
        list.push(clean);
        S().setCities(list);
      }
      return clean;
    },
    removeCity(name) {
      const key = Helpers.slug(name);
      S().setCities((S().getCities() || []).filter((c) => Helpers.slug(c) !== key));
    },
    emptyPrices() {
      const dedicated = {};
      const sharing = {};
      (global.VehicleService.list(false) || []).forEach((v) => {
        dedicated[v.id] = 0;
        sharing[v.id] = 0;
      });
      return { dedicated, sharing };
    },
  };

  global.OrderService = {
    list() {
      return S()
        .getOrders()
        .slice()
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    get(id) {
      return S().getOrders().find((o) => o.id === id) || null;
    },
    save(order) {
      const list = S().getOrders();
      const idx = list.findIndex((o) => o.id === order.id);
      const now = new Date().toISOString();
      const next = { ...order, updatedAt: now };
      if (idx >= 0) list[idx] = { ...list[idx], ...next };
      else list.push({ ...next, createdAt: now });
      S().setOrders(list);
      return next;
    },
    remove(id) {
      S().setOrders(S().getOrders().filter((o) => o.id !== id));
    },
    duplicate(id) {
      const src = this.get(id);
      if (!src) return null;
      const copy = structuredClone(src);
      copy.id = Helpers.uid("ord");
      copy.bookingId = Helpers.nextBookingId(S().getOrders());
      copy.status = "draft";
      copy.customerName = (src.customerName || "") + " (copy)";
      copy.createdAt = new Date().toISOString();
      copy.updatedAt = copy.createdAt;
      const list = S().getOrders();
      list.push(copy);
      S().setOrders(list);
      return copy;
    },
  };

  global.SettingsService = {
    get() {
      return S().getSettings();
    },
    save(cfg) {
      S().setSettings({ ...S().getSettings(), ...cfg });
      return S().getSettings();
    },
  };
})(window);
