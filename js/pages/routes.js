window.Pages = window.Pages || {};

/** Cities & lanes — view only. Source: Google Sheet tabs "Cities" and "Lanes". */
Pages.routes = function (root) {
  let q = "";
  const vehs = DataStore.vehicles(false);
  const cityRecs = DataStore.cityRecords();
  const laneOnly = DataStore.cities().filter((c) => !cityRecs.some((r) => Helpers.slug(r.name) === Helpers.slug(c)));

  root.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-hd"><h3>Cities</h3></div>
      ${UI.viewOnlyNote("Cities")}
      <div class="card-bd pill-list">
        ${
          cityRecs
            .map(
              (c) =>
                `<span class="badge ok" title="${Helpers.escapeHtml((c.aliases || []).join(", "))}">${Helpers.escapeHtml(c.name)}${
                  c.aliases && c.aliases.length ? ` <span style="font-weight:400;opacity:.75">· ${Helpers.escapeHtml(c.aliases.join(", "))}</span>` : ""
                }</span>`
            )
            .join("") || `<span class="help">The Cities tab is empty.</span>`
        }
        ${laneOnly.map((c) => `<span class="badge warn" title="Used on a lane but missing from the Cities tab">${Helpers.escapeHtml(c)}</span>`).join("")}
      </div>
      ${laneOnly.length ? `<div class="card-bd help" style="padding-top:0">Orange cities appear on a lane but are not in the Cities tab.</div>` : ""}
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>Lanes — KM, delivery and Dedicated / Sharing prices</h3>
        <input type="search" id="lq" placeholder="Filter by city…" />
      </div>
      ${UI.viewOnlyNote("Lanes")}
      <div class="card-bd table-wrap" style="padding-top:0;overflow:auto">
        <table class="data">
          <thead>
            <tr>
              <th>From</th><th>To</th><th class="num">KM</th><th>Delivery</th>
              ${vehs.map((v) => `<th class="num">${Helpers.escapeHtml(v.name)}<br><span class="help">${v.maxCft} CFT · Ded / Share</span></th>`).join("")}
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
        <p class="help" style="margin:10px 0 0">Each row is priced for its own direction (From → To). If only one direction is listed, it is used for the return trip too — add a separate row (e.g. Chennai → Bangalore) to price the return differently. Blank or 0 means that vehicle size is not offered on the lane.</p>
      </div>
    </div>
  `;

  function paintRows() {
    const lanes = DataStore.lanes()
      .filter((r) => !q || Helpers.slug(r.from + " " + r.to).includes(Helpers.slug(q)))
      .slice()
      .sort((a, b) => String(a.from).localeCompare(String(b.from)) || String(a.to).localeCompare(String(b.to)));
    root.querySelector("#rows").innerHTML = lanes.length
      ? lanes
          .map(
            (r) => `<tr>
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
            </tr>`
          )
          .join("")
      : `<tr><td colspan="${4 + vehs.length}"><div class="empty">${DataStore.lanes().length ? "No lanes match." : "The Lanes tab is empty."}</div></td></tr>`;
  }

  root.querySelector("#lq").addEventListener("input", (e) => {
    q = e.target.value;
    paintRows();
  });
  paintRows();
};
