const params = new URLSearchParams(window.location.search);
const reason = params.get("reason");
const messages = {
  login: "Sign in with an administrator account to continue.",
  forbidden: "This admin area is only available to admins.",
  expired: "Your session could not be verified."
};

document.querySelector("#errorMessage").textContent = messages[reason] || "You need admin permission to open this page.";
