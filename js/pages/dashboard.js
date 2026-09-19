window.Pages = window.Pages || {};

Pages.dashboard = function (root) {
  const items = ItemService.list(false);
  const vehicles = VehicleService.list(false);
  const cities = RouteService.cities ? RouteService.cities() : [];
  const lanes = RouteService.list ? RouteService.list() : [];

  root.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-hd"><h3>Moving quote calculator</h3></div>
      <div class="card-bd">
        <p class="help" style="margin:0 0 14px">Build a quote from pickup, drop, items and CFT. Nothing is saved as a customer order. Download a PDF to share the quote.</p>
        <div class="toolbar">
          <a class="btn" href="#/calculator">New quote</a>
          ${AuthService.isAdmin() ? `<a class="btn secondary" href="#/rates">Extra services</a>
          <a class="btn secondary" href="#/items">Item CFT</a>
          <a class="btn secondary" href="#/vehicles">Vehicles</a>` : ""}
        </div>
      </div>
    </div>
    <div class="grid-4">
      <div class="stat"><div class="lbl">Items</div><div class="val">${items.length}</div><div class="sub">CFT catalogue</div></div>
      <div class="stat"><div class="lbl">Vehicles</div><div class="val">${vehicles.length}</div><div class="sub">Size options</div></div>
      <div class="stat"><div class="lbl">Cities</div><div class="val">${cities.length}</div><div class="sub">Pickup / drop list</div></div>
      <div class="stat"><div class="lbl">Lanes</div><div class="val">${lanes.length}</div><div class="sub">Priced city pairs</div></div>
    </div>
  `;
};
