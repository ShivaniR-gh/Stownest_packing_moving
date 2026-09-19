window.Pages = window.Pages || {};

Pages.vehicles = function (root) {
  function paint() {
    const list = VehicleService.list(true)
      .slice()
      .sort((a, b) => Helpers.number(a.maxCft) - Helpers.number(b.maxCft));
    root.innerHTML = `
      <div class="card">
        <div class="card-hd">
          <h3>Vehicle capacity master</h3>
          <button class="btn" id="add">Add vehicle</button>
        </div>
        <div class="card-bd help">The calculator picks the smallest active vehicle whose maximum CFT is greater than or equal to the order volume. Capacities and floor prices are not hardcoded.</div>
        <div class="card-bd table-wrap" style="padding-top:0">
          <table class="data">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th class="num">Maximum CFT</th>
                <th class="num">Floor / base price</th>
                <th class="num">Additional CFT rate</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${list
                .map(
                  (v) => `<tr>
                  <td>${Helpers.escapeHtml(v.name)}</td>
                  <td class="num">${Helpers.number(v.maxCft)}</td>
                  <td class="num">${Helpers.formatMoney(v.basePrice)}</td>
                  <td class="num">${Helpers.formatMoney(v.additionalCftRate)}</td>
                  <td><span class="badge ${v.active === false ? "muted" : "ok"}">${v.active === false ? "No" : "Yes"}</span></td>
                  <td>
                    <button class="btn sm secondary" data-edit="${v.id}">Edit</button>
                    <button class="btn sm danger-outline" data-del="${v.id}">Delete</button>
                  </td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
    root.querySelector("#add").addEventListener("click", () => openForm());
    root.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openForm(VehicleService.get(b.getAttribute("data-edit")))));
    root.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", async () => {
        const ok = await UI.confirmModal({
          title: "Delete vehicle",
          body: "Remove this vehicle from the recommendation list?",
          confirmText: "Delete",
          danger: true,
        });
        if (ok) {
          VehicleService.remove(b.getAttribute("data-del"));
          UI.toast("Vehicle deleted.");
          paint();
        }
      })
    );
  }

  function openForm(v) {
    const isNew = !v;
    const draft = v
      ? { ...v }
      : { id: Helpers.uid("veh"), name: "", maxCft: 0, basePrice: 0, additionalCftRate: 0, active: true };
    const wrap = document.createElement("div");
    wrap.className = "modal-back";
    wrap.innerHTML = `
      <div class="modal">
        <header><h3>${isNew ? "Add vehicle" : "Edit vehicle"}</h3></header>
        <div class="body">
          <div class="field" id="f-name"><label>Vehicle name</label><input id="name" value="${Helpers.escapeHtml(draft.name)}" placeholder="e.g. 8 FT Vehicle" /></div>
          <div class="field" id="f-cft"><label>Maximum CFT</label><input id="maxCft" type="number" min="0" step="1" value="${draft.maxCft}" /></div>
          <div class="field" id="f-base"><label>Floor / base price</label><input id="basePrice" type="number" min="0" step="1" value="${draft.basePrice}" /></div>
          <div class="field" id="f-extra"><label>Additional CFT rate</label><input id="additionalCftRate" type="number" min="0" step="1" value="${draft.additionalCftRate}" /></div>
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
          maxCft: Helpers.number(wrap.querySelector("#maxCft").value),
          basePrice: Helpers.number(wrap.querySelector("#basePrice").value),
          additionalCftRate: Helpers.number(wrap.querySelector("#additionalCftRate").value),
          active: wrap.querySelector("#active").checked,
        };
        const errors = Validation.validateVehicle(next, VehicleService.list(true), next.id);
        wrap.querySelectorAll(".err").forEach((n) => n.remove());
        if (Object.keys(errors).length) {
          Object.entries(errors).forEach(([k, msg]) => {
            const map = { name: "f-name", maxCft: "f-cft", basePrice: "f-base", additionalCftRate: "f-extra" };
            const f = wrap.querySelector("#" + map[k]);
            if (f) f.insertAdjacentHTML("beforeend", `<div class="err">${msg}</div>`);
          });
          return;
        }
        VehicleService.save(next);
        UI.toast("Vehicle saved.");
        wrap.remove();
        paint();
      }
    });
  }

  paint();
};
