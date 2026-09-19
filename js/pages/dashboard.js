window.Pages = window.Pages || {};

Pages.dashboard = function (root) {
  const orders = OrderService.list();
  const items = ItemService.list();
  const vehicles = VehicleService.list();
  const activeOrders = orders.filter((o) => o.status !== "cancelled");
  const totalAmt = activeOrders.reduce((s, o) => s + Helpers.number(o.totals && o.totals.total), 0);
  const totalCft = activeOrders.reduce((s, o) => s + Helpers.number(o.totals && o.totals.totalCft), 0);

  const recent = orders.slice(0, 6);
  const vehicleUse = {};
  activeOrders.forEach((o) => {
    const name = (o.totals && o.totals.vehicleName) || "Unassigned";
    vehicleUse[name] = (vehicleUse[name] || 0) + 1;
  });

  root.innerHTML = `
    <div class="grid-4" style="margin-bottom:16px">
      <div class="stat"><div class="lbl">Saved orders</div><div class="val">${orders.length}</div><div class="sub">${activeOrders.length} active</div></div>
      <div class="stat"><div class="lbl">Quoted value</div><div class="val">${Helpers.formatMoney(totalAmt)}</div><div class="sub">Across active orders</div></div>
      <div class="stat"><div class="lbl">Volume booked</div><div class="val">${totalCft.toFixed(0)} CFT</div><div class="sub">Sum of order volume</div></div>
      <div class="stat"><div class="lbl">Masters</div><div class="val">${items.filter(i=>i.active!==false).length}</div><div class="sub">${vehicles.filter(v=>v.active!==false).length} active vehicles</div></div>
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-hd"><h3>Quick actions</h3></div>
        <div class="card-bd" style="display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn" href="#/calculator">New order</a>
          <a class="btn secondary" href="#/orders">View orders</a>
          <a class="btn secondary" href="#/items">Edit item CFT</a>
          <a class="btn secondary" href="#/rates">Update rates</a>
        </div>
        <div class="card-bd help" style="padding-top:0">
          Rates, vehicle capacities and item CFT are edited from Admin pages. The calculator always reads the latest saved values — no code changes required when prices change.
        </div>
      </div>
      <div class="card">
        <div class="card-hd"><h3>Vehicle mix</h3></div>
        <div class="card-bd">
          ${
            Object.keys(vehicleUse).length
              ? `<table class="data"><thead><tr><th>Vehicle</th><th class="num">Orders</th></tr></thead><tbody>
                ${Object.entries(vehicleUse).map(([k,v]) => `<tr><td>${Helpers.escapeHtml(k)}</td><td class="num">${v}</td></tr>`).join("")}
              </tbody></table>`
              : `<div class="empty"><h4>No orders yet</h4><p>Create an order to see vehicle recommendations here.</p></div>`
          }
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-hd"><h3>Recent orders</h3><a class="btn secondary sm" href="#/orders">All orders</a></div>
      <div class="card-bd table-wrap">
        ${
          recent.length
            ? `<table class="data">
                <thead><tr><th>Order ID</th><th>Customer</th><th>Date</th><th class="num">CFT</th><th>Vehicle</th><th class="num">Amount</th><th>Status</th></tr></thead>
                <tbody>
                  ${recent.map(rowOrder).join("")}
                </tbody>
              </table>`
            : `<div class="empty"><h4>Nothing saved yet</h4><p>Use the Order Calculator to create the first quote.</p></div>`
        }
      </div>
    </div>
  `;
};

function rowOrder(o) {
  const t = o.totals || {};
  return `<tr>
    <td><a href="#/orders/view/${o.id}">${Helpers.escapeHtml(o.bookingId || o.id)}</a></td>
    <td>${Helpers.escapeHtml(o.customerName || "—")}</td>
    <td>${Helpers.formatDate(o.orderDate || o.createdAt)}</td>
    <td class="num">${Helpers.number(t.totalCft).toFixed(1)}</td>
    <td>${Helpers.escapeHtml(t.vehicleName || "—")}</td>
    <td class="num">${Helpers.formatMoney(t.total)}</td>
    <td><span class="badge ${o.status === "cancelled" ? "danger" : o.status === "confirmed" ? "ok" : "muted"}">${Helpers.escapeHtml(o.status || "draft")}</span></td>
  </tr>`;
}
