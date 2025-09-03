document.addEventListener("DOMContentLoaded", () => {
  const html = document.documentElement;
  const toggleBtn = document.getElementById("toggle-tema");

  // Verifica se o usuário já escolheu um tema antes
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") {
    html.classList.add("dark");
    if (toggleBtn) toggleBtn.checked = true;
  } else if (savedTheme === "light") {
    html.classList.remove("dark");
    if (toggleBtn) toggleBtn.checked = false;
  } else {
    // Se não houver escolha salva, usa o tema do sistema
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      html.classList.add("dark");
    }
  }

  // Quando o usuário alternar o tema manualmente
  if (toggleBtn) {
    toggleBtn.addEventListener("change", () => {
      if (toggleBtn.checked) {
        html.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        html.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    });
  }
});
