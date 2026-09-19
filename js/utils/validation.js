(function (global) {
  function isBlank(v) {
    return String(v ?? "").trim() === "";
  }

  function validateCustomer(form) {
    const errors = {};
    if (isBlank(form.customerName)) errors.customerName = "Customer name is required.";
    if (!isBlank(form.phone) && !/^[0-9+\-\s]{7,15}$/.test(form.phone.trim())) {
      errors.phone = "Enter a valid phone number.";
    }
    if (!isBlank(form.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (Helpers.number(form.distanceKm) < 0) errors.distanceKm = "Distance cannot be negative.";
    return errors;
  }

  function validateItem(item, existing, editingId) {
    const errors = {};
    if (isBlank(item.name)) errors.name = "Item name is required.";
    if (Helpers.number(item.cft) < 0) errors.cft = "CFT cannot be negative.";
    const nameKey = Helpers.slug(item.name);
    const dup = (existing || []).some(
      (x) => x.id !== editingId && Helpers.slug(x.name) === nameKey && Helpers.slug(x.category) === Helpers.slug(item.category)
    );
    if (dup) errors.name = "An item with this name already exists in the same category.";
    return errors;
  }

  function validateVehicle(v, existing, editingId) {
    const errors = {};
    if (isBlank(v.name)) errors.name = "Vehicle name is required.";
    if (Helpers.number(v.maxCft) < 0) errors.maxCft = "Capacity cannot be negative.";
    if (Helpers.number(v.basePrice) < 0) errors.basePrice = "Base price cannot be negative.";
    if (Helpers.number(v.additionalCftRate) < 0) errors.additionalCftRate = "Additional CFT rate cannot be negative.";
    const dup = (existing || []).some((x) => x.id !== editingId && Helpers.slug(x.name) === Helpers.slug(v.name));
    if (dup) errors.name = "A vehicle with this name already exists.";
    return errors;
  }

  function validateService(s, existing, editingId) {
    const errors = {};
    if (isBlank(s.name)) errors.name = "Service name is required.";
    if (Helpers.number(s.rate) < 0) errors.rate = "Rate cannot be negative.";
    const dup = (existing || []).some((x) => x.id !== editingId && Helpers.slug(x.name) === Helpers.slug(s.name));
    if (dup) errors.name = "A service with this name already exists.";
    return errors;
  }

  function validateDistance(cfg) {
    const errors = {};
    ["baseDistanceIncluded", "ratePerKm", "minimumCharge", "additionalKmRate"].forEach((k) => {
      if (Helpers.number(cfg[k]) < 0) errors[k] = "Value cannot be negative.";
    });
    return errors;
  }

  global.Validation = {
    isBlank,
    validateCustomer,
    validateItem,
    validateVehicle,
    validateService,
    validateDistance,
  };
})(window);
