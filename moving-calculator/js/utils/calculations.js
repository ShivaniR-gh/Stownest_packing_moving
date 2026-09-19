/**
 * Pricing & vehicle selection engine.
 * Intercity quotes come from the dedicated / sharing route matrix.
 * Fallback (no matching lane) uses CFT rate + KM rate.
 */
(function (global) {
  function calculateItemCft(quantity, cftPerItem) {
    return Helpers.number(quantity) * Helpers.number(cftPerItem);
  }

  function calculateTotalCft(rows) {
    return (rows || []).reduce((sum, row) => sum + calculateItemCft(row.quantity, row.cftPerItem), 0);
  }

  function totalItemCount(rows) {
    return (rows || []).reduce((sum, row) => sum + Helpers.number(row.quantity), 0);
  }

  function boxCount(rows) {
    return (rows || []).reduce((sum, row) => {
      const cat = String(row.category || "").toLowerCase();
      const unit = String(row.unit || "").toLowerCase();
      const name = String(row.name || "").toLowerCase();
      const isBox = cat === "boxes" || unit === "box" || name.includes("carton") || name.includes("box");
      return sum + (isBox ? Helpers.number(row.quantity) : 0);
    }, 0);
  }

  function normalizeCity(name) {
    let s = Helpers.slug(name);
    if (s === "kolkatta") s = "kolkata";
    if (s === "bengaluru") s = "bangalore";
    return s;
  }

  function findRoute(pickup, drop, routes) {
    const a = normalizeCity(pickup);
    const b = normalizeCity(drop);
    if (!a || !b) return null;
    return (
      (routes || []).find((r) => {
        const from = normalizeCity(r.from);
        const to = normalizeCity(r.to);
        return (from === a && to === b) || (from === b && to === a);
      }) || null
    );
  }

  function tablePrice(route, vehicleId, moveType) {
    if (!route || !vehicleId) return 0;
    const table = moveType === "sharing" ? route.sharing || {} : route.dedicated || {};
    return Helpers.number(table[vehicleId]);
  }

  /**
   * Smallest active vehicle whose max CFT >= total CFT.
   * If a route is present, skip sizes that have no price for the selected move type
   * (and also skip if BOTH modes are 0 so recommendation still works).
   */
  function getRecommendedVehicle(totalCft, vehicles, route, moveType) {
    const active = (vehicles || [])
      .filter((v) => v.active !== false)
      .slice()
      .sort((a, b) => Helpers.number(a.maxCft) - Helpers.number(b.maxCft));

    if (!active.length) {
      return {
        vehicle: null,
        status: "unconfigured",
        message: "No active vehicles configured.",
        remaining: 0,
        overflow: totalCft,
      };
    }

    const priced = route
      ? active.filter((v) => {
          const selected = tablePrice(route, v.id, moveType || "dedicated");
          const other = tablePrice(route, v.id, moveType === "sharing" ? "dedicated" : "sharing");
          return selected > 0 || other > 0;
        })
      : active;

    const pool = priced.length ? priced : active;
    const fit = pool.find((v) => Helpers.number(v.maxCft) >= Helpers.number(totalCft) && (!route || tablePrice(route, v.id, moveType || "dedicated") > 0 || tablePrice(route, v.id, "dedicated") > 0));
    const fitForMode = pool.find((v) => Helpers.number(v.maxCft) >= Helpers.number(totalCft) && (!route || tablePrice(route, v.id, moveType || "dedicated") > 0));

    const chosen = fitForMode || fit;
    if (chosen) {
      return {
        vehicle: chosen,
        status: "ok",
        message: "",
        remaining: Helpers.number(chosen.maxCft) - Helpers.number(totalCft),
        overflow: 0,
      };
    }

    const largest = pool[pool.length - 1];
    return {
      vehicle: null,
      largest,
      status: "overflow",
      message: "Multiple Vehicles Required",
      remaining: 0,
      overflow: Helpers.number(totalCft) - Helpers.number(largest && largest.maxCft),
    };
  }

  function calculateDistanceCharge(distanceKm, distanceCfg) {
    const km = Math.max(0, Helpers.number(distanceKm));
    const rate = Helpers.number(distanceCfg.ratePerKm) || Helpers.number(distanceCfg.additionalKmRate);
    const min = Helpers.number(distanceCfg.minimumCharge);
    const amount = Math.max(min, km * rate);
    return {
      includedKm: 0,
      extraKm: km,
      rate,
      amount,
      formula: km > 0 ? `${km} KM × ${rate} = ${amount}` : "No distance entered",
    };
  }

  function calculateServiceCharge(service, ctx) {
    const rate = Helpers.number(service.rate);
    const type = service.pricingType;
    const qty = Helpers.number(service.quantity, 1);
    let amount = 0;
    let formula = "";

    switch (type) {
      case "fixed":
        amount = rate * (service.enabled === false ? 0 : 1);
        formula = `Fixed ${rate}`;
        break;
      case "per_item":
        amount = rate * ctx.itemCount * qty;
        formula = `${rate} × ${ctx.itemCount} items`;
        break;
      case "per_box":
        amount = rate * ctx.boxCount * qty;
        formula = `${rate} × ${ctx.boxCount} boxes`;
        break;
      case "per_km":
        amount = rate * ctx.distanceKm * qty;
        formula = `${rate} × ${ctx.distanceKm} KM`;
        break;
      case "per_hour":
        amount = rate * qty;
        formula = `${rate} × ${qty} hr`;
        break;
      case "percentage":
        amount = (rate / 100) * ctx.subtotalBeforePercent;
        formula = `${rate}% of ${ctx.subtotalBeforePercent}`;
        break;
      default:
        amount = rate;
        formula = String(rate);
    }

    return { amount, formula, type, rate };
  }

  function modeQuote(route, vehicle, totalCft, moveType) {
    if (!route || !vehicle) {
      return { available: false, vehiclePrice: 0, amount: 0, formula: "Select pickup, drop and items", fillRatio: 0 };
    }
    const vehiclePrice = tablePrice(route, vehicle.id, moveType);
    if (vehiclePrice <= 0) {
      return {
        available: false,
        vehiclePrice: 0,
        amount: 0,
        formula: `${moveType === "sharing" ? "Sharing" : "Dedicated"} not offered for ${vehicle.name} on this lane`,
        fillRatio: 0,
      };
    }
    const cap = Helpers.number(vehicle.maxCft) || 1;
    const fillRatio = Math.min(1, Helpers.number(totalCft) / cap);
    if (moveType === "sharing") {
      const amount = Math.round(vehiclePrice * fillRatio);
      return {
        available: true,
        vehiclePrice,
        amount,
        fillRatio,
        formula: `${totalCft.toFixed(1)} / ${cap} CFT × ${vehiclePrice} sharing`,
      };
    }
    return {
      available: true,
      vehiclePrice,
      amount: vehiclePrice,
      fillRatio,
      formula: `Full ${vehicle.name} dedicated`,
    };
  }

  function calculateOrderTotal(input) {
    const rows = input.items || [];
    const totalCft = calculateTotalCft(rows);
    const itemCount = totalItemCount(rows);
    const boxes = boxCount(rows);
    const moveType = input.moveType === "sharing" ? "sharing" : "dedicated";
    const route = findRoute(input.pickup, input.drop, input.routes || []);
    const distanceKm = route ? Helpers.number(route.km) : Helpers.number(input.distanceKm);
    const rec = getRecommendedVehicle(totalCft, input.vehicles, route, moveType);
    const vehicle = rec.vehicle;

    const dedicated = modeQuote(route, vehicle, totalCft, "dedicated");
    const sharing = modeQuote(route, vehicle, totalCft, "sharing");
    const selectedQuote = moveType === "sharing" ? sharing : dedicated;

    const perCftRate = Helpers.number((input.distance || {}).perCftRate);
    const fallbackDistance = calculateDistanceCharge(distanceKm, input.distance || {});
    const fallbackCftCharge = totalCft * perCftRate;

    let transportAmount = 0;
    let transportFormula = "";
    let pricingMode = "fallback";
    if (route && vehicle && selectedQuote.available) {
      transportAmount = selectedQuote.amount;
      transportFormula = selectedQuote.formula;
      pricingMode = "route";
    } else if (route && vehicle && !selectedQuote.available) {
      transportAmount = 0;
      transportFormula = selectedQuote.formula;
      pricingMode = "unavailable";
    } else {
      transportAmount = fallbackCftCharge + fallbackDistance.amount;
      transportFormula = route
        ? "Lane found but no vehicle price — using fallback"
        : `Fallback: ${totalCft.toFixed(1)} CFT × ${perCftRate} + ${fallbackDistance.formula}`;
      pricingMode = "fallback";
    }

    const selectedServices = (input.selectedServices || []).filter((s) => s.enabled !== false);
    const nonPercent = selectedServices.filter((s) => s.pricingType !== "percentage");
    const percent = selectedServices.filter((s) => s.pricingType === "percentage");

    const ctxBase = {
      itemCount,
      boxCount: boxes,
      distanceKm,
      totalCft,
      subtotalBeforePercent: 0,
    };

    const serviceLines = [];
    let serviceTotal = 0;

    nonPercent.forEach((s) => {
      const calc = calculateServiceCharge(s, ctxBase);
      serviceLines.push({
        id: s.id,
        name: s.name,
        amount: calc.amount,
        formula: calc.formula,
        pricingType: s.pricingType,
      });
      serviceTotal += calc.amount;
    });

    const subtotalBeforePercent = transportAmount + serviceTotal;
    percent.forEach((s) => {
      const calc = calculateServiceCharge(s, { ...ctxBase, subtotalBeforePercent });
      serviceLines.push({
        id: s.id,
        name: s.name,
        amount: calc.amount,
        formula: calc.formula,
        pricingType: s.pricingType,
      });
      serviceTotal += calc.amount;
    });

    const total = transportAmount + serviceTotal;

    return {
      itemCount,
      boxCount: boxes,
      totalCft,
      recommendation: rec,
      vehicle,
      moveType,
      route,
      distanceKm,
      delivery: route ? route.delivery : "",
      dedicated,
      sharing,
      selectedQuote,
      pricingMode,
      transportAmount,
      transportFormula,
      perCftRate,
      cftCharge: pricingMode === "fallback" ? fallbackCftCharge : 0,
      additionalCftCharge: pricingMode === "fallback" ? fallbackCftCharge : 0,
      extraCftRate: perCftRate,
      floorCharge: 0,
      distance: {
        ...fallbackDistance,
        amount: pricingMode === "fallback" ? fallbackDistance.amount : 0,
        formula: route ? `${distanceKm} KM` + (route.delivery ? ` · ${route.delivery}` : "") : fallbackDistance.formula,
      },
      serviceLines,
      serviceTotal,
      total,
    };
  }

  global.Calc = {
    calculateItemCft,
    calculateTotalCft,
    totalItemCount,
    boxCount,
    getRecommendedVehicle,
    calculateDistanceCharge,
    calculateServiceCharge,
    calculateOrderTotal,
    findRoute,
    normalizeCity,
    tablePrice,
  };
})(window);
