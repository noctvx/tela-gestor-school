const loginForm = document.getElementById("login-form");
const recoveryForm = document.getElementById("recovery-form");
const resetForm = document.getElementById("reset-form");
const alertBox = document.getElementById("login-alert");
const formTitle = document.getElementById("form-title");
const formDescription = document.getElementById("form-description");
const resetToken = new URLSearchParams(location.search).get("reset");
const isGitHubPages = location.hostname.endsWith(".github.io");
const isLocalDemoEnvironment = location.protocol === "file:"
  || isGitHubPages
  || ["localhost", "127.0.0.1", "::1", "[::1]"].includes(location.hostname);
const isStaticDemoEnvironment = location.protocol === "file:" || isGitHubPages;

if (isStaticDemoEnvironment) {
  document.querySelector("[data-show-recovery]").hidden = true;
}

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json")) {
    throw new Error("A API do SchoolFix não respondeu. Para usar a demonstração, abra a tela de login local; para usar o sistema real, inicie o backend com npm start e acesse http://localhost:3000.");
  }
  return response.json();
}

function showAlert(message, success = false) {
  alertBox.textContent = message;
  alertBox.hidden = false;
  alertBox.classList.toggle("success", success);
}

function clearAlert() {
  alertBox.hidden = true;
  alertBox.textContent = "";
  alertBox.classList.remove("success");
}

function setLoading(form, loading) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = loading;
  button.querySelector(".button-label").textContent = loading ? "Aguarde..." : button.dataset.label;
  button.querySelector(".login-spinner").hidden = !loading;
}

document.querySelectorAll(".login-form").forEach((form) => {
  const button = form.querySelector('button[type="submit"]');
  button.dataset.label = button.querySelector(".button-label").textContent;
});

document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = button.parentElement.querySelector("input");
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    button.textContent = visible ? "Ocultar" : "Mostrar";
    button.setAttribute("aria-label", visible ? "Ocultar senha" : "Mostrar senha");
  });
});

document.querySelector("[data-show-recovery]").addEventListener("click", () => {
  clearAlert();
  loginForm.hidden = true;
  document.getElementById("login-demo").hidden = true;
  recoveryForm.hidden = false;
  formTitle.textContent = "Recuperar senha";
  formDescription.textContent = "Informe seus dados institucionais para receber as instruções.";
  document.getElementById("recovery-ra").value = document.getElementById("ra").value.trim();
});

document.querySelector("[data-show-login]").addEventListener("click", () => {
  clearAlert();
  recoveryForm.hidden = true;
  loginForm.hidden = false;
  document.getElementById("login-demo").hidden = false;
  formTitle.textContent = "Acesse sua conta";
  formDescription.textContent = "Entre com seu Registro Acadêmico e sua senha.";
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAlert();
  const button = loginForm.querySelector('button[type="submit"]');
  setLoading(loginForm, true);
  try {
    const ra = loginForm.elements.ra.value.trim().toUpperCase();
    const password = loginForm.elements.password.value;
    const demoAccounts = {
      ALU2026001: "aluno",
      GES2026001: "gestor"
    };
    if (isLocalDemoEnvironment && demoAccounts[ra] && password === "1234") {
      location.replace(`index.html?demo=${encodeURIComponent(ra)}`);
      return;
    }
    if (isStaticDemoEnvironment) {
      throw new Error("RA ou senha de demonstração inválidos. Use um dos perfis exibidos na tela e a senha 1234.");
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ra,
        password
      })
    });
    const payload = await readApiResponse(response);
    if (!response.ok) throw new Error(payload.error || "Não foi possível entrar.");
    location.replace("/painel");
  } catch (error) {
    showAlert(error.message || "Não foi possível conectar ao SchoolFix. Tente novamente.");
  } finally {
    button.disabled = false;
    button.querySelector(".button-label").textContent = button.dataset.label;
    button.querySelector(".login-spinner").hidden = true;
  }
});

recoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAlert();
  const button = recoveryForm.querySelector('button[type="submit"]');
  setLoading(recoveryForm, true);
  try {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ra: recoveryForm.elements.ra.value.trim(),
        email: recoveryForm.elements.email.value.trim()
      })
    });
    const payload = await readApiResponse(response);
    if (!response.ok) throw new Error(payload.error || "Não foi possível solicitar a recuperação.");
    showAlert(payload.message, true);
  } catch (error) {
    showAlert(error.message || "Não foi possível conectar ao SchoolFix. Tente novamente.");
  } finally {
    button.disabled = false;
    button.querySelector(".button-label").textContent = button.dataset.label;
    button.querySelector(".login-spinner").hidden = true;
  }
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAlert();
  if (resetForm.elements.password.value !== resetForm.elements.confirmation.value) {
    showAlert("A confirmação da senha não corresponde.");
    return;
  }
  if (!resetToken) {
    showAlert("Este link de redefinição é inválido ou expirou.");
    return;
  }
  const button = resetForm.querySelector('button[type="submit"]');
  setLoading(resetForm, true);
  try {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: resetToken, password: resetForm.elements.password.value })
    });
    const payload = await readApiResponse(response);
    if (!response.ok) throw new Error(payload.error || "Não foi possível redefinir a senha.");
    showAlert(payload.message, true);
    window.setTimeout(() => location.replace("/"), 1800);
  } catch (error) {
    showAlert(error.message || "Não foi possível conectar ao SchoolFix. Tente novamente.");
  } finally {
    button.disabled = false;
    button.querySelector(".button-label").textContent = button.dataset.label;
    button.querySelector(".login-spinner").hidden = true;
  }
});

if (resetToken && isStaticDemoEnvironment) {
  showAlert("A recuperação de senha não está disponível nesta demonstração.");
} else if (resetToken) {
  loginForm.hidden = true;
  document.getElementById("login-demo").hidden = true;
  resetForm.hidden = false;
  formTitle.textContent = "Defina sua nova senha";
  formDescription.textContent = "Escolha uma senha segura com pelo menos 10 caracteres.";
}
