(() => {
  const storageKey = "wc_theme";
  const savedTheme = localStorage.getItem(storageKey);
  const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const initialTheme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : preferredTheme;

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const button = document.querySelector("#themeToggle");
    if (!button) return;
    const dark = theme === "dark";
    button.innerHTML = `<span aria-hidden="true">${dark ? "☀" : "☾"}</span><span>${dark ? "Light" : "Dark"}</span>`;
    button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    button.setAttribute("aria-pressed", String(dark));
    button.title = dark ? "Light mode" : "Dark mode";
  }

  applyTheme(initialTheme);

  document.addEventListener("DOMContentLoaded", () => {
    const button = document.createElement("button");
    button.id = "themeToggle";
    button.className = "theme-toggle";
    button.type = "button";
    document.body.append(button);
    applyTheme(document.documentElement.dataset.theme || initialTheme);

    button.addEventListener("click", () => {
      const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem(storageKey, theme);
      applyTheme(theme);
    });
  });
})();
