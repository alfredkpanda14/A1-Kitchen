/* A1 Kitchen: choose light or dark before the page shows (saved choice, or the phone's setting) */
(function () {
  var theme = null;
  try {
    theme = window.localStorage.getItem("a1-theme");
  } catch (error) {
    theme = null;
  }
  if (theme !== "light" && theme !== "dark") {
    theme =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  }
  document.documentElement.classList.add("theme-" + theme);
})();
