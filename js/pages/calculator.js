window.Pages = window.Pages || {};

Pages.calculator = function (root, params) {
  const DRAFT_KEY = "stownest_quote_draft";
  const cities = () => DataStore.cities();
  const aliases = DataStore.aliasMap();
  const findLane = () => Calc.findRoute(state.pickup, state.drop, DataStore.lanes(), aliases);

  const state = loadDraft() || blankOrder();

  if (!state.moveType) state.moveType = "dedicated";

  function loadDraft() {
    let draft = null;
    try {
      draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    } catch {
      draft = null;
    }
    if (!draft || typeof draft !== "object") return null;
    if (!Array.isArray(draft.selectedServices)) draft.selectedServices = [];
    draft.showErrors = false;
    if (!Array.isArray(draft.items) || !draft.items.length) draft.items = [emptyRow()];
    if (draft.moveType !== "sharing") draft.moveType = "dedicated";
    return draft;
  }

  function persistDraft() {
    const copy = { ...state, items: state.items.map((r) => ({ ...r })), selectedServices: state.selectedServices.map((s) => ({ ...s })) };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(copy));
    } catch {
      /* draft is a convenience only */
    }
  }

  function blankOrder() {
    return {
      id: Helpers.uid("qte"),
      bookingId: Helpers.quoteId(),
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
      selectedServices: [],
      discountType: "amount",
      discountValue: 0,
      showErrors: false,
    };
  }

  function emptyRow() {
    return { key: Helpers.uid("row"), itemId: "", name: "", unit: "pcs", quantity: 1, cftPerItem: 0 };
  }

  function fallbackRates() {
    const s = DataStore.settings();
    return {
      perCftRate: Helpers.number(s.perCftRate),
      ratePerKm: Helpers.number(s.ratePerKm),
      minimumCharge: Helpers.number(s.minimumCharge),
    };
  }

  function applyLaneFromLocations() {
    const lane = findLane();
    if (lane) state.distanceKm = Helpers.number(lane.km);
    return lane;
  }

  /** Services and their prices always come from the sheet; the quote only remembers which are ticked. */
  function syncServiceCatalog() {
    const byId = Object.fromEntries(state.selectedServices.map((s) => [s.id, s]));
    state.selectedServices = DataStore.services(false).map((s) => ({
      id: s.id,
      name: s.name,
      pricingType: s.pricingType || "fixed",
      rate: Helpers.number(s.rate),
      enabled: byId[s.id] ? !!byId[s.id].enabled : false,
      quantity: byId[s.id] ? Math.max(1, Helpers.number(byId[s.id].quantity, 1)) : 1,
    }));
  }

  function refreshItemCftFromMaster() {
    const items = DataStore.items(true);
    state.items.forEach((row) => {
      if (!row.itemId) return;
      const master = items.find((i) => i.id === row.itemId);
      if (master) {
        row.name = master.name;
        row.unit = master.unit;
        row.cftPerItem = Helpers.number(master.cft);
      }
    });
  }

  function compute() {
    refreshItemCftFromMaster();
    syncServiceCatalog();
    const lane = applyLaneFromLocations();
    return Calc.calculateOrderTotal({
      items: state.items,
      distanceKm: state.distanceKm,
      pickup: state.pickup,
      drop: state.drop,
      moveType: state.moveType,
      vehicles: DataStore.vehicles(false),
      distance: fallbackRates(),
      selectedServices: state.selectedServices,
      routes: DataStore.lanes(),
      aliases,
    });
  }

  /** Transport part of the price (lane / fallback). Additional services are fixed and never discounted. */
  function transportBase(calc) {
    const services = (calc.serviceLines || []).reduce((sum, l) => sum + Helpers.number(l.amount), 0);
    return Math.max(0, Helpers.number(calc.total) - services);
  }

  /** Discount is a per-quote input (not sheet data). Applies to transport only, never more than it. */
  function discountFor(subtotal) {
    const v = Math.max(0, Helpers.number(state.discountValue));
    const amt = state.discountType === "percent" ? (subtotal * Math.min(v, 100)) / 100 : Math.min(v, subtotal);
    return Math.round(amt); // whole rupees
  }

  function deliveryText(calc) {
    if (calc.delivery) return calc.delivery;
    if (calc.route && calc.route.delivery) return calc.route.delivery;
    return "To be confirmed";
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
    const lane = findLane();
    if (lane) state.distanceKm = Helpers.number(lane.km);
    else state.distanceKm = Helpers.number(kmInput.value);
    state.notes = container.querySelector("[name=notes]").value;
    const dType = container.querySelector("[name=discountType]");
    const dVal = container.querySelector("[name=discountValue]");
    if (dType) state.discountType = dType.value === "percent" ? "percent" : "amount";
    if (dVal) state.discountValue = Math.max(0, Helpers.number(dVal.value));
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
    const errors = {};
    const rec = calc.recommendation;
    const overflow = rec.status === "overflow";
    const settings = DataStore.settings();
    const discount = discountFor(transportBase(calc));
    const finalTotal = Math.max(0, calc.total - discount);
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
                ${field("bookingId", "Quote ID", state.bookingId)}
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
                      ? "Auto-filled from the Lanes sheet (" + Helpers.number(calc.distanceKm) + " KM" + (calc.delivery ? ", " + Helpers.escapeHtml(calc.delivery) : "") + ")"
                      : "No lane for this pair in the Lanes sheet — type KM to use fallback pricing."
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
            </div>
            <div class="card-bd checks" id="svcList">
              ${state.selectedServices.map(serviceRow).join("") || `<div class="empty">No active services in the Services sheet.</div>`}
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
              ${overflow ? `<p class="help" style="color:#f8d7c4;margin:10px 0 0">Total CFT exceeds the largest configured vehicle. Split the load, or add a larger vehicle to the Vehicles sheet.</p>` : ""}
            </div>
          </div>

          <div class="card" style="margin-bottom:16px">
            <div class="card-hd"><h3>${state.moveType === "sharing" ? "Sharing price" : "Dedicated price"}</h3></div>
            <div class="card-bd">
              <div class="price-hero">${Helpers.formatMoney(finalTotal, settings.currencySymbol)}</div>
              ${discount > 0 ? `<div class="help">Includes ${Helpers.formatMoney(discount, settings.currencySymbol)} discount on transport</div>` : ""}
              <div class="delivery-pill">🚚 Estimated delivery: <strong>${Helpers.escapeHtml(deliveryText(calc))}</strong></div>
              <p class="help" style="margin:10px 0 0">Only the selected move type is billed. Switch Dedicated / Sharing above to use the other lane rate.</p>
            </div>
          </div>

          <div class="card">
            <div class="card-hd"><h3>Cost breakdown</h3></div>
            <div class="card-bd table-wrap">
              <table class="data breakdown">
                <tbody>
                  <tr><td>Transport (${Helpers.escapeHtml(calc.pricingMode === "fallback" ? calc.totalCft.toFixed(1) + " CFT × " + calc.perCftRate : calc.transportFormula || "—")})</td><td class="num">${Helpers.formatMoney(calc.pricingMode === "fallback" ? calc.cftCharge : calc.transportAmount, settings.currencySymbol)}</td></tr>
                  ${calc.pricingMode === "fallback" ? `<tr><td>Distance fallback (${Helpers.escapeHtml(calc.distance.formula)})</td><td class="num">${Helpers.formatMoney(calc.distance.amount, settings.currencySymbol)}</td></tr>` : ""}
                  <tr class="discount-row">
                    <td>
                      <div class="discount-field">
                        <span>Discount <small class="help">on transport</small></span>
                        <select name="discountType" aria-label="Discount type">
                          <option value="amount" ${state.discountType !== "percent" ? "selected" : ""}>${Helpers.escapeHtml(settings.currencySymbol || "₹")}</option>
                          <option value="percent" ${state.discountType === "percent" ? "selected" : ""}>%</option>
                        </select>
                        <input name="discountValue" type="number" min="0" step="any" inputmode="decimal" value="${Helpers.number(state.discountValue) || ""}" placeholder="0" />
                      </div>
                    </td>
                    <td class="num">${discount > 0 ? "− " + Helpers.formatMoney(discount, settings.currencySymbol) : Helpers.formatMoney(0, settings.currencySymbol)}</td>
                  </tr>
                  ${discount > 0 ? `<tr class="subtotal-row"><td>Transport after discount</td><td class="num">${Helpers.formatMoney(transportBase(calc) - discount, settings.currencySymbol)}</td></tr>` : ""}
                  ${calc.serviceLines.map((l) => `<tr class="svc-row"><td>${Helpers.escapeHtml(l.name)} <span class="hint" style="color:var(--muted);font-weight:400">· ${Helpers.escapeHtml(l.formula)}</span></td><td class="num">${Helpers.formatMoney(l.amount, settings.currencySymbol)}</td></tr>`).join("")}
                  <tr class="total-row"><td>Final price (${state.moveType === "sharing" ? "Sharing" : "Dedicated"})</td><td class="num">${Helpers.formatMoney(finalTotal, settings.currencySymbol)}</td></tr>
                  <tr><td colspan="2" class="help">Estimated delivery: <strong>${Helpers.escapeHtml(deliveryText(calc))}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div class="mobile-bar">
        <div class="mobile-bar-total">
          <span>${state.moveType === "sharing" ? "Sharing" : "Dedicated"} · ${Helpers.escapeHtml(rec.vehicle ? rec.vehicle.name : "—")}</span>
          <strong>${Helpers.formatMoney(finalTotal, settings.currencySymbol)}</strong>
        </div>
        <button class="btn" data-act="pdf-bar">Download PDF</button>
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
    const price = s.pricingType === "percentage" ? Helpers.number(s.rate) + "%" : Helpers.formatMoney(s.rate);
    const hours =
      s.pricingType === "per_hour"
        ? `<input type="number" class="hours" min="1" step="1" data-svc-hours="${s.id}" value="${Helpers.number(s.quantity, 1)}" title="Hours" />`
        : `<span></span>`;
    return `<label class="check-row">
      <input type="checkbox" data-svc="${s.id}" ${s.enabled ? "checked" : ""} />
      <span><strong>${Helpers.escapeHtml(s.name)}</strong><br><span class="help">${Helpers.escapeHtml(Helpers.pricingTypeLabel(s.pricingType))}</span></span>
      ${hours}
      <span class="price">${price}</span>
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
        const hoursId = el.getAttribute("data-svc-hours");
        if (hoursId) {
          const s = state.selectedServices.find((x) => x.id === hoursId);
          if (s) {
            s.quantity = Math.max(1, Helpers.number(el.value, 1));
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

    const barPdf = container.querySelector("[data-act=pdf-bar]");
    if (barPdf) barPdf.addEventListener("click", () => {
      const main = container.querySelector("[data-act=pdf]");
      if (main) main.click();
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
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      paint();
    });
  }

  function openSuggest(input) {
    document.querySelectorAll(".suggest").forEach((s) => s.remove());
    const row = state.items.find((r) => r.key === input.closest("tr").getAttribute("data-key"));
    const typed = input.value.trim();
    const selectedName = row && row.name ? String(row.name) : "";
    const q = typed && typed !== selectedName ? Helpers.slug(typed) : "";
    const all = DataStore.items(false)
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const items = all.filter((i) => !q || Helpers.slug(i.name).includes(q));

    const box = document.createElement("div");
    box.className = "suggest suggest-portal";
    box.innerHTML = items.length
      ? items
          .map(
            (i) =>
              `<button type="button" data-id="${i.id}">
                <span class="suggest-name">${Helpers.escapeHtml(i.name)}</span>
                <span class="suggest-meta">${i.cft} CFT</span>
              </button>`
          )
          .join("")
      : `<div class="suggest-empty">No matching items</div>`;

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
      const item = DataStore.item(btn.getAttribute("data-id"));
      const key = input.closest("tr").getAttribute("data-key");
      const rec = state.items.find((r) => r.key === key);
      if (item && rec) {
        rec.itemId = item.id;
        rec.name = item.name;
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

  async function downloadPdf(container) {
    collectForm(container);
    const validRows = state.items.filter((r) => r.itemId && Helpers.number(r.quantity) > 0);
    const missing = [];
    if (!String(state.customerName || "").trim()) missing.push("customer name");
    if (!state.pickup || !state.drop) missing.push("pickup and drop city");
    if (!validRows.length) missing.push("at least one item");
    if (missing.length) {
      UI.toast("Add " + missing.join(", ") + " before downloading the PDF.", "error");
      return;
    }
    const calc = compute();
    if (calc.pricingMode === "unavailable") {
      UI.toast(calc.transportFormula + ". Switch move type or check the Lanes sheet.", "error");
      return;
    }
    const s = DataStore.settings();
    const rec = calc.recommendation || {};
    const vehicle = rec.vehicle;
    const today = new Date();
    const fmt = (d) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const validDays = Helpers.number(s.quoteValidityDays);
    const typeLabel = state.moveType === "sharing" ? "Sharing" : "Dedicated";

    const btn = container.querySelector("[data-act=pdf]");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Preparing PDF…";
    }
    try {
      const file = await QuotePdf.download({
        companyName: s.companyName || "StowNest",
        companyTag: s.companyTagline || "Storage & Moving",
        companyAddress: s.companyAddress || "",
        companyPhone: s.companyPhone || "",
        companyEmail: s.companyEmail || "",
        companyWebsite: s.companyWebsite || "",
        companyGstin: s.companyGstin || "",
        currencySymbol: s.currencySymbol || "₹",
        terms: s.quoteTerms || "",
        quoteDate: fmt(today),
        validUntil: validDays > 0 ? fmt(new Date(today.getTime() + validDays * 86400000)) : "",
        bookingId: state.bookingId || "",
        customerName: state.customerName || "",
        phone: state.phone || "",
        email: state.email || "",
        pickup: state.pickup || "",
        drop: state.drop || "",
        distanceKm: Helpers.number(calc.distanceKm),
        delivery: deliveryText(calc),
        moveType: state.moveType,
        vehicleName: vehicle ? vehicle.name : rec.message || "Not assigned",
        vehicleCapacity: vehicle ? Helpers.number(vehicle.maxCft) : 0,
        overflow: rec.status === "overflow",
        totalCft: calc.totalCft,
        items: validRows.map((r) => ({
          name: r.name,
          quantity: Helpers.number(r.quantity),
          cftPerItem: Helpers.number(r.cftPerItem),
          totalCft: Calc.calculateItemCft(r.quantity, r.cftPerItem),
        })),
        transportLabel:
          calc.pricingMode === "route" && vehicle
            ? "Transport — " + vehicle.name + ", " + typeLabel + " (" + calc.route.from + " → " + calc.route.to + ")"
            : "Transport — volume charge (" + calc.totalCft.toFixed(1) + " CFT × " + calc.perCftRate + ")",
        transportAmount: calc.pricingMode === "route" ? calc.transportAmount : calc.cftCharge,
        fallbackDistanceAmount: calc.pricingMode === "fallback" ? calc.distance.amount : 0,
        fallbackDistanceLabel: "Distance charge (" + Helpers.number(calc.distanceKm) + " KM × " + calc.distance.rate + ")",
        services: (calc.serviceLines || []).map((l) => ({
          name: l.name,
          detail: l.pricingType === "fixed" ? "" : l.formula,
          amount: l.amount,
        })),
        discount: discountFor(transportBase(calc)),
        discountLabel: "Discount on transport" + (state.discountType === "percent" ? " (" + Math.min(100, Helpers.number(state.discountValue)) + "%)" : ""),
        total: Math.max(0, calc.total - discountFor(transportBase(calc))),
        notes: state.notes || "",
      });
      UI.toast("Downloaded " + file);
    } catch (err) {
      console.error(err);
      UI.toast("Could not create the PDF: " + (err.message || err), "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Download PDF";
      }
    }
  }

  paint();
};
