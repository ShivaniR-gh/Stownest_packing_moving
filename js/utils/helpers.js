(function (global) {
  function uid(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }

  function todayISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatMoney(amount, symbol) {
    const n = Number(amount) || 0;
    const s = symbol || (global.StorageService && StorageService.getSettings().currencySymbol) || "₹";
    return s + n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  }

  function number(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function slug(str) {
    return String(str || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function nextBookingId(orders) {
    const year = new Date().getFullYear();
    const prefix = "ORD-" + year + "-";
    let max = 0;
    (orders || []).forEach((o) => {
      const id = o.bookingId || o.id || "";
      if (String(id).startsWith(prefix)) {
        const n = Number(String(id).slice(prefix.length));
        if (n > max) max = n;
      }
    });
    return prefix + String(max + 1).padStart(4, "0");
  }

  function pricingTypeLabel(type) {
    const map = {
      fixed: "Fixed",
      per_item: "Per item",
      per_box: "Per box",
      per_km: "Per KM",
      per_hour: "Per hour",
      percentage: "Percentage",
    };
    return map[type] || type;
  }

  global.Helpers = {
    uid,
    todayISO,
    formatDate,
    formatMoney,
    number,
    escapeHtml,
    slug,
    downloadJson,
    nextBookingId,
    pricingTypeLabel,
  };
})(window);
