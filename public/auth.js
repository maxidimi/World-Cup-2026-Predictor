const mode = document.body.dataset.authMode;
const form = document.querySelector("#authForm");
const nameInput = document.querySelector("#nameInput");
const nicknameInput = document.querySelector("#nicknameInput");
const emailInput = document.querySelector("#emailInput");
const passwordInput = document.querySelector("#passwordInput");
const submitButton = document.querySelector("#authSubmit");
const message = document.querySelector("#authMessage");
const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function isCompatibleEmail(email) {
  if (email.length > 254 || /\s/.test(email)) return false;
  const [local, domain] = email.split("@");
  if (!local || !domain || local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }
  return emailPattern.test(email);
}

function setFieldError(input, errorElement, text) {
  if (!input || !errorElement) return;
  input.classList.toggle("invalid", Boolean(text));
  input.setAttribute("aria-invalid", text ? "true" : "false");
  errorElement.textContent = text;
}

function validate({ requireFields = true } = {}) {
  const name = nameInput?.value.trim() || "";
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const nickname = nicknameInput?.value.trim() || "";
  const errors = { name: "", nickname: "", email: "", password: "" };

  if (mode === "register" && requireFields && !name) errors.name = "Name is required.";
  if (mode === "register" && requireFields && !nickname) {
    errors.nickname = "Nickname is required.";
  } else if (mode === "register" && nickname && !/^[a-z0-9_]{3,20}$/i.test(nickname)) {
    errors.nickname = "Use 3-20 letters, numbers, or underscores.";
  }
  if (requireFields && !email) {
    errors.email = "Email is required.";
  } else if (email && !isCompatibleEmail(email)) {
    errors.email = "Use a valid email address, like name@example.com.";
  }
  if (requireFields && !password) {
    errors.password = "Password is required.";
  } else if (password && password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  setFieldError(nameInput, document.querySelector("#nameError"), errors.name);
  setFieldError(nicknameInput, document.querySelector("#nicknameError"), errors.nickname);
  setFieldError(emailInput, document.querySelector("#emailError"), errors.email);
  setFieldError(passwordInput, document.querySelector("#passwordError"), errors.password);
  return !errors.name && !errors.nickname && !errors.email && !errors.password;
}

async function submitAuth(event) {
  event.preventDefault();
  if (!validate({ requireFields: true })) {
    message.textContent = "Please fix the highlighted fields.";
    return;
  }

  submitButton.disabled = true;
  message.textContent = mode === "register" ? "Creating account..." : "Logging in...";
  const payload = {
    email: emailInput.value.trim().toLowerCase(),
    password: passwordInput.value
  };
  if (mode === "register") {
    payload.name = nameInput.value.trim();
    payload.nickname = nicknameInput.value.trim();
  }

  try {
    const response = await fetch(mode === "register" ? "/api/register" : "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");
    localStorage.setItem("wc_auth_token", data.token);
    window.location.replace("index.html");
  } catch (error) {
    message.textContent = error.message;
    submitButton.disabled = false;
  }
}

[nameInput, nicknameInput, emailInput, passwordInput].filter(Boolean).forEach((input) => {
  input.addEventListener("input", () => {
    validate({ requireFields: false });
    message.textContent = "";
  });
});

if (localStorage.getItem("wc_auth_token")) {
  window.location.replace("index.html");
} else {
  form.addEventListener("submit", submitAuth);
}
