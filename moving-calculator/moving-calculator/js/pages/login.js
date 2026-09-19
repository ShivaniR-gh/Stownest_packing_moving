window.Pages = window.Pages || {};

Pages.login = function (root) {
  root.innerHTML = `
    <div class="login-wrap">
      <div class="card login-card">
        <div class="card-bd">
          <img src="assets/box-icon.png" alt="" class="login-mark" />
          <h3 style="margin:10px 0 4px">StowNest</h3>
          <p class="help" style="margin:0 0 16px">Sign in to the quote calculator.</p>
          <div class="field"><label>Username</label><input id="user" autocomplete="username" /></div>
          <div class="field" style="margin-top:12px"><label>Password</label><input id="pass" type="password" autocomplete="current-password" /></div>
          <div id="loginErr" class="err" style="display:none;margin-top:10px"></div>
          <button class="btn" id="signin" style="margin-top:16px;width:100%">Sign in</button>
          <p class="help" style="margin:14px 0 0">Default admin: <strong>admin</strong> / <strong>Admin@123</strong>. Change this in Settings after login.</p>
        </div>
      </div>
    </div>
  `;
  function go() {
    const err = root.querySelector("#loginErr");
    try {
      AuthService.login(root.querySelector("#user").value, root.querySelector("#pass").value);
      location.hash = "#/";
      location.reload();
    } catch (e) {
      err.style.display = "block";
      err.textContent = e.message || "Could not sign in.";
    }
  }
  root.querySelector("#signin").addEventListener("click", go);
  root.querySelector("#pass").addEventListener("keydown", (e) => {
    if (e.key === "Enter") go();
  });
  root.querySelector("#user").addEventListener("keydown", (e) => {
    if (e.key === "Enter") root.querySelector("#pass").focus();
  });
};
