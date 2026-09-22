window.Pages = window.Pages || {};

Pages.dashboard = function (root) {
  const admin = AuthService.isAdmin();
  const stat = (label, val, sub, href) => {
    const inner = `<div class="lbl">${label}</div><div class="val">${val}</div><div class="sub">${sub}</div>`;
    return admin && href ? `<a class="stat" href="${href}">${inner}</a>` : `<div class="stat">${inner}</div>`;
  };

  root.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-hd"><h3>Moving quote calculator</h3></div>
      <div class="card-bd">
        <p class="help" style="margin:0 0 14px">Build a quote from pickup, drop, items and CFT. All items, vehicles, lanes and prices come live from the Google Sheet. Quotes are not saved — download a PDF to share.</p>
        <div class="toolbar"><a class="btn" href="#/calculator">New quote</a></div>
      </div>
    </div>
    <div class="grid-4">
      ${stat("Items", DataStore.items(false).length, "Active in the Items tab", "#/items")}
      ${stat("Vehicles", DataStore.vehicles(false).length, "Active in the Vehicles tab", "#/vehicles")}
      ${stat("Cities", DataStore.cities().length, "Pickup / drop list", "#/routes")}
      ${stat("Lanes", DataStore.lanes().length, "Priced city pairs", "#/routes")}
    </div>
  `;
};
