window.Pages = window.Pages || {};

/** Extra services & fallback rates — view only. Source: Google Sheet tabs "Services" and "Settings". */
Pages.services = function (root) {
  const list = DataStore.services(true);
  const s = DataStore.settings();
  const money = (v) => Helpers.formatMoney(Helpers.number(v));
  const rateText = (svc) => (svc.pricingType === "percentage" ? Helpers.number(svc.rate) + "%" : money(svc.rate));

  root.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-hd"><h3>Additional services</h3></div>
      ${UI.viewOnlyNote("Services")}
      <div class="card-bd table-wrap" style="padding-top:0">
        <table class="data">
          <thead><tr><th>ID</th><th>Service</th><th>Pricing type</th><th class="num">Rate</th><th>Active</th></tr></thead>
          <tbody>
            ${
              list.length
                ? list
                    .map(
                      (svc) => `<tr>
                        <td class="help">${Helpers.escapeHtml(svc.id)}</td>
                        <td>${Helpers.escapeHtml(svc.name)}</td>
                        <td>${Helpers.escapeHtml(Helpers.pricingTypeLabel(svc.pricingType))}</td>
                        <td class="num">${rateText(svc)}</td>
                        <td><span class="badge ${svc.active === false ? "muted" : "ok"}">${svc.active === false ? "No" : "Yes"}</span></td>
                      </tr>`
                    )
                    .join("")
                : `<tr><td colspan="5"><div class="empty">The Services tab is empty.</div></td></tr>`
            }
          </tbody>
        </table>
        <p class="help" style="margin:10px 0 0">Pricing types: <code>fixed</code>, <code>per_item</code>, <code>per_box</code>, <code>per_km</code>, <code>per_hour</code>, <code>percentage</code>.</p>
      </div>
    </div>

    <div class="card">
      <div class="card-hd"><h3>Fallback pricing (no lane for the city pair)</h3></div>
      ${UI.viewOnlyNote("Settings")}
      <div class="card-bd">
        <dl class="kv">
          <dt>perCftRate</dt><dd>${money(s.perCftRate)} per CFT</dd>
          <dt>ratePerKm</dt><dd>${money(s.ratePerKm)} per KM</dd>
          <dt>minimumCharge</dt><dd>${money(s.minimumCharge)}</dd>
        </dl>
        <p class="help" style="margin:12px 0 0">Fallback total = CFT × perCftRate + max(minimumCharge, KM × ratePerKm).</p>
      </div>
    </div>
  `;
};
