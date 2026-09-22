window.Pages = window.Pages || {};

/** Settings & users — view only. Source: Google Sheet tabs "Settings" and "Users". */
Pages.settings = function (root) {
  const s = DataStore.settings();
  const users = DataStore.users();
  const keys = Object.keys(s).sort();

  root.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-hd"><h3>Settings</h3></div>
      ${UI.viewOnlyNote("Settings")}
      <div class="card-bd">
        ${
          keys.length
            ? `<dl class="kv">${keys.map((k) => `<dt>${Helpers.escapeHtml(k)}</dt><dd>${Helpers.escapeHtml(s[k])}</dd>`).join("")}</dl>`
            : `<div class="empty">The Settings tab is empty.</div>`
        }
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-hd"><h3>Users</h3></div>
      ${UI.viewOnlyNote("Users")}
      <div class="card-bd table-wrap" style="padding-top:0">
        <table class="data">
          <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Active</th><th>Password set</th></tr></thead>
          <tbody>
            ${
              users.length
                ? users
                    .map(
                      (u) => `<tr>
                        <td>${Helpers.escapeHtml(u.username)}</td>
                        <td>${Helpers.escapeHtml(u.name)}</td>
                        <td><span class="badge ${u.role === "admin" ? "warn" : "muted"}">${Helpers.escapeHtml(u.role)}</span></td>
                        <td><span class="badge ${u.active ? "ok" : "muted"}">${u.active ? "Yes" : "No"}</span></td>
                        <td>${u.hasPassword ? "Yes" : `<span class="badge danger">No</span>`}</td>
                      </tr>`
                    )
                    .join("")
                : `<tr><td colspan="5"><div class="empty">No users.</div></td></tr>`
            }
          </tbody>
        </table>
        <p class="help" style="margin:10px 0 0">To add a user or change a password, open the sheet and use the menu <strong>StowNest → Set user password…</strong>. Set <code>active</code> to <code>no</code> to block someone — it takes effect on their next request.</p>
      </div>
    </div>

    <div class="card">
      <div class="card-hd"><h3>Connection</h3></div>
      <div class="card-bd">
        <dl class="kv">
          <dt>Apps Script API</dt><dd style="word-break:break-all">${Helpers.escapeHtml(SheetApi.baseUrl())}</dd>
          <dt>Last loaded</dt><dd>${DataStore.loadedAt() ? new Date(DataStore.loadedAt()).toLocaleString("en-IN") : "—"}</dd>
          <dt>Google Sheet</dt><dd>${AppConfig.sheetUrl ? `<a href="${Helpers.escapeHtml(AppConfig.sheetUrl)}" target="_blank" rel="noopener">Open ↗</a>` : "—"}</dd>
        </dl>
      </div>
    </div>
  `;
};
