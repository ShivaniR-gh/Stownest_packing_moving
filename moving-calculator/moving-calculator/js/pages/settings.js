window.Pages = window.Pages || {};

Pages.settings = function (root) {
  const s = SettingsService.get();
  const users = AuthService.list();

  function paint() {
    const latest = AuthService.list();
    const cfg = SettingsService.get();
    root.innerHTML = `
      <div class="grid-2" style="margin-bottom:16px">
        <div class="card">
          <div class="card-hd"><h3>Application</h3></div>
          <div class="card-bd">
            <div class="field"><label>Company name</label><input id="company" value="${Helpers.escapeHtml(cfg.companyName)}" /></div>
            <div class="field" style="margin-top:12px"><label>Currency symbol</label><input id="sym" value="${Helpers.escapeHtml(cfg.currencySymbol)}" /></div>
            <div class="field" style="margin-top:12px"><label>Currency code</label><input id="code" value="${Helpers.escapeHtml(cfg.currencyCode)}" /></div>
            <button class="btn" id="save" style="margin-top:16px">Save settings</button>
          </div>
        </div>
        <div class="card">
          <div class="card-hd"><h3>Security</h3></div>
          <div class="card-bd">
            <label class="check" style="display:flex;gap:8px;align-items:center">
              <input id="requireLogin" type="checkbox" ${cfg.requireLogin !== false ? "checked" : ""} />
              Require login
            </label>
            <p class="help">When on, employees must sign in. Only admins can edit items, vehicles, cities, extra services and users.</p>
            <div class="field" style="margin-top:12px"><label>Session length (minutes)</label><input id="sessionMins" type="number" min="15" value="${Helpers.number(cfg.sessionMinutes) || 480}" /></div>
            <button class="btn" id="saveSec" style="margin-top:16px">Save security</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-hd"><h3>GitHub shared data</h3></div>
        <div class="card-bd">
          <p class="help">Host the app on GitHub Pages. Cities, prices, items and users are saved to <code>data/masters.json</code> in the same repo so other computers can load them. Quotes are not stored.</p>
          <label class="check" style="display:flex;gap:8px;align-items:center;margin:10px 0">
            <input id="ghOn" type="checkbox" ${cfg.githubEnabled ? "checked" : ""} />
            Save masters to GitHub
          </label>
          <div class="form-grid form-grid-2">
            <div class="field"><label>Owner</label><input id="ghOwner" value="${Helpers.escapeHtml(cfg.githubOwner || "")}" placeholder="your-org" /></div>
            <div class="field"><label>Repo</label><input id="ghRepo" value="${Helpers.escapeHtml(cfg.githubRepo || "")}" placeholder="moving-calculator" /></div>
            <div class="field"><label>Branch</label><input id="ghBranch" value="${Helpers.escapeHtml(cfg.githubBranch || "main")}" /></div>
            <div class="field"><label>Token (admin write)</label><input id="ghToken" type="password" value="${Helpers.escapeHtml(cfg.githubToken || "")}" placeholder="ghp_..." /></div>
          </div>
          <p class="help">Create a fine-grained token with Contents: Read and write. Keep the token on admin computers only. Use a private repo if you publish users.</p>
          <div class="toolbar" style="margin-top:12px">
            <button class="btn" id="ghSave">Save GitHub settings</button>
            <button class="btn secondary" id="ghPull">Pull from GitHub</button>
            <button class="btn secondary" id="ghPush">Publish to GitHub</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-hd">
          <h3>Users</h3>
          <button class="btn sm" id="addUser">Add user</button>
        </div>
        <div class="card-bd help" style="padding-bottom:0">Admin can add / edit / delete masters. Employee can only open Home and Quote Calculator.</div>
        <div class="card-bd table-wrap">
          <table class="data">
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Active</th><th></th></tr></thead>
            <tbody>
              ${latest
                .map(
                  (u) => `<tr>
                    <td>${Helpers.escapeHtml(u.name)}</td>
                    <td>${Helpers.escapeHtml(u.username)}</td>
                    <td><span class="badge ${u.role === "admin" ? "ok" : "muted"}">${u.role === "admin" ? "Admin" : "Employee"}</span></td>
                    <td>${u.active === false ? "No" : "Yes"}</td>
                    <td>
                      <button class="btn sm secondary" data-edit="${u.id}">Edit</button>
                      <button class="btn sm danger-outline" data-del="${u.id}">Delete</button>
                    </td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-hd"><h3>Data store</h3></div>
        <div class="card-bd">
          <p class="help">Masters stay in this browser. Export a backup before a factory reset.</p>
          <div class="toolbar" style="margin-top:12px">
            <button class="btn secondary" id="export">Export JSON backup</button>
            <label class="btn secondary" style="cursor:pointer">Import JSON<input id="import" type="file" accept="application/json" hidden /></label>
            <button class="btn danger-outline" id="reset">Factory reset</button>
          </div>
        </div>
      </div>
    `;
    bind();
  }

  function openUser(existing) {
    const wrap = document.createElement("div");
    wrap.className = "modal-back";
    wrap.innerHTML = `
      <div class="modal">
        <header><h3>${existing ? "Edit user" : "Add user"}</h3></header>
        <div class="body">
          <div class="field"><label>Name</label><input id="uName" value="${Helpers.escapeHtml((existing && existing.name) || "")}" /></div>
          <div class="field" style="margin-top:10px"><label>Username</label><input id="uUser" value="${Helpers.escapeHtml((existing && existing.username) || "")}" ${existing ? "disabled" : ""} /></div>
          <div class="field" style="margin-top:10px"><label>Role</label>
            <select id="uRole">
              <option value="employee" ${existing && existing.role === "employee" ? "selected" : ""}>Employee — calculator only</option>
              <option value="admin" ${!existing || existing.role === "admin" ? "selected" : ""}>Admin — can edit rates, cities, users</option>
            </select>
          </div>
          <div class="field" style="margin-top:10px"><label>${existing ? "New password (leave blank to keep)" : "Password"}</label><input id="uPass" type="password" /></div>
          ${
            existing
              ? `<label class="check" style="display:flex;gap:8px;align-items:center;margin-top:12px"><input id="uActive" type="checkbox" ${existing.active === false ? "" : "checked"} /> Active</label>`
              : ""
          }
        </div>
        <footer>
          <button class="btn secondary" data-a="no">Cancel</button>
          <button class="btn" data-a="yes">Save</button>
        </footer>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener("click", (e) => {
      const a = e.target.getAttribute("data-a");
      if (a === "no" || e.target === wrap) wrap.remove();
      if (a === "yes") {
        try {
          const name = wrap.querySelector("#uName").value.trim();
          const username = wrap.querySelector("#uUser").value.trim();
          const role = wrap.querySelector("#uRole").value;
          const password = wrap.querySelector("#uPass").value;
          if (existing) {
            AuthService.save({
              ...existing,
              name: name || existing.name,
              role,
              active: wrap.querySelector("#uActive").checked,
            });
            if (password) AuthService.setPassword(existing.id, password);
          } else {
            AuthService.create({ name, username, password, role });
          }
          wrap.remove();
          UI.toast("User saved.");
          paint();
        } catch (err) {
          UI.toast(err.message || "Could not save user.", "error");
        }
      }
    });
  }

  function bind() {
    root.querySelector("#save").addEventListener("click", () => {
      SettingsService.save({
        companyName: root.querySelector("#company").value.trim() || s.companyName,
        currencySymbol: root.querySelector("#sym").value.trim() || "₹",
        currencyCode: root.querySelector("#code").value.trim() || "INR",
      });
      UI.toast("Settings saved.");
      location.reload();
    });
    root.querySelector("#ghSave").addEventListener("click", () => {
      const current = SettingsService.get();
      SettingsService.save({
        ...current,
        githubEnabled: root.querySelector("#ghOn").checked,
        githubOwner: root.querySelector("#ghOwner").value.trim(),
        githubRepo: root.querySelector("#ghRepo").value.trim(),
        githubBranch: root.querySelector("#ghBranch").value.trim() || "main",
        githubToken: root.querySelector("#ghToken").value.trim(),
        githubPath: "data/masters.json",
      });
      UI.toast("GitHub settings saved.");
    });
    root.querySelector("#ghPull").addEventListener("click", async () => {
      try {
        const r = await GithubSync.pull();
        UI.toast(r.ok ? "Pulled shared masters." : r.reason);
        if (r.ok) location.reload();
      } catch (err) {
        UI.toast(err.message || "Pull failed.", "error");
      }
    });
    root.querySelector("#ghPush").addEventListener("click", async () => {
      try {
        await GithubSync.push();
        UI.toast("Published cities and prices to GitHub.");
      } catch (err) {
        UI.toast(err.message || "Publish failed.", "error");
      }
    });
    root.querySelector("#saveSec").addEventListener("click", () => {
      const current = SettingsService.get();
      SettingsService.save({
        ...current,
        requireLogin: root.querySelector("#requireLogin").checked,
        sessionMinutes: Math.max(15, Helpers.number(root.querySelector("#sessionMins").value) || 480),
      });
      UI.toast("Security saved.");
    });
    root.querySelector("#addUser").addEventListener("click", () => openUser(null));
    root.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => openUser(AuthService.get(btn.getAttribute("data-edit"))));
    });
    root.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await UI.confirmModal({
          title: "Delete user",
          body: "Remove this login?",
          confirmText: "Delete",
          danger: true,
        });
        if (!ok) return;
        try {
          AuthService.remove(btn.getAttribute("data-del"));
          paint();
        } catch (err) {
          UI.toast(err.message || "Could not delete.", "error");
        }
      });
    });
    root.querySelector("#export").addEventListener("click", () => {
      Helpers.downloadJson("stownest-backup.json", StorageService.exportAll());
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
        body: "This restores seed masters and the default admin login.",
        confirmText: "Reset",
        danger: true,
      });
      if (ok) {
        StorageService.factoryReset();
        AuthService.logout();
        UI.toast("Store reset to defaults.");
        location.hash = "#/";
        location.reload();
      }
    });
  }

  paint();
};
