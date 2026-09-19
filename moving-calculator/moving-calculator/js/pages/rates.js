window.Pages = window.Pages || {};

Pages.rates = function (root) {
  function paint() {
    const services = RateService.listServices(true);

    root.innerHTML = `
      <div class="card">
        <div class="card-hd">
          <h3>Extra services</h3>
          <button class="btn" id="addSvc">Add service</button>
        </div>
        <div class="card-bd table-wrap">
          <table class="data">
            <thead><tr><th>Service</th><th>Pricing type</th><th class="num">Rate</th><th>Active</th><th></th></tr></thead>
            <tbody>
              ${services
                .map(
                  (s) => `<tr>
                  <td>${Helpers.escapeHtml(s.name)}</td>
                  <td>${Helpers.pricingTypeLabel(s.pricingType)}</td>
                  <td class="num">${s.pricingType === "percentage" ? s.rate + "%" : Helpers.formatMoney(s.rate)}</td>
                  <td><span class="badge ${s.active === false ? "muted" : "ok"}">${s.active === false ? "No" : "Yes"}</span></td>
                  <td>
                    <button class="btn sm secondary" data-edit="${s.id}">Edit</button>
                    <button class="btn sm danger-outline" data-del="${s.id}">Delete</button>
                  </td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const addCity = root.querySelector("#addCity");
    if (addCity) {
      addCity.addEventListener("click", () => {
        const name = prompt("City name", "");
        if (!name || !name.trim()) return;
        RouteService.addCity(name.trim());
        UI.toast("City added. It now shows in Pickup / Drop.");
        paint();
      });
    }
    root.querySelectorAll("[data-del-city]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const name = btn.getAttribute("data-del-city");
        const ok = await UI.confirmModal({
          title: "Remove city",
          body: "Remove " + name + " from the city list? Existing lanes stay until you delete them.",
          confirmText: "Remove",
          danger: true,
        });
        if (ok) {
          RouteService.removeCity(name);
          paint();
        }
      });
    });
    const addLane = root.querySelector("#addLane");
    if (addLane) addLane.addEventListener("click", () => openLane());
    root.querySelectorAll("[data-edit-lane]").forEach((b) => {
      b.addEventListener("click", () => openLane(RouteService.get(b.getAttribute("data-edit-lane"))));
    });
    root.querySelectorAll("[data-del-lane]").forEach((b) =>
      b.addEventListener("click", async () => {
        const ok = await UI.confirmModal({
          title: "Delete lane",
          body: "Remove this city pair and its prices?",
          confirmText: "Delete",
          danger: true,
        });
        if (ok) {
          RouteService.remove(b.getAttribute("data-del-lane"));
          UI.toast("Lane deleted.");
          paint();
        }
      })
    );
    const reload = root.querySelector("#reloadRoutes");
    if (reload) {
      reload.addEventListener("click", async () => {
        const ok = await UI.confirmModal({
          title: "Reload sheet matrix",
          body: "Replace all cities and lanes with the original sheet?",
          confirmText: "Reload",
          danger: true,
        });
        if (!ok) return;
        StorageService.setRoutes(structuredClone(AppDefaults.routes));
        StorageService.setCities(structuredClone(AppDefaults.cities));
        UI.toast("Intercity matrix reloaded from sheet defaults.");
        paint();
      });
    }
    root.querySelector("#addSvc").addEventListener("click", () => openService());
    root.querySelectorAll("[data-edit]").forEach((b) => {
      b.addEventListener("click", () => {
        const s = RateService.listServices(true).find((x) => x.id === b.getAttribute("data-edit"));
        openService(s);
      });
    });
    root.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", async () => {
        const ok = await UI.confirmModal({
          title: "Delete service",
          body: "Remove this service from rate configuration?",
          confirmText: "Delete",
          danger: true,
        });
        if (ok) {
          RateService.removeService(b.getAttribute("data-del"));
          UI.toast("Service deleted.");
          paint();
        }
      })
    );
  }


  function openLane(existing) {
    const isNew = !existing;
    const vehs = VehicleService.list(false).slice().sort((a, b) => Helpers.number(a.maxCft) - Helpers.number(b.maxCft));
    const prices = RouteService.emptyPrices();
    const draft = existing
      ? {
          ...existing,
          dedicated: { ...prices.dedicated, ...(existing.dedicated || {}) },
          sharing: { ...prices.sharing, ...(existing.sharing || {}) },
        }
      : {
          id: Helpers.uid("rt"),
          from: "",
          to: "",
          km: 0,
          delivery: "",
          dedicated: prices.dedicated,
          sharing: prices.sharing,
        };
    const cityOpts = RouteService.cities();
    const wrap = document.createElement("div");
    wrap.className = "modal-back";
    wrap.innerHTML = `
      <div class="modal" style="max-width:720px">
        <header><h3>${isNew ? "Add lane" : "Edit lane"}</h3></header>
        <div class="body">
          <div class="form-grid form-grid-2">
            <div class="field"><label>From city</label><input id="from" list="cityList" value="${Helpers.escapeHtml(draft.from)}" /></div>
            <div class="field"><label>To city</label><input id="to" list="cityList" value="${Helpers.escapeHtml(draft.to)}" /></div>
            <div class="field"><label>Distance KM</label><input id="km" type="number" min="0" value="${Helpers.number(draft.km)}" /></div>
            <div class="field"><label>Delivery time</label><input id="delivery" value="${Helpers.escapeHtml(draft.delivery || "")}" placeholder="e.g. 2 Days" /></div>
          </div>
          <datalist id="cityList">${cityOpts.map((c) => `<option value="${Helpers.escapeHtml(c)}">`).join("")}</datalist>
          <p class="help" style="margin:12px 0">Set 0 if that vehicle size is not offered on this lane. New vehicle sizes from Vehicle Master appear here automatically.</p>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Vehicle</th><th class="num">Max CFT</th><th class="num">Dedicated ₹</th><th class="num">Sharing ₹</th></tr></thead>
              <tbody>
                ${vehs
                  .map(
                    (v) => `<tr>
                    <td>${Helpers.escapeHtml(v.name)}</td>
                    <td class="num">${v.maxCft}</td>
                    <td><input data-d="${v.id}" type="number" min="0" value="${Helpers.number((draft.dedicated || {})[v.id])}" /></td>
                    <td><input data-s="${v.id}" type="number" min="0" value="${Helpers.number((draft.sharing || {})[v.id])}" /></td>
                  </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
        <footer>
          <button class="btn secondary" data-a="no">Cancel</button>
          <button class="btn" data-a="yes">Save lane</button>
        </footer>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || e.target.getAttribute("data-a") === "no") wrap.remove();
      if (e.target.getAttribute("data-a") === "yes") {
        const from = wrap.querySelector("#from").value.trim();
        const to = wrap.querySelector("#to").value.trim();
        if (!from || !to) {
          UI.toast("From and To cities are required.", "error");
          return;
        }
        if (Helpers.slug(from) === Helpers.slug(to)) {
          UI.toast("Pickup and drop must be different cities.", "error");
          return;
        }
        const dedicated = {};
        const sharing = {};
        vehs.forEach((v) => {
          dedicated[v.id] = Helpers.number(wrap.querySelector('[data-d="' + v.id + '"]').value);
          sharing[v.id] = Helpers.number(wrap.querySelector('[data-s="' + v.id + '"]').value);
        });
        RouteService.addCity(from);
        RouteService.addCity(to);
        RouteService.save({
          ...draft,
          from,
          to,
          km: Helpers.number(wrap.querySelector("#km").value),
          delivery: wrap.querySelector("#delivery").value.trim(),
          dedicated,
          sharing,
        });
        UI.toast("Lane saved. Calculator will use this KM and these prices.");
        wrap.remove();
        paint();
      }
    });
  }

  function openService(s) {
    const isNew = !s;
    const draft = s
      ? { ...s }
      : { id: Helpers.uid("svc"), name: "", pricingType: "fixed", rate: 0, active: true };
    const wrap = document.createElement("div");
    wrap.className = "modal-back";
    wrap.innerHTML = `
      <div class="modal">
        <header><h3>${isNew ? "Add service" : "Edit service"}</h3></header>
        <div class="body">
          <div class="field" id="f-name"><label>Service name</label><input id="name" value="${Helpers.escapeHtml(draft.name)}" /></div>
          <div class="field"><label>Pricing type</label>
            <select id="type">
              ${["fixed", "per_item", "per_box", "per_km", "per_hour", "percentage"]
                .map((t) => `<option value="${t}" ${draft.pricingType === t ? "selected" : ""}>${Helpers.pricingTypeLabel(t)}</option>`)
                .join("")}
            </select>
          </div>
          <div class="field" id="f-rate"><label>Rate</label><input id="rate" type="number" min="0" step="0.01" value="${draft.rate}" /></div>
          <label class="check-row" style="grid-template-columns:22px 1fr"><input id="active" type="checkbox" ${draft.active === false ? "" : "checked"} /> <span>Active</span></label>
        </div>
        <footer>
          <button class="btn secondary" data-a="no">Cancel</button>
          <button class="btn" data-a="yes">Save</button>
        </footer>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || e.target.getAttribute("data-a") === "no") wrap.remove();
      if (e.target.getAttribute("data-a") === "yes") {
        const next = {
          ...draft,
          name: wrap.querySelector("#name").value.trim(),
          pricingType: wrap.querySelector("#type").value,
          rate: Helpers.number(wrap.querySelector("#rate").value),
          active: wrap.querySelector("#active").checked,
        };
        const errors = Validation.validateService(next, RateService.listServices(true), next.id);
        wrap.querySelectorAll(".err").forEach((n) => n.remove());
        if (Object.keys(errors).length) {
          if (errors.name) wrap.querySelector("#f-name").insertAdjacentHTML("beforeend", `<div class="err">${errors.name}</div>`);
          if (errors.rate) wrap.querySelector("#f-rate").insertAdjacentHTML("beforeend", `<div class="err">${errors.rate}</div>`);
          return;
        }
        RateService.saveService(next);
        UI.toast("Service saved.");
        wrap.remove();
        paint();
      }
    });
  }

  paint();
};
