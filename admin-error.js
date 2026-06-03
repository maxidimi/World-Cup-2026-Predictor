const params = new URLSearchParams(window.location.search);
const reason = params.get("reason");
const messages = {
  login: "You are not expected to be here.",
  forbidden: "This admin area is only available to admins.",
  expired: "Your session could not be verified."
};

document.querySelector("#errorMessage").textContent = messages[reason] || "You need admin permission to open this page.";
