window.Pages = window.Pages || {};

/** Item master — view only. Source: Google Sheet tab "Items". */
Pages.items = function (root) {
  let q = "";
  let status = "all";

  root.innerHTML = `
    <div class="card">
      <div class="card-hd">
        <h3>Item / CFT master</h3>
        <div class="toolbar">
          <input type="search" id="iq" placeholder="Search items…" />
          <select id="is">
            <option value="all">Active + inactive</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>
      </div>
      ${UI.viewOnlyNote("Items")}
      <div class="card-bd table-wrap" style="padding-top:0">
        <table class="data">
          <thead><tr><th>ID</th><th>Item name</th><th class="num">CFT</th><th>Unit</th><th>Active</th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
        <div class="help" id="count" style="margin-top:8px"></div>
      </div>
    </div>
  `;

  function paintRows() {
    const all = DataStore.items(true);
    const list = all.filter((i) => {
      const okQ = !q || Helpers.slug(i.name + " " + i.id).includes(Helpers.slug(q));
      const okS = status === "all" || (status === "active" ? i.active !== false : i.active === false);
      return okQ && okS;
    });
    root.querySelector("#rows").innerHTML = list.length
      ? list
          .map(
            (i) => `<tr>
              <td class="help">${Helpers.escapeHtml(i.id)}</td>
              <td>${Helpers.escapeHtml(i.name)}</td>
              <td class="num">${Helpers.number(i.cft)}</td>
              <td>${Helpers.escapeHtml(i.unit || "pcs")}</td>
              <td><span class="badge ${i.active === false ? "muted" : "ok"}">${i.active === false ? "No" : "Yes"}</span></td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="5"><div class="empty">${all.length ? "No items match." : "The Items tab is empty."}</div></td></tr>`;
    root.querySelector("#count").textContent = `Showing ${list.length} of ${all.length} items`;
  }

  root.querySelector("#iq").addEventListener("input", (e) => {
    q = e.target.value;
    paintRows();
  });
  root.querySelector("#is").addEventListener("change", (e) => {
    status = e.target.value;
    paintRows();
  });
  paintRows();
};
