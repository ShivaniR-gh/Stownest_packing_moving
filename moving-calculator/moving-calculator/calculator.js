window.Pages = window.Pages || {};

Pages.calculator = function (root, params) {
  const editingId = params && params.id;
  const existing = editingId ? OrderService.get(editingId) : null;
  function cities() {
    return RouteService.cities();
  }

  const state = existing
    ? {
        id: existing.id,
        bookingId: existing.bookingId,
        customerName: existing.customerName || "",
        phone: existing.phone || "",
        email: existing.email || "",
        pickup: existing.pickup || "",
        drop: existing.drop || "",
        distanceKm: existing.distanceKm || 0,
        moveType: existing.moveType === "sharing" ? "sharing" : "dedicated",
        orderDate: existing.orderDate || Helpers.todayISO(),
        notes: existing.notes || "",
        status: existing.status || "draft",
        items: (existing.items || []).map((r) => ({ ...r })),
        selectedServices: (existing.selectedServices || []).map((s) => ({ ...s })),
        showErrors: false,
      }
    : loadDraft() || blankOrder();

  if (!state.moveType) state.moveType = "dedicated";

  function loadDraft() {
    const draft = StorageService.getDraft && StorageService.getDraft();
    if (!draft || typeof draft !== "object") return null;
    draft.showErrors = false;
    if (!Array.isArray(draft.items) || !draft.items.length) draft.items = [emptyRow()];
    if (draft.moveType !== "sharing") draft.moveType = "dedicated";
    return draft;
  }

  function persistDraft() {
    const copy = { ...state, items: state.items.map((r) => ({ ...r })), selectedServices: state.selectedServices.map((s) => ({ ...s })) };
    StorageService.setDraft(copy);
  }

  function blankOrder() {
    const services = RateService.listServices(false).map((s) => ({
      id: s.id,
      name: s.name,
      pricingType: s.pricingType,
      rate: s.rate,
      enabled: false,
      quantity: 1,
    }));
    return {
      id: Helpers.uid("ord"),
      bookingId: Helpers.nextBookingId(OrderService.list()),
      customerName: "",
      phone: "",
      email: "",
      pickup: "",
      drop: "",
      distanceKm: 0,
      moveType: "dedicated",
      orderDate: Helpers.todayISO(),
      notes: "",
      status: "draft",
      items: [emptyRow()],
      selectedServices: services,
      showErrors: false,
    };
  }

  function emptyRow() {
    return { key: Helpers.uid("row"), itemId: "", name: "", category: "", unit: "pcs", quantity: 1, cftPerItem: 0 };
  }

  function liveMasters() {
    return {
      items: ItemService.list(false),
      vehicles: VehicleService.list(false),
      distance: RateService.getDistance(),
      services: RateService.listServices(false),
      routes: RouteService.list(),
    };
  }

  function applyLaneFromLocations() {
    const lane = Calc.findRoute(state.pickup, state.drop, RouteService.list());
    if (lane) state.distanceKm = Helpers.number(lane.km);
    return lane;
  }

  function syncServiceCatalog() {
    const catalog = RateService.listServices(false);
    const byId = Object.fromEntries(state.selectedServices.map((s) => [s.id, s]));
    const extras = state.selectedServices.filter((s) => s.custom);
    state.selectedServices = catalog
      .map((s) => ({
        id: s.id,
        name: s.name,
        pricingType: "fixed",
        rate: s.rate,
        enabled: byId[s.id] ? !!byId[s.id].enabled : false,
        quantity: 1,
        custom: false,
      }))
      .concat(extras);
  }

  function refreshItemCftFromMaster() {
    const items = ItemService.list(true);
    state.items.forEach((row) => {
      if (!row.itemId) return;
      const master = items.find((i) => i.id === row.itemId);
      if (master) {
        row.name = master.name;
        row.category = master.category;
        row.unit = master.unit;
        row.cftPerItem = Helpers.number(master.cft);
      }
    });
  }

  function compute() {
    refreshItemCftFromMaster();
    syncServiceCatalog();
    const lane = applyLaneFromLocations();
    const masters = liveMasters();
    return Calc.calculateOrderTotal({
      items: state.items,
      distanceKm: state.distanceKm,
      pickup: state.pickup,
      drop: state.drop,
      moveType: state.moveType,
      vehicles: masters.vehicles,
      distance: masters.distance,
      selectedServices: state.selectedServices,
      routes: masters.routes,
    });
  }

  function snapshotTotals(calc) {
    return {
      totalCft: calc.totalCft,
      itemCount: calc.itemCount,
      vehicleId: calc.vehicle && calc.vehicle.id,
      vehicleName: calc.vehicle ? calc.vehicle.name : calc.recommendation.message,
      vehicleCapacity: calc.vehicle ? calc.vehicle.maxCft : calc.recommendation.largest && calc.recommendation.largest.maxCft,
      moveType: calc.moveType,
      dedicatedAmount: calc.dedicated && calc.dedicated.amount,
      sharingAmount: calc.sharing && calc.sharing.amount,
      transportAmount: calc.transportAmount,
      delivery: calc.delivery,
      pricingMode: calc.pricingMode,
      perCftRate: calc.perCftRate,
      cftCharge: calc.cftCharge,
      distanceCharge: calc.distance.amount,
      serviceTotal: calc.serviceTotal,
      total: calc.total,
      status: calc.recommendation.status,
    };
  }

  function collectForm(container) {
    state.customerName = container.querySelector("[name=customerName]").value;
    state.phone = container.querySelector("[name=phone]").value;
    state.email = container.querySelector("[name=email]").value;
    state.bookingId = container.querySelector("[name=bookingId]").value;
    state.pickup = container.querySelector("[name=pickup]").value;
    state.drop = container.querySelector("[name=drop]").value;
    state.moveType = container.querySelector("[name=moveType]").value === "sharing" ? "sharing" : "dedicated";
    const kmInput = container.querySelector("[name=distanceKm]");
    const lane = Calc.findRoute(state.pickup, state.drop, RouteService.list());
    if (lane) state.distanceKm = Helpers.number(lane.km);
    else state.distanceKm = Helpers.number(kmInput.value);
    state.notes = container.querySelector("[name=notes]").value;
    persistDraft();
  }

  function cityOptions(selected) {
    const all = cities();
    const extra = selected && !all.some((c) => Helpers.slug(c) === Helpers.slug(selected)) ? selected : "";
    const list = [""].concat(all);
    if (extra) list.push(extra);
    return list
      .map((c) => `<option value="${Helpers.escapeHtml(c)}" ${Helpers.slug(c) === Helpers.slug(selected) ? "selected" : ""}>${c ? Helpers.escapeHtml(c) : "Select city"}</option>`)
      .join("");
  }

  function paint(focusKey) {
    const calc = compute();
    const errors = state.showErrors ? Validation.validateCustomer(state) : {};
    const rec = calc.recommendation;
    const overflow = rec.status === "overflow";
    const settings = SettingsService.get();
    const laneLocked = !!calc.route;
    const dedicatedAmt = calc.dedicated && calc.dedicated.available ? calc.dedicated.amount : null;
    const sharingAmt = calc.sharing && calc.sharing.available ? calc.sharing.amount : null;

    root.innerHTML = `
      <div class="split">
        <div>
          <div class="card" style="margin-bottom:16px">
            <div class="card-hd"><h3>Customer information</h3></div>
            <div class="card-bd">
              <div class="form-grid form-grid-2">
                ${field("bookingId", "Order / Booking ID", state.bookingId)}
                ${field("customerName", "Customer Name", state.customerName, errors.customerName)}
                ${field("phone", "Phone Number", state.phone, errors.phone)}
                ${field("email", "Email", state.email, errors.email)}
                <div class="field">
                  <label>Pickup Location</label>
                  <select name="pickup">${cityOptions(state.pickup)}</select>
                </div>
                <div class="field">
                  <label>Drop / Delivery Location</label>
                  <select name="drop">${cityOptions(state.drop)}</select>
                </div>
                <div class="field">
                  <label>Distance in KM</label>
                  <input name="distanceKm" type="number" min="0" value="${Helpers.escapeHtml(state.distanceKm)}" ${laneLocked ? "readonly" : ""} />
                  <div class="help">${
                    Helpers.slug(state.pickup) && Helpers.slug(state.pickup) === Helpers.slug(state.drop)
                      ? "Pickup and drop are the same city — pick two different cities (e.g. Bangalore → Chennai = 360 KM)."
                      : laneLocked
                      ? "Auto-filled from Cities & Lanes (" + Helpers.number(calc.distanceKm) + " KM" + (calc.delivery ? ", " + Helpers.escapeHtml(calc.delivery) : "") + ")"
                      : "No lane for this pair yet. Add it under Admin → Cities & Lanes, or type KM for a custom move."
                  }</div>
                </div>
                <div class="field">
                  <label>Move type</label>
                  <select name="moveType">
                    <option value="dedicated" ${state.moveType === "dedicated" ? "selected" : ""}>Dedicated</option>
                    <option value="sharing" ${state.moveType === "sharing" ? "selected" : ""}>Sharing</option>
                  </select>
                  <div class="help">Items pick the vehicle size. Then Sharing or Dedicated uses that vehicle’s sheet price for the lane.</div>
                </div>
              </div>
            </div>
          </div>

          <div class="card" style="margin-bottom:16px">
            <div class="card-hd">
              <h3>Order items</h3>
              <button class="btn sm" data-act="add-row">Add item</button>
            </div>
            <div class="card-bd table-wrap item-table-wrap">
              <table class="data" id="itemTable">
                <thead>
                  <tr>
                    <th style="min-width:240px">Item</th>
                    <th>Quantity</th>
                    <th class="num">CFT / item</th>
                    <th class="num">Total CFT</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${state.items.map(itemRow).join("")}
                </tbody>
              </table>
              ${state.items.length === 0 ? `<div class="empty"><h4>No items</h4><p>Add at least one item from the master list.</p></div>` : ""}
            </div>
          </div>

          <div class="card" style="margin-bottom:16px">
            <div class="card-hd">
              <h3>Additional services</h3>
              <button class="btn sm secondary" data-act="add-svc">Add extra service</button>
            </div>
            <div class="card-bd checks" id="svcList">
              ${state.selectedServices.map(serviceRow).join("") || `<div class="empty">No services configured. Add Floor Assembly / Disassembly from Rate Configuration or use Add extra service.</div>`}
            </div>
          </div>

          <div class="card">
            <div class="card-hd"><h3>Notes</h3></div>
            <div class="card-bd">
              <div class="field"><textarea name="notes" rows="3" placeholder="Internal remarks">${Helpers.escapeHtml(state.notes)}</textarea></div>
              <div class="toolbar" style="margin-top:12px">
                <button class="btn" data-act="pdf">Download PDF</button>
                <button class="btn secondary" data-act="reset">Clear quote</button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="card reco ${overflow ? "warn-card" : ""}" style="margin-bottom:16px">
            <div class="card-bd">
              <div class="k">Recommended vehicle</div>
              <div class="big">${Helpers.escapeHtml(rec.vehicle ? rec.vehicle.name : rec.message || "Select items")}</div>
              <div class="row"><span>Total volume</span><strong>${calc.totalCft.toFixed(1)} CFT</strong></div>
              <div class="row"><span>Vehicle capacity</span><strong>${rec.vehicle ? rec.vehicle.maxCft : rec.largest ? rec.largest.maxCft : "—"} CFT</strong></div>
              <div class="row"><span>${overflow ? "Overflow" : "Remaining capacity"}</span><strong>${overflow ? rec.overflow.toFixed(1) : rec.remaining.toFixed(1)} CFT</strong></div>
              <div class="row"><span>Lane</span><strong>${calc.route ? Helpers.escapeHtml(calc.route.from + " → " + calc.route.to) : Helpers.slug(state.pickup) === Helpers.slug(state.drop) && state.pickup ? "Same city" : "Not in matrix"}</strong></div>
              <div class="row"><span>Distance</span><strong>${Helpers.number(calc.distanceKm)} KM</strong></div>
              ${overflow ? `<p class="help" style="color:#f8d7c4;margin:10px 0 0">Total CFT exceeds the largest configured vehicle. Split the load or add a larger vehicle in Vehicle Master.</p>` : ""}
            </div>
          </div>

          <div class="card" style="margin-bottom:16px">
            <div class="card-hd"><h3>${state.moveType === "sharing" ? "Sharing price" : "Dedicated price"}</h3></div>
            <div class="card-bd">
              <div class="row"><span>${state.moveType === "sharing" ? "Sharing" : "Dedicated"}</span><strong>${Helpers.formatMoney(calc.total, settings.currencySymbol)}</strong></div>
              <p class="help" style="margin:10px 0 0">Only the selected move type is billed. Switch Dedicated / Sharing above to use the other lane rate.</p>
            </div>
          </div>

          <div class="card">
            <div class="card-hd"><h3>Cost breakdown</h3></div>
            <div class="card-bd table-wrap">
              <table class="data breakdown">
                <tbody>
                  <tr><td>Transport (${Helpers.escapeHtml(calc.transportFormula || "—")})</td><td class="num">${Helpers.formatMoney(calc.transportAmount, settings.currencySymbol)}</td></tr>
                  ${calc.pricingMode === "fallback" ? `<tr><td>Distance fallback (${Helpers.escapeHtml(calc.distance.formula)})</td><td class="num">${Helpers.formatMoney(calc.distance.amount, settings.currencySymbol)}</td></tr>` : ""}
                  ${calc.serviceLines.map((l) => `<tr><td>${Helpers.escapeHtml(l.name)} <span class="hint" style="color:var(--muted);font-weight:400">· ${Helpers.escapeHtml(l.formula)}</span></td><td class="num">${Helpers.formatMoney(l.amount, settings.currencySymbol)}</td></tr>`).join("")}
                  <tr class="total-row"><td>Total (${state.moveType === "sharing" ? "Sharing" : "Dedicated"})</td><td class="num">${Helpers.formatMoney(calc.total, settings.currencySymbol)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    persistDraft();
    bind(root);
    if (focusKey) {
      const el = root.querySelector(`[data-key="${focusKey}"] input[data-role=search]`);
      if (el) el.focus();
    }
  }

  function field(name, label, value, err, extra, type) {
    return `<div class="field ${extra || ""} ${err ? "has-error" : ""}">
      <label>${label}</label>
      <input name="${name}" type="${type || "text"}" value="${Helpers.escapeHtml(value)}" />
      ${err ? `<div class="err">${Helpers.escapeHtml(err)}</div>` : ""}
    </div>`;
  }

  function itemRow(row) {
    const total = Calc.calculateItemCft(row.quantity, row.cftPerItem);
    return `<tr data-key="${row.key}">
      <td>
        <div class="search-wrap">
          <input data-role="search" placeholder="Search item master…" value="${Helpers.escapeHtml(row.name)}" />
        </div>
      </td>
      <td><input class="qty" data-role="qty" type="number" min="1" step="1" value="${Helpers.escapeHtml(row.quantity)}" /></td>
      <td class="num">${Helpers.number(row.cftPerItem).toFixed(2)}</td>
      <td class="num"><strong>${total.toFixed(2)}</strong></td>
      <td><button class="btn danger-outline sm" data-act="remove-row">Remove</button></td>
    </tr>`;
  }

  function serviceRow(s) {
    return `<label class="check-row">
      <input type="checkbox" data-svc="${s.id}" ${s.enabled ? "checked" : ""} />
      <span><strong>${Helpers.escapeHtml(s.name)}</strong><br><span class="help">Fixed</span></span>
      <input type="number" min="0" step="1" data-svc-rate="${s.id}" value="${Helpers.number(s.rate)}" title="Fixed price" />
      ${s.custom ? `<button type="button" class="btn sm danger-outline" data-act="remove-svc" data-sid="${s.id}">Remove</button>` : `<span></span>`}
    </label>`;
  }

  function bind(container) {
    container.querySelectorAll("input, textarea, select").forEach((el) => {
      el.addEventListener("change", () => {
        collectForm(container);
        const row = el.closest("tr");
        if (row && el.getAttribute("data-role") === "qty") {
          const rec = state.items.find((r) => r.key === row.getAttribute("data-key"));
          if (rec) rec.quantity = Math.max(0, Helpers.number(el.value));
        }
        const svcId = el.getAttribute("data-svc");
        if (svcId) {
          const s = state.selectedServices.find((x) => x.id === svcId);
          if (s) s.enabled = el.checked;
        }
        const rateId = el.getAttribute("data-svc-rate");
        if (rateId) {
          const s = state.selectedServices.find((x) => x.id === rateId);
          if (s) {
            s.rate = Math.max(0, Helpers.number(el.value));
            s.enabled = true;
          }
        }
        paint();
      });
    });

    container.querySelectorAll("[data-role=search]").forEach((input) => {
      input.addEventListener("input", () => openSuggest(input));
      input.addEventListener("focus", () => openSuggest(input));
    });

    container.querySelector("[data-act=add-row]").addEventListener("click", () => {
      collectForm(container);
      state.items.push(emptyRow());
      paint(state.items[state.items.length - 1].key);
    });

    container.querySelectorAll("[data-act=remove-row]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.closest("tr").getAttribute("data-key");
        state.items = state.items.filter((r) => r.key !== key);
        if (!state.items.length) state.items.push(emptyRow());
        paint();
      });
    });

    const addSvc = container.querySelector("[data-act=add-svc]");
    if (addSvc) {
      addSvc.addEventListener("click", () => {
        collectForm(container);
        const name = prompt("Extra service name", "Extra service");
        if (!name || !name.trim()) return;
        const rateRaw = prompt("Fixed price", "0");
        const rate = Math.max(0, Helpers.number(rateRaw));
        state.selectedServices.push({
          id: Helpers.uid("svc"),
          name: name.trim(),
          pricingType: "fixed",
          rate,
          enabled: true,
          quantity: 1,
          custom: true,
        });
        paint();
      });
    }
    container.querySelectorAll("[data-act=remove-svc]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-sid");
        state.selectedServices = state.selectedServices.filter((s) => s.id !== id);
        paint();
      });
    });

    const pdfBtn = container.querySelector("[data-act=pdf]");
    if (pdfBtn) pdfBtn.addEventListener("click", () => downloadPdf(container));
    const resetBtn = container.querySelector("[data-act=reset]");
    if (resetBtn) resetBtn.addEventListener("click", async () => {
      const ok = await UI.confirmModal({
        title: "Clear quote",
        body: "Clear this quote? Customer and item fields will reset. Nothing is stored as an order.",
        confirmText: "Clear",
        danger: true,
      });
      if (!ok) return;
      const fresh = blankOrder();
      Object.keys(fresh).forEach((k) => {
        state[k] = fresh[k];
      });
      if (StorageService.clearDraft) StorageService.clearDraft();
      paint();
    });
  }

  function openSuggest(input) {
    document.querySelectorAll(".suggest").forEach((s) => s.remove());
    const row = state.items.find((r) => r.key === input.closest("tr").getAttribute("data-key"));
    const typed = input.value.trim();
    const selectedName = row && row.name ? String(row.name) : "";
    const q = typed && typed !== selectedName ? Helpers.slug(typed) : "";
    const all = ItemService.list(false).slice().sort((a, b) => {
      const c = String(a.category).localeCompare(String(b.category));
      return c || String(a.name).localeCompare(String(b.name));
    });
    const items = all.filter((i) => !q || Helpers.slug(i.name + " " + i.category).includes(q));

    const box = document.createElement("div");
    box.className = "suggest suggest-portal";
    const groups = {};
    items.forEach((i) => {
      const cat = i.category || "General";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(i);
    });
    if (!items.length) {
      box.innerHTML = `<div class="suggest-empty">No matching items</div>`;
    } else {
      box.innerHTML = Object.keys(groups)
        .map((cat) => {
          const rows = groups[cat]
            .map(
              (i) =>
                `<button type="button" data-id="${i.id}">
                  <span class="suggest-name">${Helpers.escapeHtml(i.name)}</span>
                  <span class="suggest-meta">${Helpers.escapeHtml(i.category)} · ${i.cft} CFT</span>
                </button>`
            )
            .join("");
          return `<div class="suggest-cat">${Helpers.escapeHtml(cat)}</div>${rows}`;
        })
        .join("");
    }

    input.parentElement.appendChild(box);
    box.style.position = "absolute";
    box.style.left = "0";
    box.style.right = "auto";
    box.style.top = "calc(100% + 6px)";
    box.style.width = Math.max(input.offsetWidth, 360) + "px";
    box.style.maxHeight = "320px";
    box.style.zIndex = "90";

    box.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const btn = e.target.closest("button[data-id]");
      if (!btn) return;
      const item = ItemService.get(btn.getAttribute("data-id"));
      const key = input.closest("tr").getAttribute("data-key");
      const rec = state.items.find((r) => r.key === key);
      if (item && rec) {
        rec.itemId = item.id;
        rec.name = item.name;
        rec.category = item.category;
        rec.unit = item.unit;
        rec.cftPerItem = item.cft;
      }
      document.querySelectorAll(".suggest").forEach((s) => s.remove());
      paint();
    });
    setTimeout(() => {
      const closer = (ev) => {
        if (!box.contains(ev.target) && ev.target !== input) {
          box.remove();
          document.removeEventListener("mousedown", closer);
        }
      };
      document.addEventListener("mousedown", closer);
    });
  }

  function downloadPdf(container) {
    collectForm(container);
    const validRows = state.items.filter((r) => r.itemId && Helpers.number(r.quantity) > 0);
    if (!validRows.length) {
      UI.toast("Add at least one item before downloading the PDF.", "error");
      return;
    }
    const calc = compute();
    const settings = SettingsService.get();
    const rec = calc.recommendation || {};
    const vehicle = rec.vehicle;
    QuotePdf.download({
      companyName: settings.companyName || "Stownest",
      companyTag: "Storage & Moving",
      quoteDate: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      bookingId: state.bookingId || "",
      customerName: state.customerName || "",
      phone: state.phone || "",
      email: state.email || "",
      pickup: state.pickup || "",
      drop: state.drop || "",
      distanceKm: Helpers.number(calc.distanceKm),
      delivery: calc.delivery || (calc.route && calc.route.delivery) || "",
      moveType: state.moveType,
      vehicleName: vehicle ? vehicle.name : "Not assigned",
      totalCft: Number(calc.totalCft || 0).toFixed(2),
      items: validRows.map((r) => ({
        name: r.name,
        quantity: r.quantity,
        cftPerItem: r.cftPerItem,
        totalCft: Calc.calculateItemCft(r.quantity, r.cftPerItem),
      })),
      services: (calc.serviceLines || []).map((l) => ({
        name: l.name,
        amount: Helpers.formatMoney(l.amount, settings.currencySymbol),
      })),
      dedicated: calc.dedicated && calc.dedicated.available ? Helpers.formatMoney(calc.dedicated.amount, settings.currencySymbol) : "-",
      sharing: calc.sharing && calc.sharing.available ? Helpers.formatMoney(calc.sharing.amount, settings.currencySymbol) : "-",
      total: Helpers.formatMoney(calc.total, settings.currencySymbol),
      transportFormula: calc.transportFormula || "",
      notes: state.notes || "",
    });
    UI.toast("Quote PDF downloaded.");
  }

  function save(status, container) {
    collectForm(container);
    state.showErrors = true;
    const errors = Validation.validateCustomer(state);
    if (errors.customerName) {
      UI.toast(errors.customerName, "error");
      paint();
      return;
    }
    const validRows = state.items.filter((r) => r.itemId && Helpers.number(r.quantity) > 0);
    if (!validRows.length) {
      UI.toast("Add at least one item with quantity greater than 0.", "error");
      return;
    }
    if (state.items.some((r) => r.itemId && Helpers.number(r.quantity) <= 0)) {
      UI.toast("Quantity must be greater than 0.", "error");
      return;
    }
    const calc = compute();
    const order = {
      ...state,
      items: validRows,
      status,
      totals: snapshotTotals(calc),
    };
    OrderService.save(order);
    StorageService.clearDraft();
    UI.toast(status === "confirmed" ? "Order saved as confirmed." : "Order saved.");
    location.hash = "#/orders/view/" + order.id;
  }

  window.addEventListener("beforeunload", persistDraft);
  persistDraft();
  paint();
};

Pages.orderDetail = function (root, id) {
  const order = OrderService.get(id);
  if (!order) {
    root.innerHTML = `<div class="empty"><h4>Order not found</h4><a class="btn" href="#/orders">Back</a></div>`;
    return;
  }
  const t = order.totals || {};
  root.innerHTML = `
    <div class="toolbar" style="margin-bottom:16px">
      <a class="btn" href="#/calculator?id=${order.id}">Edit order</a>
      <button class="btn secondary" id="dup">Duplicate</button>
      <a class="btn secondary" href="#/orders">All orders</a>
    </div>
    <div class="grid-3" style="margin-bottom:16px">
      <div class="stat"><div class="lbl">Customer</div><div class="val" style="font-size:18px">${Helpers.escapeHtml(order.customerName)}</div><div class="sub">${Helpers.escapeHtml(order.phone || "")} ${Helpers.escapeHtml(order.email || "")}</div></div>
      <div class="stat"><div class="lbl">Volume / vehicle</div><div class="val" style="font-size:18px">${Helpers.number(t.totalCft).toFixed(1)} CFT</div><div class="sub">${Helpers.escapeHtml(t.vehicleName || "—")}</div></div>
      <div class="stat"><div class="lbl">Total amount</div><div class="val">${Helpers.formatMoney(t.total)}</div><div class="sub">${Helpers.escapeHtml(order.status)}</div></div>
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-hd"><h3>Move details</h3></div>
        <div class="card-bd">
          <p><strong>Booking ID:</strong> ${Helpers.escapeHtml(order.bookingId)}</p>
          <p><strong>Move type:</strong> ${Helpers.escapeHtml((order.moveType || "dedicated") === "sharing" ? "Sharing" : "Dedicated")}</p>
          <p><strong>Pickup:</strong> ${Helpers.escapeHtml(order.pickup || "—")}</p>
          <p><strong>Drop:</strong> ${Helpers.escapeHtml(order.drop || "—")}</p>
          <p><strong>Distance:</strong> ${Helpers.number(order.distanceKm)} KM${order.totals && order.totals.delivery ? " · " + Helpers.escapeHtml(order.totals.delivery) : ""}</p>
          ${order.notes ? `<p><strong>Notes:</strong> ${Helpers.escapeHtml(order.notes)}</p>` : ""}
        </div>
      </div>
      <div class="card">
        <div class="card-hd"><h3>Items</h3></div>
        <div class="card-bd table-wrap">
          <table class="data">
            <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">CFT</th><th class="num">Total</th></tr></thead>
            <tbody>
              ${(order.items || []).map((r) => `<tr><td>${Helpers.escapeHtml(r.name)}</td><td class="num">${r.quantity}</td><td class="num">${r.cftPerItem}</td><td class="num">${Calc.calculateItemCft(r.quantity, r.cftPerItem).toFixed(2)}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  root.querySelector("#dup").addEventListener("click", () => {
    const copy = OrderService.duplicate(order.id);
    UI.toast("Order duplicated.");
    location.hash = "#/calculator?id=" + copy.id;
  });
};
