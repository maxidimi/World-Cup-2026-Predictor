const headerLogin = document.querySelector(".header-login");
const headerLogout = document.querySelector(".header-logout");
const headerProfile = document.querySelector(".header-profile");
const pageNav = document.querySelector(".page-nav");
let headerAdmin = document.querySelector(".header-admin");

if (pageNav && !headerAdmin && !document.querySelector(".admin-header")) {
  headerAdmin = document.createElement("a");
  headerAdmin.className = "nav-link header-admin hidden";
  headerAdmin.href = "admin.html";
  headerAdmin.textContent = "Admin";
  pageNav.append(headerAdmin);
}

function showHeaderSession(loggedIn, isAdmin = false) {
  headerLogin?.classList.toggle("hidden", loggedIn);
  headerLogout?.classList.toggle("hidden", !loggedIn);
  headerProfile?.classList.toggle("hidden", !loggedIn);
  headerAdmin?.classList.toggle("hidden", !loggedIn || !isAdmin);
}

async function restoreHeaderSession() {
  const token = localStorage.getItem("wc_auth_token") || "";
  if (!token) {
    showHeaderSession(false);
    return;
  }
  try {
    const response = await fetch("/api/session", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error("Session expired.");
    const data = await response.json();
    showHeaderSession(true, Boolean(data.user?.isAdmin));
  } catch {
    localStorage.removeItem("wc_auth_token");
    showHeaderSession(false);
  }
}

headerLogout?.addEventListener("click", () => {
  localStorage.removeItem("wc_auth_token");
  window.location.replace("index.html");
});

restoreHeaderSession();
