const form = document.querySelector("#resetForm");
const message = document.querySelector("#resetMessage");
const token = new URLSearchParams(window.location.search).get("token") || "";

if (!token) {
  message.textContent = "Reset token is missing. Create a new reset link.";
}

async function confirmReset(event) {
  event.preventDefault();
  const password = document.querySelector("#newPassword").value;
  const confirmPassword = document.querySelector("#confirmPassword").value;
  if (!token) {
    message.textContent = "Reset token is missing. Create a new reset link.";
    return;
  }
  if (password.length < 8) {
    message.textContent = "Password must be at least 8 characters.";
    return;
  }
  if (password !== confirmPassword) {
    message.textContent = "Passwords do not match.";
    return;
  }
  try {
    message.textContent = "Updating password...";
    const response = await fetch("/api/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");
    message.textContent = data.message;
    form.reset();
  } catch (error) {
    message.textContent = error.message;
  }
}

form.addEventListener("submit", confirmReset);
