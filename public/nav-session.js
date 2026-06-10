const headerLogin = document.querySelector(".header-login");
const headerLogout = document.querySelector(".header-logout");
const headerProfile = document.querySelector(".header-profile");

function showHeaderSession(loggedIn) {
  headerLogin?.classList.toggle("hidden", loggedIn);
  headerLogout?.classList.toggle("hidden", !loggedIn);
  headerProfile?.classList.toggle("hidden", !loggedIn);
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
    showHeaderSession(true);
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
