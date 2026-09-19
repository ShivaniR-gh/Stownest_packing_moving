window.Pages = window.Pages || {};

Pages.items = function (root) {
  let q = "";
  let category = "all";

  function paint() {
    const all = ItemService.list(true);
    const cats = ["all", ...ItemService.categories()];
    const list = all.filter((i) => {
      const okQ = !q || Helpers.slug(i.name + " " + i.category).includes(Helpers.slug(q));
      const okC = category === "all" || i.category === category;
      return okQ && okC;
    });

    root.innerHTML = `
      <div class="card">
        <div class="card-hd">
          <h3>Item / CFT master</h3>
          <div class="toolbar">
            <input type="search" id="iq" placeholder="Search items…" value="${Helpers.escapeHtml(q)}" />
            <select id="ic">
              ${cats.map((c) => `<option value="${Helpers.escapeHtml(c)}" ${c === category ? "selected" : ""}>${c === "all" ? "All categories" : Helpers.escapeHtml(c)}</option>`).join("")}
            </select>
            <button class="btn secondary" id="reloadCat">Reload sheet catalogue</button>
            <button class="btn" id="add">Add item</button>
          </div>
        </div>
        <div class="card-bd help">The calculator always reads CFT from this list. Changing a value here updates every new calculation immediately after you return to the Order Calculator.</div>
        <div class="card-bd table-wrap" style="padding-top:0">
          <table class="data">
            <thead>
              <tr><th>Item name</th><th>Category</th><th class="num">CFT</th><th>Unit</th><th>Active</th><th></th></tr>
            </thead>
            <tbody>
              ${
                list.length
                  ? list
                      .map(
                        (i) => `<tr>
                    <td>${Helpers.escapeHtml(i.name)}</td>
                    <td>${Helpers.escapeHtml(i.category)}</td>
                    <td class="num">${Helpers.number(i.cft)}</td>
                    <td>${Helpers.escapeHtml(i.unit || "pcs")}</td>
                    <td><span class="badge ${i.active === false ? "muted" : "ok"}">${i.active === false ? "No" : "Yes"}</span></td>
                    <td>
                      <button class="btn sm secondary" data-edit="${i.id}">Edit</button>
                      <button class="btn sm danger-outline" data-del="${i.id}">Delete</button>
                    </td>
                  </tr>`
                      )
                      .join("")
                  : `<tr><td colspan="6"><div class="empty">No items match.</div></td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    root.querySelector("#iq").addEventListener("input", (e) => {
      q = e.target.value;
      paint();
      const el = root.querySelector("#iq");
      el.focus();
      el.setSelectionRange(q.length, q.length);
    });
    root.querySelector("#ic").addEventListener("change", (e) => {
      category = e.target.value;
      paint();
    });
    root.querySelector("#reloadCat").addEventListener("click", () => {
      StorageService.setItems(structuredClone(AppDefaults.items));
      localStorage.setItem(StorageService.keys.seedVersion, String(AppDefaults.seedVersion || 3));
      UI.toast("Sheet catalogue loaded (" + AppDefaults.items.length + " items).");
      paint();
    });
    root.querySelector("#add").addEventListener("click", () => openForm());
    root.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openForm(ItemService.get(b.getAttribute("data-edit")))));
    root.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", async () => {
        const ok = await UI.confirmModal({
          title: "Delete item",
          body: "Remove this item from the master? Existing saved orders keep their snapshot CFT.",
          confirmText: "Delete",
          danger: true,
        });
        if (ok) {
          ItemService.remove(b.getAttribute("data-del"));
          UI.toast("Item deleted.");
          paint();
        }
      })
    );
  }

  function openForm(item) {
    const isNew = !item;
    const draft = item
      ? { ...item }
      : { id: Helpers.uid("itm"), name: "", category: "Living Room", cft: 0, unit: "pcs", active: true };
    const wrap = document.createElement("div");
    wrap.className = "modal-back";
    wrap.innerHTML = `
      <div class="modal">
        <header><h3>${isNew ? "Add item" : "Edit item"}</h3></header>
        <div class="body">
          <div class="field" id="f-name"><label>Item name</label><input id="name" value="${Helpers.escapeHtml(draft.name)}" /></div>
          <div class="field"><label>Category</label><input id="category" list="cats" value="${Helpers.escapeHtml(draft.category)}" />
            <datalist id="cats">${ItemService.categories().map((c) => `<option value="${Helpers.escapeHtml(c)}">`).join("")}</datalist>
          </div>
          <div class="field" id="f-cft"><label>CFT per item</label><input id="cft" type="number" min="0" step="0.1" value="${draft.cft}" /></div>
          <div class="field"><label>Unit</label>
            <select id="unit">
              <option value="pcs" ${draft.unit === "pcs" ? "selected" : ""}>pcs</option>
              <option value="box" ${draft.unit === "box" ? "selected" : ""}>box</option>
              <option value="set" ${draft.unit === "set" ? "selected" : ""}>set</option>
            </select>
          </div>
          <label class="check-row" style="grid-template-columns:22px 1fr"><input id="active" type="checkbox" ${draft.active === false ? "" : "checked"} /> <span>Active (visible in calculator)</span></label>
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
          category: wrap.querySelector("#category").value.trim() || "General",
          cft: Helpers.number(wrap.querySelector("#cft").value),
          unit: wrap.querySelector("#unit").value,
          active: wrap.querySelector("#active").checked,
        };
        const errors = Validation.validateItem(next, ItemService.list(true), next.id);
        wrap.querySelectorAll(".err").forEach((n) => n.remove());
        if (Object.keys(errors).length) {
          if (errors.name) wrap.querySelector("#f-name").insertAdjacentHTML("beforeend", `<div class="err">${errors.name}</div>`);
          if (errors.cft) wrap.querySelector("#f-cft").insertAdjacentHTML("beforeend", `<div class="err">${errors.cft}</div>`);
          return;
        }
        ItemService.save(next);
        UI.toast("Item saved.");
        wrap.remove();
        paint();
      }
    });
  }

  paint();
};
