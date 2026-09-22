window.Pages = window.Pages || {};

/** Vehicle master — view only. Source: Google Sheet tab "Vehicles". */
Pages.vehicles = function (root) {
  const list = DataStore.vehicles(true);
  root.innerHTML = `
    <div class="card">
      <div class="card-hd"><h3>Vehicle sizes</h3></div>
      ${UI.viewOnlyNote("Vehicles")}
      <div class="card-bd table-wrap" style="padding-top:0">
        <table class="data">
          <thead><tr><th>ID</th><th>Vehicle</th><th class="num">Max CFT</th><th class="num">Lanes priced</th><th>Active</th></tr></thead>
          <tbody>
            ${
              list.length
                ? list
                    .map((v) => {
                      const priced = DataStore.lanes().filter(
                        (l) => Helpers.number((l.dedicated || {})[v.id]) > 0 || Helpers.number((l.sharing || {})[v.id]) > 0
                      ).length;
                      return `<tr>
                        <td class="help">${Helpers.escapeHtml(v.id)}</td>
                        <td>${Helpers.escapeHtml(v.name)}</td>
                        <td class="num">${Helpers.number(v.maxCft)}</td>
                        <td class="num">${priced}</td>
                        <td><span class="badge ${v.active === false ? "muted" : "ok"}">${v.active === false ? "No" : "Yes"}</span></td>
                      </tr>`;
                    })
                    .join("")
                : `<tr><td colspan="5"><div class="empty">The Vehicles tab is empty.</div></td></tr>`
            }
          </tbody>
        </table>
        <p class="help" style="margin:10px 0 0">The calculator picks the smallest active vehicle whose Max CFT fits the load and that has a price on the selected lane. Lane price columns in the <strong>Lanes</strong> tab are named <code>&lt;Vehicle name&gt; dedicated</code> and <code>&lt;Vehicle name&gt; sharing</code>.</p>
      </div>
    </div>
  `;
};
