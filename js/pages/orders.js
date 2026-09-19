window.Pages = window.Pages || {};

Pages.orders = function (root) {
  let q = "";
  let status = "all";

  function rows() {
    return OrderService.list().filter((o) => {
      const hay = Helpers.slug([o.bookingId, o.customerName, o.pickup, o.drop, o.totals && o.totals.vehicleName].join(" "));
      const okQ = !q || hay.includes(Helpers.slug(q));
      const okS = status === "all" || (o.status || "draft") === status;
      return okQ && okS;
    });
  }

  function paint() {
    const list = rows();
    root.innerHTML = `
      <div class="card">
        <div class="card-hd">
          <h3>Saved orders</h3>
          <div class="toolbar">
            <input type="search" id="oq" placeholder="Search customer, ID, vehicle…" value="${Helpers.escapeHtml(q)}" />
            <select id="os">
              <option value="all" ${status === "all" ? "selected" : ""}>All statuses</option>
              <option value="draft" ${status === "draft" ? "selected" : ""}>Draft</option>
              <option value="confirmed" ${status === "confirmed" ? "selected" : ""}>Confirmed</option>
              <option value="cancelled" ${status === "cancelled" ? "selected" : ""}>Cancelled</option>
            </select>
            <a class="btn" href="#/calculator">New order</a>
          </div>
        </div>
        <div class="card-bd table-wrap">
          ${
            list.length
              ? `<table class="data">
                  <thead>
                    <tr>
                      <th>Order ID</th><th>Customer</th><th>Date</th>
                      <th class="num">Total CFT</th><th>Vehicle</th>
                      <th class="num">Distance</th><th class="num">Total amount</th>
                      <th>Status</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${list.map(renderRow).join("")}
                  </tbody>
                </table>`
              : `<div class="empty"><h4>No orders match</h4><p>Create an order from the calculator.</p></div>`
          }
        </div>
      </div>
    `;
    root.querySelector("#oq").addEventListener("input", (e) => {
      q = e.target.value;
      paint();
      const el = root.querySelector("#oq");
      el.focus();
      el.setSelectionRange(q.length, q.length);
    });
    root.querySelector("#os").addEventListener("change", (e) => {
      status = e.target.value;
      paint();
    });
    root.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const act = btn.getAttribute("data-act");
        if (act === "delete") {
          const ok = await UI.confirmModal({
            title: "Delete order",
            body: "This removes the order from the local store. Continue?",
            confirmText: "Delete",
            danger: true,
          });
          if (ok) {
            OrderService.remove(id);
            UI.toast("Order deleted.");
            paint();
          }
        }
        if (act === "cancel") {
          const o = OrderService.get(id);
          o.status = "cancelled";
          OrderService.save(o);
          UI.toast("Order cancelled.");
          paint();
        }
        if (act === "dup") {
          const copy = OrderService.duplicate(id);
          location.hash = "#/calculator?id=" + copy.id;
        }
      });
    });
  }

  function renderRow(o) {
    const t = o.totals || {};
    return `<tr>
      <td><a href="#/orders/view/${o.id}">${Helpers.escapeHtml(o.bookingId || o.id)}</a></td>
      <td>${Helpers.escapeHtml(o.customerName || "—")}</td>
      <td>${Helpers.formatDate(o.orderDate || o.createdAt)}</td>
      <td class="num">${Helpers.number(t.totalCft).toFixed(1)}</td>
      <td>${Helpers.escapeHtml(t.vehicleName || "—")}</td>
      <td class="num">${Helpers.number(o.distanceKm)}</td>
      <td class="num">${Helpers.formatMoney(t.total)}</td>
      <td><span class="badge ${o.status === "cancelled" ? "danger" : o.status === "confirmed" ? "ok" : "muted"}">${Helpers.escapeHtml(o.status || "draft")}</span></td>
      <td>
        <div class="toolbar">
          <a class="btn sm secondary" href="#/calculator?id=${o.id}">Edit</a>
          <button class="btn sm secondary" data-act="dup" data-id="${o.id}">Duplicate</button>
          <button class="btn sm secondary" data-act="cancel" data-id="${o.id}">Cancel</button>
          <button class="btn sm danger-outline" data-act="delete" data-id="${o.id}">Delete</button>
        </div>
      </td>
    </tr>`;
  }

  paint();
};
