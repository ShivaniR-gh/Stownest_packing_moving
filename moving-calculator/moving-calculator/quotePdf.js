window.QuotePdf = {
  download(payload) {
    const pdf = buildPdf(payload || {});
    const blob = new Blob([pdf], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const who = slug((payload.customerName || "quote").trim()) || "quote";
    const lane = slug((payload.pickup || "") + "-" + (payload.drop || "")) || "lane";
    a.href = url;
    a.download = "Quotation-" + who + "-" + lane + ".pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  },
};

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function escPdf(s) {
  return String(s == null ? "" : s)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, (ch) => {
      const map = { "₹": "Rs ", "—": "-", "–": "-", "→": "-", "’": "'", "‘": "'", "“": '"', "”": '"' };
      return map[ch] || " ";
    });
}

function buildPdf(p) {
  const pageW = 595.28;
  const pageH = 841.89;
  const L = 36;
  const R = pageW - 36;
  const ops = [];
  let y = pageH - 36;

  function rgb(r, g, b) {
    ops.push((r / 255).toFixed(3) + " " + (g / 255).toFixed(3) + " " + (b / 255).toFixed(3) + " rg");
  }
  function strokeRgb(r, g, b) {
    ops.push((r / 255).toFixed(3) + " " + (g / 255).toFixed(3) + " " + (b / 255).toFixed(3) + " RG");
  }
  function fillRect(x, yy, w, h, r, g, b) {
    rgb(r, g, b);
    ops.push(x.toFixed(2) + " " + yy.toFixed(2) + " " + w.toFixed(2) + " " + h.toFixed(2) + " re f");
  }
  function box(x, yy, w, h) {
    strokeRgb(200, 214, 204);
    ops.push("0.8 w");
    ops.push(x.toFixed(2) + " " + yy.toFixed(2) + " " + w.toFixed(2) + " " + h.toFixed(2) + " re S");
  }
  function text(x, yy, size, str, bold) {
    ops.push("0 0 0 rg");
    ops.push("BT /" + (bold ? "F2" : "F1") + " " + size + " Tf 1 0 0 1 " + x.toFixed(2) + " " + yy.toFixed(2) + " Tm (" + escPdf(str) + ") Tj ET");
  }
  function whiteText(x, yy, size, str, bold) {
    ops.push("1 1 1 rg");
    ops.push("BT /" + (bold ? "F2" : "F1") + " " + size + " Tf 1 0 0 1 " + x.toFixed(2) + " " + yy.toFixed(2) + " Tm (" + escPdf(str) + ") Tj ET");
  }

  // header bar
  fillRect(0, pageH - 78, pageW, 78, 27, 164, 90);
  // simple box icon
  ops.push("1 1 1 RG 2 w");
  ops.push("48 788 18 16 re S");
  ops.push("48 796 m 66 796 l S");
  ops.push("57 788 m 57 804 l S");
  whiteText(76, 806, 16, p.companyName || "Stownest", true);
  whiteText(76, 790, 9, p.companyTag || "Storage & Moving");
  whiteText(420, 806, 14, "QUOTATION", true);
  whiteText(420, 790, 9, p.quoteDate || "");
  y = pageH - 96;

  const typeLabel = (p.moveType || "dedicated").toLowerCase() === "sharing" ? "Sharing" : "Dedicated";

  text(L, y, 11, "Customer details", true);
  y -= 8;
  box(L, y - 62, R - L, 70);
  y -= 16;
  text(L + 10, y, 9, "Name");
  text(L + 80, y, 9, p.customerName || "-", true);
  text(320, y, 9, "Quote no.");
  text(390, y, 9, p.bookingId || "-", true);
  y -= 16;
  text(L + 10, y, 9, "Phone");
  text(L + 80, y, 9, p.phone || "-", true);
  text(320, y, 9, "Email");
  text(390, y, 9, String(p.email || "-").slice(0, 28), true);
  y -= 16;
  text(L + 10, y, 9, "Notes");
  text(L + 80, y, 9, String(p.notes || "-").slice(0, 70));
  y -= 28;

  text(L, y, 11, "Move details", true);
  y -= 8;
  box(L, y - 62, R - L, 70);
  y -= 16;
  text(L + 10, y, 9, "From");
  text(L + 80, y, 9, p.pickup || "-", true);
  text(320, y, 9, "To");
  text(360, y, 9, p.drop || "-", true);
  y -= 16;
  text(L + 10, y, 9, "Distance");
  text(L + 80, y, 9, (p.distanceKm || 0) + " KM" + (p.delivery ? "  /  " + p.delivery : ""), true);
  text(320, y, 9, "Move type");
  text(390, y, 9, typeLabel, true);
  y -= 16;
  text(L + 10, y, 9, "Vehicle");
  text(L + 80, y, 9, p.vehicleName || "-", true);
  text(320, y, 9, "Volume");
  text(390, y, 9, (p.totalCft || "0") + " CFT", true);
  y -= 28;

  text(L, y, 11, "Item list", true);
  y -= 6;
  fillRect(L, y - 4, R - L, 16, 230, 244, 234);
  text(L + 8, y, 8, "Item");
  text(340, y, 8, "Qty");
  text(390, y, 8, "CFT");
  text(470, y, 8, "Total CFT");
  y -= 18;
  (p.items || []).forEach((it, i) => {
    if (i % 2 === 1) fillRect(L, y - 4, R - L, 16, 247, 251, 248);
    text(L + 8, y, 9, String(it.name || "-").slice(0, 40));
    text(340, y, 9, String(it.quantity || 0));
    text(390, y, 9, Number(it.cftPerItem || 0).toFixed(2));
    text(470, y, 9, Number(it.totalCft || 0).toFixed(2));
    y -= 16;
  });
  text(390, y, 9, "Total volume", true);
  text(470, y, 9, Number(p.totalCft || 0).toFixed(2), true);
  y -= 22;

  if (p.services && p.services.length) {
    text(L, y, 11, "Additional services", true);
    y -= 16;
    p.services.forEach((s) => {
      text(L + 8, y, 9, s.name || "Service");
      text(450, y, 9, s.amount || "");
      y -= 14;
    });
    y -= 8;
  }

  fillRect(L, y - 36, R - L, 48, 27, 164, 90);
  whiteText(L + 12, y - 8, 11, "Total (" + typeLabel + ")", true);
  whiteText(400, y - 8, 14, p.total || "-", true);
  whiteText(L + 12, y - 24, 8, p.transportFormula || "Lane rate for the selected vehicle and move type");
  y -= 60;

  text(L, y, 8, "This quotation is an estimate based on declared items and the configured city lane.");
  y -= 12;
  text(L, y, 8, "Final charges may change after survey. Thank you for choosing " + (p.companyName || "Stownest") + ".");

  const stream = ops.join("\n") + "\n";
  const objects = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
      pageW +
      " " +
      pageH +
      "] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>"
  );
  objects.push("<< /Length " + stream.length + " >>\nstream\n" + stream + "endstream");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  let out = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(out.length);
    out += i + 1 + " 0 obj\n" + obj + "\nendobj\n";
  });
  const xref = out.length;
  out += "xref\n0 " + (objects.length + 1) + "\n";
  out += "0000000000 65535 f \n";
  offsets.slice(1).forEach((off) => {
    out += String(off).padStart(10, "0") + " 00000 n \n";
  });
  out += "trailer << /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
  return out;
}
