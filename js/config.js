/**
 * Connection settings only — NO business data lives in the code.
 * Items, vehicles, cities, lanes, prices, services, settings and users
 * are all read from the Google Sheet through the Apps Script web app.
 */
window.AppConfig = {
  // Apps Script → Deploy → Web app URL (ends with /exec)
  sheetApiUrl: "https://script.google.com/macros/s/AKfycbysOD1gZ6kthJ0WTCqKNKXhss38Jm_8sS2lqAaOBS41usEBbMCn3_jKSDWcKRgjIovP/exec",

  // Link shown to admins so they know where to edit data
  sheetUrl: "https://docs.google.com/spreadsheets/d/1uQXbyJxr8XeyeEAEq3NXaOt85IwH2jxeraEhl49-JcQ/edit",
};
