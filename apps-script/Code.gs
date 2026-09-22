/**
 * StowNest Moving Calculator — Google Sheet API (read-only)
 *
 * The Google Sheet is the ONLY source of data. The web app never writes to it.
 * Edit data directly in the sheet; the web app shows it on next load / "Refresh".
 *
 * Tabs (header row 1, data from row 2):
 *   Settings  key | value
 *   Users     username | name | role | active | passwordHash
 *   Vehicles  id | name | maxCft | active
 *   Items     id | name | cft | unit | active
 *   Cities    city | aliases            (aliases comma separated, e.g. "Bengaluru, BLR")
 *   Lanes     from | to | km | delivery | <Vehicle name> dedicated | <Vehicle name> sharing | ...
 *   Services  id | name | pricingType | rate | active
 *             pricingType: fixed | per_item | per_box | per_km | per_hour | percentage
 *
 * Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone.
 * Set passwords from the sheet menu: StowNest → Set user password…
 */

var TABS = {
  Settings: ["key", "value"],
  Users: ["username", "name", "role", "active", "passwordHash"],
  Vehicles: ["id", "name", "maxCft", "active"],
  Items: ["id", "name", "cft", "unit", "active"],
  Cities: ["city", "aliases"],
  Lanes: ["from", "to", "km", "delivery"],
  Services: ["id", "name", "pricingType", "rate", "active"]
};

/* ---------------- Web app entry points ---------------- */

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action === "ping") return out_({ ok: true, companyName: masters_().settings.companyName || "" });
    if (p.fresh) clearCache_(); // "Refresh from sheet" button bypasses the cache
    var session = verifyToken_(p.token);
    if (!session) return out_({ error: "auth", message: "Session expired. Please sign in again." });
    return out_(loadAll_(session));
  } catch (err) {
    return out_({ error: "server", message: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (body.action === "login") return out_(login_(body.username, body.password));
    return out_({ error: "bad_request", message: "Unknown action. This API is read-only." });
  } catch (err) {
    return out_({ error: "server", message: String(err && err.message ? err.message : err) });
  }
}

/* ---------------- Readers ---------------- */

function loadAll_(session) {
  var m = masters_();
  var data = {
    loadedAt: m.readAt,
    user: session,
    settings: m.settings,
    vehicles: m.vehicles,
    items: m.items,
    cities: m.cities,
    lanes: m.lanes,
    services: m.services
  };
  if (session.role === "admin") data.users = users_().map(publicUser_);
  return data;
}

/* ---------------- Cache (speed) ----------------
 * Reading 7 tabs on every request is the slow part. The parsed data is kept in
 * CacheService and cleared automatically whenever someone edits the sheet (onEdit),
 * when the app's "Refresh from sheet" button is used, or after CACHE_SECONDS.
 */
var CACHE_SECONDS = 600;
var CACHE_KEYS = ["masters", "users"];

function masters_() {
  return cached_("masters", function () {
    var vehicles = readVehicles_();
    return {
      readAt: new Date().toISOString(),
      settings: readSettings_(),
      vehicles: vehicles,
      items: readItems_(),
      cities: readCities_(),
      lanes: readLanes_(vehicles),
      services: readServices_()
    };
  });
}

function users_() {
  return cached_("users", readUsers_);
}

function cached_(key, build) {
  var cache = CacheService.getScriptCache();
  try {
    var n = Number(cache.get(key + ":n") || 0);
    if (n > 0) {
      var keys = [];
      for (var i = 0; i < n; i++) keys.push(key + ":" + i);
      var parts = cache.getAll(keys);
      var json = "";
      for (var j = 0; j < n; j++) {
        if (parts[key + ":" + j] == null) { json = null; break; }
        json += parts[key + ":" + j];
      }
      if (json) return JSON.parse(json);
    }
  } catch (e) { /* fall through and rebuild */ }
  var value = build();
  try {
    var str = JSON.stringify(value);
    var size = 90000; // CacheService limit is 100 KB per entry
    var entries = {};
    var count = Math.ceil(str.length / size) || 1;
    for (var k = 0; k < count; k++) entries[key + ":" + k] = str.substr(k * size, size);
    entries[key + ":n"] = String(count);
    cache.putAll(entries, CACHE_SECONDS);
  } catch (e) { /* caching is best-effort */ }
  return value;
}

function clearCache_() {
  var cache = CacheService.getScriptCache();
  CACHE_KEYS.forEach(function (key) {
    var n = Number(cache.get(key + ":n") || 0);
    var keys = [key + ":n"];
    for (var i = 0; i < Math.max(n, 5); i++) keys.push(key + ":" + i);
    cache.removeAll(keys);
  });
}

/** Simple trigger: any edit in the sheet clears the cache so the app sees it on the next load. */
function onEdit() {
  clearCache_();
}

function readSettings_() {
  var rows = rows_("Settings");
  var out = {};
  rows.forEach(function (r) {
    var k = str_(r.key);
    if (k) out[k] = typeof r.value === "number" ? r.value : str_(r.value);
  });
  return out;
}

function readVehicles_() {
  return rows_("Vehicles")
    .filter(function (r) { return str_(r.name); })
    .map(function (r, i) {
      return { id: str_(r.id) || "veh-" + (i + 1), name: str_(r.name), maxCft: num_(r.maxcft), active: yes_(r.active) };
    });
}

function readItems_() {
  return rows_("Items")
    .filter(function (r) { return str_(r.name); })
    .map(function (r, i) {
      return {
        id: str_(r.id) || "itm-" + (i + 1),
        name: str_(r.name),
        cft: num_(r.cft),
        unit: str_(r.unit) || "pcs",
        active: yes_(r.active)
      };
    });
}

function readCities_() {
  return rows_("Cities")
    .filter(function (r) { return str_(r.city); })
    .map(function (r) {
      return {
        name: str_(r.city),
        aliases: str_(r.aliases).split(",").map(function (a) { return a.trim(); }).filter(String)
      };
    });
}

function readLanes_(vehicles) {
  return rows_("Lanes")
    .filter(function (r) { return str_(r.from) && str_(r.to); })
    .map(function (r, i) {
      var dedicated = {}, sharing = {};
      vehicles.forEach(function (v) {
        var d = pick_(r, [v.name + " dedicated", v.id + " dedicated"]);
        var s = pick_(r, [v.name + " sharing", v.id + " sharing"]);
        if (d !== undefined) dedicated[v.id] = num_(d);
        if (s !== undefined) sharing[v.id] = num_(s);
      });
      return {
        id: "lane-" + (i + 1),
        from: str_(r.from),
        to: str_(r.to),
        km: num_(r.km),
        delivery: str_(r.delivery),
        dedicated: dedicated,
        sharing: sharing
      };
    });
}

function readServices_() {
  var allowed = ["fixed", "per_item", "per_box", "per_km", "per_hour", "percentage"];
  return rows_("Services")
    .filter(function (r) { return str_(r.name); })
    .map(function (r, i) {
      var type = str_(r.pricingtype).toLowerCase().replace(/\s+/g, "_") || "fixed";
      return {
        id: str_(r.id) || "svc-" + (i + 1),
        name: str_(r.name),
        pricingType: allowed.indexOf(type) >= 0 ? type : "fixed",
        rate: num_(r.rate),
        active: yes_(r.active)
      };
    });
}

function readUsers_() {
  return rows_("Users")
    .filter(function (r) { return str_(r.username); })
    .map(function (r) {
      return {
        username: str_(r.username).toLowerCase(),
        name: str_(r.name) || str_(r.username),
        role: str_(r.role).toLowerCase() === "admin" ? "admin" : "employee",
        active: yes_(r.active),
        passwordHash: str_(r.passwordhash)
      };
    });
}

function publicUser_(u) {
  return { username: u.username, name: u.name, role: u.role, active: u.active, hasPassword: !!u.passwordHash };
}

/* ---------------- Auth ---------------- */

function login_(username, password) {
  var uname = str_(username).toLowerCase();
  var user = users_().filter(function (u) { return u.username === uname; })[0];
  if (!user || !user.active || !user.passwordHash || user.passwordHash !== hashPassword_(uname, password)) {
    Utilities.sleep(400);
    return { error: "login", message: "Wrong username or password." };
  }
  var minutes = Math.max(15, num_(masters_().settings.sessionMinutes) || 480);
  var session = { username: user.username, name: user.name, role: user.role, exp: Date.now() + minutes * 60000 };
  // Return the data with the login so the app needs only one request to start.
  return { ok: true, token: signToken_(session), user: session, data: loadAll_(session) };
}

function hashPassword_(username, password) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str_(username).toLowerCase() + ":" + String(password || ""), Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("");
}

function secret_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty("TOKEN_SECRET");
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("TOKEN_SECRET", s);
  }
  return s;
}

function signToken_(payload) {
  var body = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, secret_()));
  return body + "." + sig;
}

function verifyToken_(token) {
  if (!token || String(token).indexOf(".") < 0) return null;
  var parts = String(token).split(".");
  var expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], secret_()));
  if (expected !== parts[1]) return null;
  var session;
  try {
    session = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  } catch (e) {
    return null;
  }
  if (!session || !session.exp || Date.now() > session.exp) return null;
  // Re-check the Users tab so deactivating a user in the sheet locks them out immediately.
  var user = users_().filter(function (u) { return u.username === session.username; })[0];
  if (!user || !user.active) return null;
  return { username: user.username, name: user.name, role: user.role, exp: session.exp };
}

/* ---------------- Sheet menu (run inside the spreadsheet) ---------------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("StowNest")
    .addItem("Create missing tabs", "setupTabs")
    .addItem("Set user password…", "menuSetPassword")
    .addItem("Clear app cache", "menuClearCache")
    .addSeparator()
    .addItem("Sign everyone out", "rotateSecret")
    .addToUi();
}

function setupTabs() {
  var ss = SpreadsheetApp.getActive();
  var created = [];
  Object.keys(TABS).forEach(function (name) {
    var sh = findSheet_(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      SHEETS_MEMO_ = null;
      created.push(name);
    }
    if (sh.getLastRow() === 0) {
      var heads = TABS[name];
      if (name === "Lanes") {
        readVehicles_().forEach(function (v) { heads = heads.concat([v.name + " dedicated", v.name + " sharing"]); });
      }
      sh.getRange(1, 1, 1, heads.length).setValues([heads]).setFontWeight("bold");
      sh.setFrozenRows(1);
    }
  });
  clearCache_();
  SpreadsheetApp.getUi().alert(created.length ? "Created: " + created.join(", ") : "All tabs already exist.");
}

function menuSetPassword() {
  var ui = SpreadsheetApp.getUi();
  var u = ui.prompt("Set user password", "Username:", ui.ButtonSet.OK_CANCEL);
  if (u.getSelectedButton() !== ui.Button.OK) return;
  var username = str_(u.getResponseText()).toLowerCase();
  if (!username) return;
  var p = ui.prompt("Set user password", "New password for " + username + " (min 6 characters):", ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;
  var password = p.getResponseText();
  if (String(password).length < 6) {
    ui.alert("Password must be at least 6 characters.");
    return;
  }
  var sh = findSheet_("Users");
  if (!sh) {
    setupTabs();
    sh = findSheet_("Users");
  }
  var map = headerMap_(sh);
  var hashCol = map["passwordhash"];
  var userCol = map["username"];
  if (hashCol == null || userCol == null) {
    ui.alert("Users tab needs 'username' and 'passwordHash' columns.");
    return;
  }
  var last = sh.getLastRow();
  var values = last > 1 ? sh.getRange(2, userCol + 1, last - 1, 1).getValues() : [];
  var rowIdx = -1;
  for (var i = 0; i < values.length; i++) {
    if (str_(values[i][0]).toLowerCase() === username) { rowIdx = i + 2; break; }
  }
  if (rowIdx < 0) {
    var hasAdmin = readUsers_().some(function (x) { return x.role === "admin" && x.active; });
    var row = [];
    row[userCol] = username;
    if (map["name"] != null) row[map["name"]] = username;
    if (map["role"] != null) row[map["role"]] = hasAdmin ? "employee" : "admin";
    if (map["active"] != null) row[map["active"]] = "yes";
    row[hashCol] = hashPassword_(username, password);
    for (var c = 0; c < sh.getLastColumn(); c++) if (row[c] === undefined) row[c] = "";
    sh.appendRow(row);
    clearCache_();
    ui.alert("Added " + username + " (" + (hasAdmin ? "employee" : "admin") + "). Change name / role in the Users tab.");
  } else {
    sh.getRange(rowIdx, hashCol + 1).setValue(hashPassword_(username, password));
    clearCache_();
    ui.alert("Password updated for " + username + ".");
  }
}

function menuClearCache() {
  clearCache_();
  SpreadsheetApp.getUi().alert("Cache cleared. The app will read fresh data on its next load.");
}

function rotateSecret() {
  PropertiesService.getScriptProperties().setProperty("TOKEN_SECRET", Utilities.getUuid() + Utilities.getUuid());
  SpreadsheetApp.getUi().alert("Done. Everyone must sign in again.");
}

/* ---------------- Helpers ---------------- */

var SHEETS_MEMO_ = null;
var ROWS_MEMO_ = {};

function findSheet_(name) {
  if (!SHEETS_MEMO_) {
    SHEETS_MEMO_ = {};
    SpreadsheetApp.getActive().getSheets().forEach(function (sh) {
      SHEETS_MEMO_[String(sh.getName()).trim().toLowerCase()] = sh;
    });
  }
  return SHEETS_MEMO_[String(name).trim().toLowerCase()] || null;
}

function headerMap_(sh) {
  var last = Math.max(sh.getLastColumn(), 1);
  return headerMapFrom_(sh.getRange(1, 1, 1, last).getValues()[0]);
}

function headerMapFrom_(heads) {
  var map = {};
  heads.forEach(function (h, i) {
    var key = norm_(h);
    if (key && map[key] == null) map[key] = i;
  });
  return map;
}

/** Rows as objects keyed by lower-cased, space-normalised header. One read per tab. Missing tab → []. */
function rows_(name) {
  var memoKey = String(name).toLowerCase();
  if (ROWS_MEMO_[memoKey]) return ROWS_MEMO_[memoKey];
  var sh = findSheet_(name);
  if (!sh) return (ROWS_MEMO_[memoKey] = []);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return (ROWS_MEMO_[memoKey] = []);
  var map = headerMapFrom_(values[0]);
  var keys = Object.keys(map);
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var o = {};
    var any = false;
    for (var k = 0; k < keys.length; k++) {
      var v = row[map[keys[k]]];
      o[keys[k]] = v;
      if (v !== "" && v != null) any = true;
    }
    if (any) out.push(o);
  }
  return (ROWS_MEMO_[memoKey] = out);
}

function pick_(row, keys) {
  for (var i = 0; i < keys.length; i++) {
    var k = norm_(keys[i]);
    if (Object.prototype.hasOwnProperty.call(row, k)) return row[k];
  }
  return undefined;
}

function norm_(v) { return String(v == null ? "" : v).trim().toLowerCase().replace(/\s+/g, " "); }
function str_(v) { return String(v == null ? "" : v).trim(); }
function num_(v) { var n = Number(String(v == null ? "" : v).replace(/[₹,\s]/g, "")); return isFinite(n) ? n : 0; }
function yes_(v) { var s = norm_(v); return !(s === "no" || s === "false" || s === "0" || s === "inactive"); }

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
