window.Pages = window.Pages || {};

Pages.settings = function (root) {
  const s = SettingsService.get();
  root.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-hd"><h3>Application</h3></div>
        <div class="card-bd">
          <div class="field"><label>Company name</label><input id="company" value="${Helpers.escapeHtml(s.companyName)}" /></div>
          <div class="field" style="margin-top:12px"><label>Currency symbol</label><input id="sym" value="${Helpers.escapeHtml(s.currencySymbol)}" /></div>
          <div class="field" style="margin-top:12px"><label>Currency code</label><input id="code" value="${Helpers.escapeHtml(s.currencyCode)}" /></div>
          <button class="btn" id="save" style="margin-top:16px">Save settings</button>
        </div>
      </div>
      <div class="card">
        <div class="card-hd"><h3>Data store</h3></div>
        <div class="card-bd">
          <p class="help">This version stores masters and orders in the browser (localStorage) through a service layer. Replacing the storage service with a REST API later does not require rewriting the pages.</p>
          <div class="toolbar" style="margin-top:12px">
            <button class="btn secondary" id="export">Export JSON backup</button>
            <label class="btn secondary" style="cursor:pointer">Import JSON<input id="import" type="file" accept="application/json" hidden /></label>
            <button class="btn danger-outline" id="reset">Factory reset</button>
          </div>
        </div>
      </div>
    </div>
  `;

  root.querySelector("#save").addEventListener("click", () => {
    SettingsService.save({
      companyName: root.querySelector("#company").value.trim() || s.companyName,
      currencySymbol: root.querySelector("#sym").value.trim() || "₹",
      currencyCode: root.querySelector("#code").value.trim() || "INR",
    });
    UI.toast("Settings saved.");
    location.reload();
  });

  root.querySelector("#export").addEventListener("click", () => {
    Helpers.downloadJson("greenshift-backup.json", StorageService.exportAll());
  });

  root.querySelector("#import").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      StorageService.importAll(payload);
      UI.toast("Backup imported.");
      location.reload();
    } catch {
      UI.toast("Could not import that file.", "error");
    }
  });

  root.querySelector("#reset").addEventListener("click", async () => {
    const ok = await UI.confirmModal({
      title: "Reset all data",
      body: "This restores seed item, vehicle and rate masters and deletes saved orders.",
      confirmText: "Reset",
      danger: true,
    });
    if (ok) {
      StorageService.factoryReset();
      UI.toast("Store reset to defaults.");
      location.hash = "#/";
      location.reload();
    }
  });
};
