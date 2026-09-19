window.QuotePdf = {
  download(payload) {
    const p = payload || {};
    const typeLabel = String(p.moveType || "dedicated").toLowerCase() === "sharing" ? "Sharing" : "Dedicated";
    const logo = new URL("assets/stownest-logo.png", location.href).href;
    const rows = (p.items || [])
      .map(
        (it) =>
          "<tr><td>" +
          esc(it.name) +
          '</td><td class="num">' +
          esc(it.quantity) +
          '</td><td class="num">' +
          Number(it.cftPerItem || 0).toFixed(2) +
          '</td><td class="num">' +
          Number(it.totalCft || 0).toFixed(2) +
          "</td></tr>"
      )
      .join("");
    const services = (p.services || [])
      .map((s) => "<tr><td>" + esc(s.name) + '</td><td class="num">' + esc(s.amount) + "</td></tr>")
      .join("");

    const html =
      "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Quotation</title><style>" +
      "*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#163322;margin:0;padding:28px}" +
      ".head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #22a45a;padding-bottom:14px;margin-bottom:18px}" +
      ".brand{display:flex;gap:12px;align-items:center}.brand img{width:56px;height:56px;border-radius:50%}" +
      "h1{margin:0;font-size:22px}.sub{color:#5b6b62;font-size:12px;margin-top:2px}.doc{text-align:right}" +
      ".doc b{display:block;font-size:20px;letter-spacing:.08em;color:#22a45a}" +
      ".grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}" +
      ".box{border:1px solid #cfe3d7;border-radius:8px;padding:12px 14px}" +
      ".box h3{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#5b6b62}" +
      ".row{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:3px 0}" +
      "table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}" +
      "th{text-align:left;background:#e8f6ee;padding:8px;font-size:11px;text-transform:uppercase}" +
      "td{padding:8px;border-bottom:1px solid #e4eee8}.num{text-align:right}" +
      ".total{margin-top:16px;background:#22a45a;color:#fff;padding:14px 16px;border-radius:8px;display:flex;justify-content:space-between;align-items:center}" +
      ".total b{font-size:22px}.note{margin-top:16px;font-size:11px;color:#5b6b62}" +
      "</style></head><body>" +
      '<div class="head"><div class="brand"><img src="' +
      logo +
      '" alt="logo"><div><h1>' +
      esc(p.companyName || "Stownest") +
      '</h1><div class="sub">' +
      esc(p.companyTag || "Storage & Moving") +
      '</div></div></div><div class="doc"><b>QUOTATION</b><div class="sub">' +
      esc(p.quoteDate || "") +
      '</div><div class="sub">' +
      esc(p.bookingId || "") +
      "</div></div></div>" +
      '<div class="grid"><div class="box"><h3>Customer</h3>' +
      '<div class="row"><span>Name</span><strong>' +
      esc(p.customerName || "-") +
      "</strong></div>" +
      '<div class="row"><span>Phone</span><strong>' +
      esc(p.phone || "-") +
      "</strong></div>" +
      '<div class="row"><span>Email</span><strong>' +
      esc(p.email || "-") +
      "</strong></div></div>" +
      '<div class="box"><h3>Move</h3>' +
      '<div class="row"><span>From</span><strong>' +
      esc(p.pickup || "-") +
      "</strong></div>" +
      '<div class="row"><span>To</span><strong>' +
      esc(p.drop || "-") +
      "</strong></div>" +
      '<div class="row"><span>Distance</span><strong>' +
      esc(p.distanceKm || 0) +
      " KM" +
      (p.delivery ? " / " + esc(p.delivery) : "") +
      "</strong></div>" +
      '<div class="row"><span>Type</span><strong>' +
      typeLabel +
      "</strong></div>" +
      '<div class="row"><span>Vehicle</span><strong>' +
      esc(p.vehicleName || "-") +
      "</strong></div>" +
      '<div class="row"><span>Volume</span><strong>' +
      esc(p.totalCft || "0") +
      " CFT</strong></div></div></div>" +
      '<div class="box"><h3>Items</h3><table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">CFT</th><th class="num">Total CFT</th></tr></thead><tbody>' +
      rows +
      "</tbody></table></div>" +
      (services ? '<div class="box" style="margin-top:12px"><h3>Additional services</h3><table>' + services + "</table></div>" : "") +
      '<div class="total"><div>Total (' +
      typeLabel +
      ")</div><b>" +
      esc(p.total || "-") +
      "</b></div>" +
      '<div class="note">This quotation shows only the selected ' +
      typeLabel.toLowerCase() +
      " amount. Sharing and Dedicated are not listed together.</div>" +
      (p.notes ? '<div class="note">Notes: ' + esc(p.notes) + "</div>" : "") +
      "</body></html>";

    const w = window.open("", "_blank", "noopener,width=900,height=1000");
    if (!w) {
      alert("Allow popups, then click Download PDF again. In the print dialog choose Save as PDF.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(function () {
      w.focus();
      w.print();
    }, 400);
  },
};

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
