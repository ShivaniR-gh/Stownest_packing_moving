/**
 * Quote PDF — builds a real A4 PDF file in the browser and downloads it.
 * No popups, no print dialog. Libraries and fonts are bundled in /assets so it
 * works on GitHub Pages without any CDN.
 *
 * Company details printed on the PDF come from the Settings tab of the sheet:
 *   companyName, companyTagline, companyAddress, companyPhone, companyEmail,
 *   companyWebsite, companyGstin, quoteValidityDays, quoteTerms (one per line or "|" separated)
 */
(function (global) {
  // Neutral, print-friendly palette — only the logo is in colour.
  const INK = [17, 17, 17];
  const MUTED = [102, 102, 102];
  const LINE = [215, 215, 215];
  const STRONG_LINE = [60, 60, 60];
  const SOFT = [246, 246, 246];

  let libsPromise = null;
  let assetsPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Could not load " + src));
      document.head.appendChild(s);
    });
  }

  function loadLibs() {
    if (global.jspdf && global.jspdf.jsPDF && global.jspdf.jsPDF.API.autoTable) return Promise.resolve();
    if (!libsPromise) {
      libsPromise = loadScript("assets/vendor/jspdf.umd.min.js")
        .then(() => loadScript("assets/vendor/jspdf.plugin.autotable.min.js"))
        .catch((err) => {
          libsPromise = null;
          throw err;
        });
    }
    return libsPromise;
  }

  async function fetchBase64(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + " " + res.status);
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  /** Fonts (with ₹) and logo. Failures fall back to Helvetica / no logo instead of breaking the download. */
  function loadAssets() {
    if (!assetsPromise) {
      assetsPromise = Promise.all([
        fetchBase64("assets/fonts/SourceSans3-Regular.ttf").catch(() => null),
        fetchBase64("assets/fonts/SourceSans3-Bold.ttf").catch(() => null),
        fetchBase64("assets/box-icon.png").catch(() => null),
      ]).then(([regular, bold, logo]) => ({ regular, bold, logo }));
    }
    return assetsPromise;
  }

  function splitTerms(raw) {
    return String(raw || "")
      .split(/\r?\n|\|/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function safeFile(s) {
    return String(s || "")
      .trim()
      .replace(/[^a-z0-9-_ ]/gi, "")
      .replace(/\s+/g, "-")
      .slice(0, 40);
  }

  async function download(p) {
    await loadLibs();
    const assets = await loadAssets();
    const { jsPDF } = global.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    let FONT = "helvetica";
    if (assets.regular && assets.bold) {
      doc.addFileToVFS("SourceSans3-Regular.ttf", assets.regular);
      doc.addFont("SourceSans3-Regular.ttf", "SourceSans", "normal");
      doc.addFileToVFS("SourceSans3-Bold.ttf", assets.bold);
      doc.addFont("SourceSans3-Bold.ttf", "SourceSans", "bold");
      FONT = "SourceSans";
    }
    if (FONT === "helvetica") {
      // Built-in fonts lack ₹, → and • — swap them for plain text so nothing prints as garbage.
      const clean = (v) => (Array.isArray(v) ? v.map(clean) : String(v).replace(/₹/g, "Rs. ").replace(/→/g, "->").replace(/[•—–−]/g, "-"));
      const orig = doc.text.bind(doc);
      doc.text = (t, ...rest) => orig(clean(t), ...rest);
    }
    // Helvetica has no ₹ glyph — use "Rs." if the embedded font failed to load.
    const symbol = FONT === "SourceSans" ? p.currencySymbol || "₹" : "Rs. ";
    const money = (n) =>
      symbol + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 14; // margin
    const typeLabel = p.moveType === "sharing" ? "Sharing" : "Dedicated";

    const set = (size, style, color) => {
      doc.setFont(FONT, style || "normal");
      doc.setFontSize(size);
      doc.setTextColor.apply(doc, color || INK);
    };

    /* ---------- Header ---------- */

    let x = M;
    if (assets.logo) {
      doc.addImage("data:image/png;base64," + assets.logo, "PNG", M, 10, 16, 16);
      x = M + 20;
    }
    set(17, "bold", INK);
    doc.text(p.companyName || "StowNest", x, 18);
    set(9.5, "normal", MUTED);
    doc.text(p.companyTag || "Storage & Moving", x, 23);

    const contact = [p.companyAddress, [p.companyPhone, p.companyEmail].filter(Boolean).join("  •  "), p.companyWebsite, p.companyGstin ? "GSTIN: " + p.companyGstin : ""].filter(Boolean);
    let cy = 27.5;
    set(8.5, "normal", MUTED);
    contact.forEach((line) => {
      doc.splitTextToSize(line, 105).forEach((l) => {
        doc.text(l, x, cy);
        cy += 4;
      });
    });

    set(16, "bold", INK);
    doc.text("QUOTATION", W - M, 18, { align: "right" });
    set(9.5, "normal", MUTED);
    const meta = [["Quote ID", p.bookingId || "—"], ["Date", p.quoteDate || ""]];
    if (p.validUntil) meta.push(["Valid until", p.validUntil]);
    let my = 24;
    meta.forEach(([k, v]) => {
      set(9, "normal", MUTED);
      doc.text(k, W - M - 34, my, { align: "right" });
      set(9.5, "bold", INK);
      doc.text(String(v), W - M, my, { align: "right" });
      my += 5;
    });

    let y = Math.max(cy, my) + 3;
    doc.setDrawColor.apply(doc, STRONG_LINE);
    doc.setLineWidth(0.5);
    doc.line(M, y, W - M, y);
    doc.setLineWidth(0.2);
    y += 6;

    /* ---------- Customer + move boxes ---------- */
    const boxW = (W - M * 2 - 6) / 2;
    function infoBox(bx, title, rows) {
      const lineH = 5.6;
      const h = 9 + rows.length * lineH + 2;
      doc.setDrawColor.apply(doc, LINE);
      doc.roundedRect(bx, y, boxW, h, 1.5, 1.5, "S");
      set(8.5, "bold", MUTED);
      doc.text(title.toUpperCase(), bx + 4, y + 6);
      rows.forEach(([k, v], i) => {
        const ry = y + 12 + i * lineH;
        set(9.5, "normal", MUTED);
        doc.text(k, bx + 4, ry);
        const maxW = boxW - 8 - doc.getTextWidth(k) - 4;
        set(9.5, "bold", INK);
        let val = String(v || "—");
        if (doc.getTextWidth(val) > maxW) {
          while (val.length > 1 && doc.getTextWidth(val + "…") > maxW) val = val.slice(0, -1);
          val += "…";
        }
        doc.text(val, bx + boxW - 4, ry, { align: "right" });
      });
      return h;
    }
    const utilisation = p.vehicleCapacity ? Math.min(999, Math.round((Number(p.totalCft) / Number(p.vehicleCapacity)) * 100)) + "%" : "—";
    const h1 = infoBox(M, "Customer", [
      ["Name", p.customerName],
      ["Phone", p.phone],
      ["Email", p.email],
    ]);
    const h2 = infoBox(M + boxW + 6, "Move details", [
      ["From → To", (p.pickup || "—") + " → " + (p.drop || "—")],
      ["Distance", Number(p.distanceKm || 0) + " KM"],
      ["Est. delivery", p.delivery || "To be confirmed"],
      ["Move type", typeLabel],
      ["Vehicle", p.vehicleName || "—"],
      ["Volume / capacity", Number(p.totalCft || 0).toFixed(1) + " CFT" + (p.vehicleCapacity ? " / " + p.vehicleCapacity + " CFT (" + utilisation + ")" : "")],
    ]);
    y += Math.max(h1, h2) + 7;

    /* ---------- Items ---------- */
    const tableBase = {
      margin: { left: M, right: M, bottom: 20 },
      styles: { font: FONT, fontSize: 9.5, textColor: INK, cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 }, lineColor: LINE, lineWidth: { bottom: 0.2 } },
      headStyles: { font: FONT, fontStyle: "bold", fillColor: SOFT, textColor: INK, fontSize: 8.5, lineColor: STRONG_LINE, lineWidth: { bottom: 0.3 } },
      footStyles: { font: FONT, fontStyle: "bold", textColor: INK, lineColor: STRONG_LINE, lineWidth: { top: 0.3 } },
      theme: "plain",
    };

    set(11, "bold", INK);
    doc.text("Items", M, y);
    const items = p.items || [];
    doc.autoTable({
      ...tableBase,
      startY: y + 2,
      head: [["#", "Item", "Qty", "CFT / item", "Total CFT"]],
      body: items.map((it, i) => [i + 1, it.name, it.quantity, Number(it.cftPerItem || 0).toFixed(2), Number(it.totalCft || 0).toFixed(2)]),
      showFoot: "lastPage",
      foot: [["", "Total", items.reduce((s, it) => s + Number(it.quantity || 0), 0), "", Number(p.totalCft || 0).toFixed(2)]],
      columnStyles: {
        0: { cellWidth: 9, textColor: MUTED },
        2: { halign: "right", cellWidth: 18 },
        3: { halign: "right", cellWidth: 26 },
        4: { halign: "right", cellWidth: 26 },
      },
      didParseCell: (d) => {
        if ((d.section === "head" || d.section === "foot") && d.column.index >= 2) d.cell.styles.halign = "right";
      },
    });
    y = doc.lastAutoTable.finalY + 8;

    /* ---------- Charges ---------- */
    if (y > H - 70) {
      doc.addPage();
      y = 20;
    }
    set(11, "bold", INK);
    doc.text("Charges", M, y);
    const charges = [[p.transportLabel || "Transport — " + typeLabel, money(p.transportAmount)]];
    if (p.fallbackDistanceAmount) charges.push([p.fallbackDistanceLabel || "Distance charge", money(p.fallbackDistanceAmount)]);
    const discountRow = Number(p.discount) > 0 ? charges.length : -1;
    if (discountRow >= 0) charges.push([p.discountLabel || "Discount on transport", "− " + money(p.discount)]);
    (p.services || []).forEach((s) => charges.push([s.name + (s.detail ? "  (" + s.detail + ")" : ""), money(s.amount)]));
    doc.autoTable({
      ...tableBase,
      startY: y + 2,
      head: [["Description", "Amount"]],
      body: charges,
      columnStyles: { 1: { halign: "right", cellWidth: 40 } },
      didParseCell: (d) => {
        if (d.section === "head" && d.column.index === 1) d.cell.styles.halign = "right";
        if (d.section === "body" && d.row.index === discountRow) d.cell.styles.fontStyle = "bold";
      },
    });
    y = doc.lastAutoTable.finalY + 2;

    y += 2;

    /* ---------- Total ---------- */
    if (y > H - 45) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor.apply(doc, STRONG_LINE);
    doc.setLineWidth(0.5);
    doc.setFillColor.apply(doc, SOFT);
    doc.roundedRect(M, y, W - M * 2, 19, 1.5, 1.5, "FD");
    doc.setLineWidth(0.2);
    set(11, "bold", INK);
    doc.text((Number(p.discount) > 0 ? "Final amount (" : "Total amount (") + typeLabel + ")", M + 5, y + 8.5);
    set(9, "normal", MUTED);
    doc.text("Estimated delivery: " + (p.delivery || "To be confirmed"), M + 5, y + 14);
    set(17, "bold", INK);
    doc.text(money(p.total), W - M - 5, y + 12, { align: "right" });
    y += 26;

    if (p.overflow) {
      set(9.5, "bold", INK);
      doc.text("Note: the load exceeds the largest vehicle — more than one vehicle is required.", M, y);
      y += 6;
    }

    /* ---------- Notes & terms ---------- */
    function block(title, lines) {
      if (!lines.length) return;
      set(10, "bold", INK);
      const wrapped = [];
      lines.forEach((l) => doc.splitTextToSize(l, W - M * 2 - 4).forEach((w) => wrapped.push(w)));
      if (y + 6 + wrapped.length * 4.6 > H - 20) {
        doc.addPage();
        y = 20;
      }
      doc.text(title, M, y);
      y += 5.5;
      set(9, "normal", MUTED);
      wrapped.forEach((w) => {
        doc.text(w, M, y);
        y += 4.6;
      });
      y += 3;
    }
    block("Notes", p.notes ? [p.notes] : []);
    const terms = splitTerms(p.terms);
    block(
      "Terms & conditions",
      (terms.length ? terms : ["Basic dismantling and reassembly of nut-and-bolt furniture are included.",
      "Unpacking, basic arrangement, and removal of packing materials are included.",
      "Cupboards, wardrobes, cabinets, and drawers must be emptied before shifting.",
      "Do not pack cash, jewellery, important documents, or other valuables. The Company is not responsible for any loss or damage to such items",
      " Full payment must be completed before unloading at the destination. ",
      "Any damage or shortage must be reported immediately upon delivery. Claims made after the delivery team leaves the premises will not be accepted.",
      "Additional rope charges will apply if items cannot be moved through the lift or staircase and require rope lifting.",
      "Any items beyond the quoted inventory will be charged additionally: 350 per extra small item/carton."]).map((t, i) => i + 1 + ". " + t)
    );

    /* ---------- Footer on every page ---------- */
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor.apply(doc, LINE);
      doc.line(M, H - 13, W - M, H - 13);
      set(8, "normal", MUTED);
      doc.text([p.companyName || "StowNest", p.companyPhone, p.companyEmail, p.companyWebsite].filter(Boolean).join("  •  "), M, H - 8);
      doc.text("Page " + i + " of " + pages, W - M, H - 8, { align: "right" });
    }

    const name = ["Quote", safeFile(p.bookingId), safeFile(p.customerName)].filter(Boolean).join("_") + ".pdf";
    doc.save(name);
    return name;
  }

  global.QuotePdf = { download };
})(window);
