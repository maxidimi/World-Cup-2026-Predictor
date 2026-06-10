const form = document.querySelector("#forgotForm");
const message = document.querySelector("#forgotMessage");
const linkBox = document.querySelector("#resetLinkBox");

async function requestReset(event) {
  event.preventDefault();
  const email = document.querySelector("#resetEmail").value.trim().toLowerCase();
  linkBox.classList.add("hidden");
  linkBox.textContent = "";
  if (!email) {
    message.textContent = "Email is required.";
    return;
  }
  try {
    message.textContent = "Submitting request...";
    const response = await fetch("/api/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");
    message.textContent = data.message;
    if (data.resetUrl) {
      const resetUrl = new URL(data.resetUrl, window.location.origin).href;
      linkBox.innerHTML = `Password reset link: <a href="${resetUrl}">Continue</a>`;
      linkBox.classList.remove("hidden");
    }
  } catch (error) {
    message.textContent = error.message;
  }
}

form.addEventListener("submit", requestReset);
