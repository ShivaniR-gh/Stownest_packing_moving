window.Pages = window.Pages || {};

Pages.routes = function (root) {
  function vehicles() {
    return VehicleService.list(false).slice().sort((a, b) => Helpers.number(a.maxCft) - Helpers.number(b.maxCft));
  }

  function paint() {
    const cities = RouteService.cities();
    const lanes = RouteService.list().slice().sort((a, b) => String(a.from).localeCompare(String(b.from)) || String(a.to).localeCompare(String(b.to)));
    const vehs = vehicles();

    root.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="card-hd">
          <h3>Cities</h3>
          <button class="btn" id="addCity">Add city</button>
        </div>
        <div class="card-bd help">Cities appear in Pickup / Drop on the calculator. Add a city once, then create lanes with KM and prices.</div>
        <div class="card-bd" style="display:flex;flex-wrap:wrap;gap:8px">
          ${cities.map((c) => `<span class="badge ok" style="display:inline-flex;gap:8px;align-items:center">${Helpers.escapeHtml(c)} <button class="btn sm danger-outline" data-del-city="${Helpers.escapeHtml(c)}">×</button></span>`).join("") || `<span class="help">No cities yet.</span>`}
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <h3>City lanes (KM + Dedicated / Sharing prices)</h3>
          <div class="toolbar">
            <button class="btn" id="addLane">Add lane</button>
            <button class="btn secondary" id="reloadLanes">Reload sheet lanes</button>
          </div>
        </div>
        <div class="card-bd help">Example: Bangalore → Chennai, 360 KM, then a Dedicated and Sharing price for each vehicle. Calculator auto-fills KM when both cities match a lane (either direction). Add vehicles under Vehicle Master — new sizes show up here so you can price them.</div>
        <div class="card-bd table-wrap" style="padding-top:0;overflow:auto">
          <table class="data">
            <thead>
              <tr>
                <th>From</th><th>To</th><th class="num">KM</th><th>Delivery</th>
                ${vehs.map((v) => `<th class="num">${Helpers.escapeHtml(v.name)}<br><span class="help">${v.maxCft} CFT · Ded / Share</span></th>`).join("")}
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${
                lanes.length
                  ? lanes
                      .map((r) => `<tr>
                        <td>${Helpers.escapeHtml(r.from)}</td>
                        <td>${Helpers.escapeHtml(r.to)}</td>
                        <td class="num">${Helpers.number(r.km)}</td>
                        <td>${Helpers.escapeHtml(r.delivery || "")}</td>
                        ${vehs
                          .map((v) => {
                            const d = Helpers.number((r.dedicated || {})[v.id]);
                            const s = Helpers.number((r.sharing || {})[v.id]);
                            return `<td class="num">${d ? Helpers.formatMoney(d) : "—"}<br><span class="help">${s ? Helpers.formatMoney(s) : "—"}</span></td>`;
                          })
                          .join("")}
                        <td>
                          <button class="btn sm secondary" data-edit="${r.id}">Edit</button>
                          <button class="btn sm danger-outline" data-del="${r.id}">Delete</button>
                        </td>
                      </tr>`)
                      .join("")
                  : `<tr><td colspan="${5 + vehs.length}"><div class="empty">No lanes. Add Bangalore → Chennai with 360 KM to start.</div></td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    root.querySelector("#addCity").addEventListener("click", () => {
      const name = prompt("City name", "");
      if (!name || !name.trim()) return;
      RouteService.addCity(name.trim());
      UI.toast("City added.");
      paint();
    });
    root.querySelectorAll("[data-del-city]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const name = btn.getAttribute("data-del-city");
        const ok = await UI.confirmModal({
          title: "Remove city",
          body: "Remove " + name + " from the city list? Existing lanes are kept until you delete them.",
          confirmText: "Remove",
          danger: true,
        });
        if (ok) {
          RouteService.removeCity(name);
          paint();
        }
      });
    });
    root.querySelector("#addLane").addEventListener("click", () => openLane());
    root.querySelector("#reloadLanes").addEventListener("click", async () => {
      const ok = await UI.confirmModal({
        title: "Reload sheet lanes",
        body: "Replace all lanes and cities with the original sheet matrix?",
        confirmText: "Reload",
        danger: true,
      });
      if (ok) {
        StorageService.setRoutes(structuredClone(AppDefaults.routes));
        StorageService.setCities(structuredClone(AppDefaults.cities));
        UI.toast("Lanes reloaded.");
        paint();
      }
    });
    root.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openLane(RouteService.get(b.getAttribute("data-edit")))));
    root.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", async () => {
        const ok = await UI.confirmModal({
          title: "Delete lane",
          body: "Remove this city pair and its prices?",
          confirmText: "Delete",
          danger: true,
        });
        if (ok) {
          RouteService.remove(b.getAttribute("data-del"));
          UI.toast("Lane deleted.");
          paint();
        }
      })
    );
  }

  function openLane(existing) {
    const isNew = !existing;
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
    const vehs = vehicles();
    const wrap = document.createElement("div");
    wrap.className = "modal-back";
    wrap.innerHTML = `
      <div class="modal" style="max-width:720px">
        <header><h3>${isNew ? "Add lane" : "Edit lane"}</h3></header>
        <div class="body">
          <div class="form-grid form-grid-2">
            <div class="field"><label>From</label>
              <input id="from" list="cityList" value="${Helpers.escapeHtml(draft.from)}" />
            </div>
            <div class="field"><label>To</label>
              <input id="to" list="cityList" value="${Helpers.escapeHtml(draft.to)}" />
            </div>
            <div class="field"><label>Distance KM</label><input id="km" type="number" min="0" value="${Helpers.number(draft.km)}" /></div>
            <div class="field"><label>Delivery time</label><input id="delivery" value="${Helpers.escapeHtml(draft.delivery || "")}" placeholder="e.g. 2 Days" /></div>
          </div>
          <datalist id="cityList">${cityOpts.map((c) => `<option value="${Helpers.escapeHtml(c)}">`).join("")}</datalist>
          <p class="help" style="margin:12px 0">Set 0 if that vehicle size is not offered on this lane.</p>
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
          dedicated[v.id] = Helpers.number(wrap.querySelector(`[data-d="${v.id}"]`).value);
          sharing[v.id] = Helpers.number(wrap.querySelector(`[data-s="${v.id}"]`).value);
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
        UI.toast("Lane saved. Calculator will auto-fill this KM.");
        wrap.remove();
        paint();
      }
    });
  }

  paint();
};
