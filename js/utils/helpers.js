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
    const s = symbol || (global.DataStore && DataStore.currency()) || "₹";
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

  /** Quote reference, e.g. Q-260921-4F7K (date + random). Quotes are not stored anywhere. */
  function quoteId() {
    const d = new Date();
    const ymd = String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    return "Q-" + ymd + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
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
    quoteId,
    pricingTypeLabel,
  };
})(window);
