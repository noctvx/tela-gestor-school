const statusClass = {
  "Pendente": "status-pending",
  "Em Análise": "status-analysis",
  "Resolvido": "status-resolved",
  "Arquivada": "status-archived"
};
const categories = [
  { name: "Infraestrutura", amount: 0, color: "#dd7773" },
  { name: "Pedagógico", amount: 0, color: "#6f88db" },
  { name: "Convivência", amount: 0, color: "#e5ad5e" },
  { name: "Alimentação", amount: 0, color: "#55a889" }
];
let currentUser = null;
const isGitHubPages = location.hostname.endsWith(".github.io");
const isLocalDemoEnvironment = location.protocol === "file:"
  || isGitHubPages
  || ["localhost", "127.0.0.1", "::1", "[::1]"].includes(location.hostname);
const isStaticDemoEnvironment = location.protocol === "file:" || isGitHubPages;
const demoRa = isLocalDemoEnvironment ? new URLSearchParams(location.search).get("demo") : null;
const demoUser = ({
  ALU2026001: {
    id: "demo-aluno",
    ra: "ALU2026001",
    fullName: "Ana Souza",
    userType: "aluno"
  },
  GES2026001: {
    id: "demo-gestor",
    ra: "GES2026001",
    fullName: "Marina Oliveira",
    userType: "administrador"
  }
})[demoRa] || null;
const demoMode = Boolean(demoUser);
const demoDate = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
};
const demoComplaints = [
  {
    id: "DEMO-1003",
    userId: "demo-aluno",
    title: "Projetor da sala 204 não funciona",
    description: "O projetor da sala 204 não liga durante as aulas. Acontece desde o início da semana.",
    category: "Infraestrutura",
    status: "Pendente",
    author: "Ana Souza",
    initials: "AS",
    createdAt: demoDate(1).toISOString(),
    updatedAt: demoDate(1).toISOString(),
    date: new Intl.DateTimeFormat("pt-BR").format(demoDate(1)),
    responses: [],
    rating: null
  },
  {
    id: "DEMO-1002",
    userId: "demo-aluno",
    title: "Sugestão de horário para a biblioteca",
    description: "Seria útil manter a biblioteca aberta até mais tarde em semanas de prova.",
    category: "Pedagógico",
    status: "Resolvido",
    author: "Ana Souza",
    initials: "AS",
    createdAt: demoDate(5).toISOString(),
    updatedAt: demoDate(2).toISOString(),
    date: new Intl.DateTimeFormat("pt-BR").format(demoDate(5)),
    responses: [{ author: "Marina Oliveira", date: new Intl.DateTimeFormat("pt-BR").format(demoDate(2)), text: "A sugestão foi encaminhada à coordenação para avaliação." }],
    rating: null
  },
  {
    id: "DEMO-1001",
    userId: "demo-outro-aluno",
    title: "Manutenção dos bebedouros do bloco B",
    description: "Dois bebedouros do bloco B precisam de manutenção.",
    category: "Infraestrutura",
    status: "Em Análise",
    author: "Lucas Martins",
    initials: "LM",
    createdAt: demoDate(3).toISOString(),
    updatedAt: demoDate(1).toISOString(),
    date: new Intl.DateTimeFormat("pt-BR").format(demoDate(3)),
    responses: [],
    rating: null
  }
];
const demoSuggestions = [{
  id: "DEMO-S1",
  title: "Mais tomadas na biblioteca",
  description: "Instalar tomadas adicionais nas mesas de estudo.",
  status: "Recebida",
  userId: "demo-aluno",
  author: "Ana Souza",
  date: new Intl.DateTimeFormat("pt-BR").format(demoDate(2))
}];
const demoRecordsKey = "schoolfix-demo-records";
let demoRecords = {
  complaints: demoComplaints,
  suggestions: demoSuggestions
};

function readDemoRecords() {
  try {
    const stored = localStorage.getItem(demoRecordsKey);
    if (!stored) {
      return {
        complaints: [...demoComplaints],
        suggestions: [...demoSuggestions]
      };
    }
    const records = JSON.parse(stored);
    if (!Array.isArray(records.complaints) || !Array.isArray(records.suggestions)) {
      throw new Error("O formato dos registros de demonstração é inválido.");
    }
    return records;
  } catch (error) {
    console.error("Não foi possível carregar os registros compartilhados da demonstração:", error);
    showToast("Não foi possível carregar os registros locais da demonstração.");
    return {
      complaints: [...demoComplaints],
      suggestions: [...demoSuggestions]
    };
  }
}

function saveDemoRecords(records) {
  try {
    localStorage.setItem(demoRecordsKey, JSON.stringify(records));
    demoRecords = records;
    return true;
  } catch (error) {
    console.error("Não foi possível salvar os registros compartilhados da demonstração:", error);
    showToast("Não foi possível salvar os registros neste navegador.");
    return false;
  }
}

function refreshDemoRecords() {
  demoRecords = readDemoRecords();
  complaints = demoUser.userType === "aluno"
    ? demoRecords.complaints.filter((complaint) => complaint.userId === demoUser.id)
    : demoRecords.complaints;
  suggestions = demoUser.userType === "aluno"
    ? demoRecords.suggestions.filter((suggestion) => suggestion.userId === demoUser.id)
    : demoRecords.suggestions;
  if (!complaints.some((complaint) => complaint.id === activeComplaintId)) {
    activeComplaintId = complaints[0]?.id || null;
  }
}

function storageKey(key) {
  return currentUser ? `${key}:${currentUser.id}` : key;
}

function readStored(key, fallback) {
  try {
    const value = localStorage.getItem(storageKey(key));
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn(`Não foi possível ler os dados locais de ${key}.`, error);
    return fallback;
  }
}

let complaints = [];
let suggestions = [];
let activeComplaintId = null;
let activeStatusFilter = "Todas";
let activeCategoryFilter = "Todas";
let activeComplaintPage = 1;
const complaintPageSize = 6;
let activePage = "inicio";
let toastTimer;
let directPeople = [];
let activePersonName = "";
let activeChannel = "Geral";
let currentReportPeriod = 30;

class LocalDemoRedirectError extends Error {}

async function apiRequest(url, options = {}) {
  if (demoMode) {
    throw new Error("Esta ação não está disponível na demonstração local.");
  }
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  if (response.status === 401) {
    window.location.replace("/");
    throw new Error("Sua sessão expirou. Entre novamente.");
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json")) {
    if (isLocalDemoEnvironment) {
      window.location.replace("login.html");
      throw new LocalDemoRedirectError();
    }
    throw new Error("A API do SchoolFix não respondeu. Para usar a demonstração, abra a tela de login local; para usar o sistema real, inicie o backend com npm start e acesse http://localhost:3000.");
  }
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "Não foi possível concluir a solicitação.");
  return payload;
}

function userRoleLabel(role) {
  return ({ aluno: "Aluno", professor: "Professor", administrador: "Administrador" })[role] || "Usuário";
}

async function initializeAuthenticatedApp() {
  if (isStaticDemoEnvironment && !demoMode) {
    window.location.replace("login.html");
    return;
  }

  try {
    const user = demoMode ? demoUser : (await apiRequest("/api/auth/me")).user;
    currentUser = user;
    if (demoMode) {
      document.getElementById("demo-banner").hidden = false;
      refreshDemoRecords();
      directPeople = [];
      activePersonName = "";
      updateAuthenticatedInterface(user);
      restoreSettings();
      renderAll();
      renderDemoChannel();
      const initialPage = location.hash.slice(1);
      if (initialPage && document.getElementById(`page-${initialPage}`)) goToPage(initialPage);
      return;
    }

    if (!user) {
      window.location.replace("/");
      return;
    }

    directPeople = readStored("schoolfix-direct-people", []);
    if (!Array.isArray(directPeople)) directPeople = [];
    activePersonName = directPeople[0]?.name || "";
    updateAuthenticatedInterface(user);
    try {
      const result = await apiRequest("/api/complaints");
      complaints = result.complaints;
      activeComplaintId = complaints[0]?.id || null;
    } catch (error) {
      showToast(error.message);
    }
    try {
      suggestions = (await apiRequest("/api/suggestions")).suggestions;
    } catch (error) {
      showToast(error.message);
    }
    restoreSettings();
    renderAll();
    await renderChannel();
    const initialPage = location.hash.slice(1);
    if (initialPage && document.getElementById(`page-${initialPage}`)) goToPage(initialPage);
  } catch (error) {
    if (error instanceof LocalDemoRedirectError) return;
    console.error("Não foi possível carregar a sessão:", error);
    showToast(error.message);
  }
}

function updateAuthenticatedInterface(user) {
  document.querySelector("[data-auth-name]").textContent = user.fullName;
  const roleLabel = demoMode && user.userType === "administrador" ? "Gestor (demonstração)" : userRoleLabel(user.userType);
  document.querySelector("[data-auth-role]").textContent = `${roleLabel} · ${user.ra}`;
  document.querySelector("[data-auth-avatar]").textContent = user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  document.querySelector("#page-inicio h1").innerHTML = `Olá, ${escapeText(user.fullName)} <span class="wave">✦</span>`;
  document.getElementById("admin-user-card").hidden = user.userType !== "administrador";
  document.querySelectorAll(".channel").forEach((button) => {
    button.hidden = user.userType === "aluno" && button.textContent.replace("#", "").trim() !== "Geral";
  });
  document.querySelector("#page-reclamacoes h1").textContent = user.userType === "aluno" ? "Minhas reclamações" : "Todas as reclamações";
  document.querySelector("#page-reclamacoes .page-description").textContent = user.userType === "aluno"
    ? "Registre uma ocorrência e acompanhe as respostas da instituição."
    : "Gerencie, acompanhe e responda às solicitações da comunidade.";
}

function renderDemoChannel() {
  document.querySelector(".chat-room-heading h2").textContent = "# Geral";
  renderMessages(document.getElementById("general-messages"), [
    { author: "Marina Oliveira", time: "09:15", text: "Bem-vindos ao SchoolFix. Este é um exemplo de conversa." },
    { author: "Lucas Martins", time: "09:18", text: "Legal! Assim fica mais fácil acompanhar as solicitações." }
  ]);
}

function persist(key, value) {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Não foi possível salvar os dados locais de ${key}.`, error);
    showToast("Não foi possível salvar as alterações neste navegador.");
    return false;
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3200);
}

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function goToPage(page) {
  const view = document.getElementById(`page-${page}`);
  if (!view) return;
  activePage = page;
  document.querySelectorAll(".page-view").forEach((element) => element.classList.toggle("active", element === view));
  document.querySelectorAll(".nav-item").forEach((element) => {
    const isActive = element.dataset.page === page;
    element.classList.toggle("active", isActive);
    if (isActive) element.setAttribute("aria-current", "page");
    else element.removeAttribute("aria-current");
  });
  document.title = `SchoolFix | ${view.dataset.title}`;
  history.replaceState(null, "", `#${page}`);
  document.querySelector(".notification-popover").hidden = true;
  document.querySelector(".notification-button").setAttribute("aria-expanded", "false");
  if (page === "relatorios") renderReports();
}

function complaintStatus(complaint) {
  const status = complaint.status;
  return `<span class="status ${statusClass[status] || "status-archived"}">${escapeText(status)}</span>`;
}

function renderHome() {
  document.getElementById("nav-count").textContent = complaints.length;
  const pending = complaints.filter((complaint) => complaint.status === "Pendente").length;
  const analysis = complaints.filter((complaint) => complaint.status === "Em Análise").length;
  const resolved = complaints.filter((complaint) => complaint.status === "Resolvido").length;
  document.getElementById("stat-total").textContent = complaints.length;
  document.getElementById("stat-pending").textContent = pending;
  document.getElementById("stat-analysis").textContent = analysis;
  document.getElementById("stat-resolved").textContent = resolved;
  document.getElementById("attention-copy").textContent = `${pending} reclamações aguardando atenção`;
  document.querySelector(".category-total").textContent = `${complaints.length} no total`;
  document.getElementById("home-complaints").innerHTML = complaints.length ? complaints.slice(0, 5).map((complaint) => `
    <tr data-complaint-id="${escapeText(complaint.id)}">
      <td class="issue-cell">${escapeText(complaint.title)}<span class="issue-subtitle">#${escapeText(complaint.id)}</span></td>
      <td>${escapeText(complaint.category)}</td><td>${complaintStatus(complaint)}</td><td>${escapeText(complaint.date)}</td><td class="row-open">›</td>
    </tr>`).join("") : '<tr><td colspan="5"><div class="empty-state">Nenhuma reclamação registrada.</div></td></tr>';
  const categoryCounts = categories.map((category) => ({
    ...category,
    amount: complaints.filter((complaint) => complaint.category === category.name).length
  }));
  const highestCount = Math.max(1, ...categoryCounts.map((category) => category.amount));
  document.getElementById("home-categories").innerHTML = categoryCounts.map((category) => `
    <div class="category-item"><div class="category-meta"><span>${category.name}</span><span>${category.amount} ocorrências</span></div>
    <div class="progress-track"><span style="width:${Math.round(category.amount / highestCount * 100)}%;background:${category.color}"></span></div></div>`).join("");
}

function getFilteredComplaints() {
  const query = document.getElementById("complaint-search").value.trim().toLocaleLowerCase("pt-BR");
  return complaints.filter((complaint) => {
    const matchesStatus = activeStatusFilter === "Todas"
      || (activeStatusFilter === "Aberta" && ["Pendente", "Em Análise"].includes(complaint.status))
      || complaint.status === activeStatusFilter;
    const matchesCategory = activeCategoryFilter === "Todas" || complaint.category === activeCategoryFilter;
    const haystack = `${complaint.id} ${complaint.title} ${complaint.category} ${complaint.author}`.toLocaleLowerCase("pt-BR");
    return matchesStatus && matchesCategory && haystack.includes(query);
  });
}

function renderComplaints() {
  const filtered = getFilteredComplaints();
  const pageCount = Math.max(1, Math.ceil(filtered.length / complaintPageSize));
  activeComplaintPage = Math.min(activeComplaintPage, pageCount);
  const pageComplaints = filtered.slice((activeComplaintPage - 1) * complaintPageSize, activeComplaintPage * complaintPageSize);
  const rows = document.getElementById("complaint-rows");
  rows.innerHTML = pageComplaints.length ? pageComplaints.map((complaint) => `
    <tr data-complaint-id="${escapeText(complaint.id)}" aria-selected="${complaint.id === activeComplaintId}">
      <td class="protocol">#${escapeText(complaint.id)}</td>
      <td class="issue-cell">${escapeText(complaint.title)}</td><td>${escapeText(complaint.category)}</td>
      <td><span class="author-cell"><span class="mini-avatar">${escapeText(complaint.initials)}</span><span class="author-name">${escapeText(complaint.author)}</span></span></td>
      <td>${complaintStatus(complaint)}</td><td>${escapeText(complaint.date)}</td><td class="row-open">›</td>
    </tr>`).join("") : '<tr><td colspan="7"><div class="empty-state">Nenhuma reclamação corresponde aos filtros.</div></td></tr>';
  document.getElementById("complaint-count").textContent = `Mostrando ${pageComplaints.length} de ${filtered.length} reclamações`;
  document.querySelector('.filter-chip[data-filter="Todas"] span').textContent = complaints.length;
  document.getElementById("complaint-pagination").innerHTML = [
    `<button type="button" data-complaint-page="${activeComplaintPage - 1}" aria-label="Página anterior"${activeComplaintPage === 1 ? " disabled" : ""}>‹</button>`,
    ...Array.from({ length: pageCount }, (_, index) => {
      const page = index + 1;
      const current = page === activeComplaintPage;
      return `<button type="button" data-complaint-page="${page}"${current ? ' class="current-page" aria-current="page"' : ""}>${page}</button>`;
    }),
    `<button type="button" data-complaint-page="${activeComplaintPage + 1}" aria-label="Próxima página"${activeComplaintPage === pageCount ? " disabled" : ""}>›</button>`
  ].join("");
  if (!filtered.some((complaint) => complaint.id === activeComplaintId)) activeComplaintId = filtered[0]?.id || null;
  renderComplaintDetail();
}

function renderComplaintDetail() {
  const detail = document.getElementById("complaint-detail");
  const complaint = complaints.find((item) => item.id === activeComplaintId);
  if (!complaint) {
    detail.innerHTML = '<div class="empty-state">Selecione uma reclamação para visualizar os detalhes.</div>';
    return;
  }
  const responses = complaint.responses.map((response) => `<article class="response-item"><strong>${escapeText(response.author)}<span>${escapeText(response.date)}</span></strong><p>${escapeText(response.text)}</p></article>`).join("");
  const canManage = ["professor", "administrador"].includes(currentUser.userType);
  const canRate = currentUser.userType === "aluno" && complaint.status === "Resolvido";
  const ratingMarkup = canRate
    ? complaint.rating
      ? `<div class="detail-field rating-result"><span class="detail-label">Sua avaliação</span><p>${complaint.rating.value}/5${complaint.rating.comment ? ` · ${escapeText(complaint.rating.comment)}` : ""}</p></div>`
      : `<form class="response-form response-block" id="complaint-rating-form"><label class="detail-label" for="complaint-rating">Avalie a resolução</label><select class="detail-select" id="complaint-rating" name="rating" required><option value="">Selecione uma nota</option><option value="5">5 — Excelente</option><option value="4">4 — Muito bom</option><option value="3">3 — Bom</option><option value="2">2 — Regular</option><option value="1">1 — Insatisfatório</option></select><textarea name="comment" maxlength="1000" placeholder="Comentário opcional"></textarea><button class="button button-primary" type="submit">Enviar avaliação</button></form>`
    : "";
  detail.innerHTML = `
    <div class="detail-top"><div><span class="detail-protocol">PROTOCOLO #${escapeText(complaint.id)}</span><h2>${escapeText(complaint.title)}</h2></div>${complaintStatus(complaint)}</div>
    <div class="detail-field"><span class="detail-label">Categoria</span><div class="detail-value">${escapeText(complaint.category)} <span style="color:#9a9eac">·</span> Por ${escapeText(complaint.author)}</div></div>
    <div class="detail-field detail-description-field"><span class="detail-label">Descrição do problema</span><div class="detail-value detail-description">${escapeText(complaint.description)}</div></div>
    ${canManage ? `<div class="detail-field"><label class="detail-label" for="complaint-status">Atualizar status</label><select class="detail-select" id="complaint-status"><option ${complaint.status === "Pendente" ? "selected" : ""}>Pendente</option><option ${complaint.status === "Em Análise" ? "selected" : ""}>Em Análise</option><option ${complaint.status === "Resolvido" ? "selected" : ""}>Resolvido</option><option ${complaint.status === "Arquivada" ? "selected" : ""}>Arquivada</option></select></div>` : ""}
    <div class="detail-field response-block"><span class="detail-label">Histórico de respostas (${complaint.responses.length})</span><div class="response-list">${responses || '<div class="empty-state">Nenhuma resposta enviada ainda.</div>'}</div></div>
    ${ratingMarkup}
    ${canManage ? `<form class="response-form response-block" id="response-form"><label class="detail-label" for="response-text">Campo de resposta oficial</label><textarea id="response-text" name="response" maxlength="5000" placeholder="Escreva a resposta oficial para o usuário..." required></textarea><button class="button button-primary" type="submit">Enviar resposta</button></form>` : ""}`;
}

function renderSuggestions() {
  const list = document.getElementById("suggestion-list");
  list.innerHTML = suggestions.length ? suggestions.map((suggestion) => `
    <article class="suggestion-item">
      <div class="suggestion-heading"><h3>${escapeText(suggestion.title)}</h3><span>${escapeText(suggestion.status)}</span></div>
      <p>${escapeText(suggestion.description)}</p>
      <small>${currentUser.userType === "aluno" ? "" : `${escapeText(suggestion.author)} · `}${escapeText(suggestion.date)}</small>
    </article>`).join("") : '<p class="empty-state">Nenhuma sugestão registrada.</p>';
}

function renderReports() {
  const periodStart = Date.now() - currentReportPeriod * 24 * 60 * 60 * 1000;
  const periodComplaints = complaints.filter((complaint) => new Date(complaint.createdAt).getTime() >= periodStart);
  const statusValues = [
    { status: "Resolvido", name: "Resolvidas", count: periodComplaints.filter((item) => item.status === "Resolvido").length, color: "#38a879" },
    { status: "Em Análise", name: "Em análise", count: periodComplaints.filter((item) => item.status === "Em Análise").length, color: "#5082dc" },
    { status: "Pendente", name: "Pendentes", count: periodComplaints.filter((item) => item.status === "Pendente").length, color: "#e7a13b" },
    { status: "Arquivada", name: "Arquivadas", count: periodComplaints.filter((item) => item.status === "Arquivada").length, color: "#a6a8b6" }
  ];
  const total = statusValues.reduce((sum, item) => sum + item.count, 0);
  const percentages = new Map(statusValues.map((item) => [item.status, total ? Math.round(item.count / total * 100) : 0]));
  document.getElementById("report-total").textContent = total;
  document.querySelectorAll("[data-status-percent]").forEach((item) => {
    item.textContent = `${percentages.get(item.dataset.statusPercent) || 0}%`;
  });
  let gradientStart = 0;
  const gradientSegments = statusValues.map((item, index) => {
    const start = gradientStart;
    gradientStart += total ? item.count / total * 100 : 0;
    return `${item.color} ${start}% ${index === statusValues.length - 1 ? 100 : gradientStart}%`;
  });
  document.querySelector(".donut-chart").style.background = total
    ? `conic-gradient(${gradientSegments.join(", ")})`
    : "#ececf2";
  document.getElementById("report-status-bars").innerHTML = statusValues.map((item) => `
    <div class="report-status-row"><div class="report-status-label"><span>${item.name}</span><span>${item.count} chamados</span></div><div class="report-track"><span style="width:${total ? Math.round(item.count / total * 100) : 0}%;background:${item.color}"></span></div></div>`).join("");
  const chartItems = categories.map((category, index) => ({
    category: category.name,
    name: ["Infra", "Ensino", "Conv.", "Alim."][index],
    amount: periodComplaints.filter((complaint) => complaint.category === category.name).length,
    color: ["#e84a4f", "#4788e6", "#eba535", "#38a879"][index]
  }));
  const highestCategory = Math.max(1, ...chartItems.map((item) => item.amount));
  document.getElementById("category-chart").innerHTML = chartItems.map((item) => `
    <div class="chart-column"><strong>${item.amount}</strong><div class="chart-bar" style="height:${Math.max(14, item.amount / highestCategory * 105)}px;background:${item.color}"></div><span>${item.name}</span></div>`).join("");

  const resolved = periodComplaints.filter((item) => item.status === "Resolvido");
  const averageResolution = resolved.length
    ? resolved.reduce((sum, item) => sum + (new Date(item.updatedAt) - new Date(item.createdAt)), 0) / resolved.length
    : 0;
  document.getElementById("report-average").textContent = resolved.length
    ? `${(averageResolution / (24 * 60 * 60 * 1000)).toFixed(1)} dias`
    : "—";
  document.getElementById("report-resolution-rate").textContent = total
    ? `${Math.round(resolved.length / total * 100)}%`
    : "—";
  const mostFrequentCategory = chartItems.reduce((highest, item) => item.amount > highest.amount ? item : highest, chartItems[0]);
  document.getElementById("report-top-category").textContent = mostFrequentCategory.amount ? mostFrequentCategory.category : "—";
  document.getElementById("report-top-category-count").textContent = mostFrequentCategory.amount
    ? `${mostFrequentCategory.amount} reclamações no período`
    : "Sem registros no período";
  const weekdayCounts = new Map();
  periodComplaints.forEach((item) => {
    const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" }).format(new Date(item.createdAt));
    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) || 0) + 1);
  });
  const peakDay = [...weekdayCounts.entries()].sort((left, right) => right[1] - left[1])[0];
  document.getElementById("report-peak").textContent = peakDay ? peakDay[0] : "—";
}

function renderMessages(container, messages) {
  container.innerHTML = "";
  const separator = document.createElement("div");
  separator.className = "date-separator";
  separator.innerHTML = "<span>HOJE</span>";
  container.append(separator);
  messages.forEach((message) => {
    const article = document.createElement("article");
    const isOwnMessage = message.author === currentUser.fullName;
    article.className = `message${isOwnMessage ? " own-message" : ""}`;
    const initials = isOwnMessage ? currentUser.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase() : message.author.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
    const avatar = document.createElement("span");
    avatar.className = `person-avatar ${isOwnMessage ? "navy-avatar" : "mint"}`;
    avatar.textContent = initials;
    const body = document.createElement("div");
    const meta = document.createElement("div");
    meta.className = "message-meta";
    const name = document.createElement("strong");
    name.textContent = message.author;
    const time = document.createElement("span");
    time.textContent = message.time;
    meta.append(name, time);
    const text = document.createElement("p");
    text.textContent = message.text;
    body.append(meta, text);
    article.append(avatar, body);
    container.append(article);
  });
  container.scrollTop = container.scrollHeight;
}

async function renderChannel() {
  const channel = activeChannel;
  const container = document.getElementById("general-messages");
  document.querySelector(".chat-room-heading h2").textContent = `# ${channel}`;
  if (demoMode) {
    renderMessages(container, channel === "Geral" ? [
      { author: "Marina Oliveira", time: "09:15", text: "Bem-vindos ao SchoolFix. Este é um exemplo de conversa." },
      { author: "Lucas Martins", time: "09:18", text: "Legal! Assim fica mais fácil acompanhar as solicitações." }
    ] : []);
    return;
  }
  container.innerHTML = '<div class="empty-state">Carregando mensagens...</div>';
  try {
    const { messages } = await apiRequest(`/api/chat/messages?channel=${encodeURIComponent(channel)}`);
    if (channel !== activeChannel) return;
    renderMessages(container, messages);
    if (messages.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Este canal ainda não tem mensagens. Comece a conversa!";
      container.append(empty);
    }
  } catch (error) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = error.message;
    container.append(empty);
  }
}

function renderDirectList() {
  const query = document.getElementById("people-search").value.trim().toLocaleLowerCase("pt-BR");
  const people = directPeople.filter((person) => `${person.name} ${person.role}`.toLocaleLowerCase("pt-BR").includes(query));
  const list = document.getElementById("direct-list");
  list.innerHTML = people.map((person) => `
    <button class="direct-person${person.name === activePersonName ? " selected" : ""}" type="button" data-person="${escapeText(person.name)}">
      <span class="person-avatar ${person.color}">${escapeText(person.initials)}</span>
      <span><strong>${escapeText(person.name)}</strong><small>${escapeText(person.preview)}</small></span><time>${escapeText(person.time)}</time>
    </button>`).join("") || '<div class="empty-state">Nenhuma conversa encontrada.</div>';
  renderDirectConversation();
}

function renderDirectConversation() {
  const person = directPeople.find((item) => item.name === activePersonName);
  const heading = document.getElementById("direct-heading");
  if (!person) {
    heading.innerHTML = "<h2>Selecione uma conversa</h2>";
    document.getElementById("direct-messages").innerHTML = '<div class="empty-state">Escolha uma conversa para começar.</div>';
    return;
  }
  heading.innerHTML = `<span class="person-avatar ${person.color}">${escapeText(person.initials)}</span><div><h2>${escapeText(person.name)}</h2><p>${escapeText(person.role)}</p></div>`;
  renderMessages(document.getElementById("direct-messages"), person.messages);
}

function getDialog() {
  return document.getElementById("app-dialog");
}

function openDialog(content) {
  document.getElementById("dialog-content").innerHTML = content;
  getDialog().showModal();
}

async function addChatMessage(event, channel) {
  event.preventDefault();
  const input = event.currentTarget.elements.message;
  const text = input.value.trim();
  if (!text) return;
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
  if (channel) {
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await apiRequest("/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({ channel: activeChannel, message: text })
      });
      input.value = "";
      await renderChannel();
    } catch (error) {
      showToast(error.message);
    } finally {
      submit.disabled = false;
    }
    return;
  } else {
    const person = directPeople.find((item) => item.name === activePersonName);
    if (!person) return;
    person.messages.push({ author: currentUser.fullName, time, text });
    person.preview = text;
    person.time = time;
    persist("schoolfix-direct-people", directPeople);
    renderDirectList();
  }
  input.value = "";
}

async function createComplaint(event) {
  event.preventDefault();
  const form = event.target;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const values = {
      title: form.elements.title.value.trim(),
      category: form.elements.category.value,
      description: form.elements.description.value.trim()
    };
    let complaint;
    if (demoMode) {
      const createdAt = new Date().toISOString();
      complaint = {
        id: `DEMO-${Date.now()}`,
        userId: currentUser.id,
        ...values,
        status: "Pendente",
        author: currentUser.fullName,
        initials: currentUser.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
        date: new Intl.DateTimeFormat("pt-BR").format(new Date(createdAt)),
        createdAt,
        updatedAt: createdAt,
        responses: [],
        rating: null
      };
      if (!saveDemoRecords({ ...demoRecords, complaints: [complaint, ...demoRecords.complaints] })) return;
      refreshDemoRecords();
    } else {
      ({ complaint } = await apiRequest("/api/complaints", {
        method: "POST",
        body: JSON.stringify(values)
      }));
      await refreshComplaints();
    }
    activeComplaintId = complaint.id;
    activeComplaintPage = 1;
    getDialog().close();
    renderAll();
    goToPage("reclamacoes");
    showToast("Reclamação registrada com sucesso.");
  } catch (error) {
    showToast(error.message);
  } finally {
    submit.disabled = false;
  }
}

async function refreshComplaints() {
  if (demoMode) {
    refreshDemoRecords();
    return;
  }
  const result = await apiRequest("/api/complaints");
  complaints = result.complaints;
}

async function refreshSuggestions() {
  if (demoMode) {
    refreshDemoRecords();
    return;
  }
  const result = await apiRequest("/api/suggestions");
  suggestions = result.suggestions;
}

function exportReport() {
  const header = ["Protocolo", "Título", "Categoria", "Autor", "Status", "Data"];
  const lines = complaints.map((item) => [item.id, item.title, item.category, item.author, item.status, item.date]);
  const csv = [header, ...lines].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "relatorio-schoolfix.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Relatório CSV exportado.");
}

function restoreSettings() {
  const values = readStored("schoolfix-settings", {});
  Object.entries(values).forEach(([name, value]) => {
    const field = document.querySelector(`[name="${name}"]`);
    if (field) {
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value;
    }
  });
}

function saveSettings(form) {
  const values = readStored("schoolfix-settings", {});
  new FormData(form).forEach((value, name) => { values[name] = value; });
  form.querySelectorAll('input[type="checkbox"]').forEach((field) => { values[field.name] = field.checked; });
  if (persist("schoolfix-settings", values)) showToast("Configurações salvas com sucesso.");
}

function renderAll() {
  renderHome();
  renderComplaints();
  renderReports();
  renderDirectList();
  renderSuggestions();
}

document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => goToPage(button.dataset.page)));
document.querySelectorAll("[data-navigate]").forEach((button) => button.addEventListener("click", () => goToPage(button.dataset.navigate)));

document.addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-complaint-page]");
  if (pageButton && !pageButton.disabled) {
    activeComplaintPage = Number(pageButton.dataset.complaintPage);
    renderComplaints();
    return;
  }
  const row = event.target.closest("[data-complaint-id]");
  if (row) {
    activeComplaintId = row.dataset.complaintId;
    renderComplaints();
    if (activePage !== "reclamacoes") goToPage("reclamacoes");
    return;
  }
  const personButton = event.target.closest("[data-person]");
  if (personButton) {
    activePersonName = personButton.dataset.person;
    renderDirectList();
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "new-complaint") {
    openDialog(`<h2>Nova reclamação</h2><p>Registre uma ocorrência para acompanhar e responder pela plataforma.</p><form id="new-complaint-form"><label>Título<input name="title" required minlength="5" maxlength="160" placeholder="Ex.: Manutenção da sala 204"></label><label>Categoria<select name="category" required><option>Infraestrutura</option><option>Pedagógico</option><option>Convivência</option><option>Alimentação</option></select></label><label>Descrição<textarea name="description" required minlength="10" maxlength="5000" placeholder="Descreva a situação..."></textarea></label><button class="button button-primary" type="submit">Registrar reclamação</button></form>`);
    return;
  }
  if (action === "new-suggestion") {
    openDialog(`<h2>Nova sugestão</h2><p>Compartilhe uma ideia para melhorar a experiência da comunidade acadêmica.</p><form id="new-suggestion-form"><label>Título<input name="title" required minlength="5" maxlength="120" placeholder="Resuma sua ideia"></label><label>Descrição<textarea name="description" required minlength="10" maxlength="3000" placeholder="Explique como essa sugestão pode ajudar..."></textarea></label><button class="button button-primary" type="submit">Enviar sugestão</button></form>`);
    return;
  }
  if (action === "toggle-filter") {
    const toolbar = document.querySelector(".list-toolbar");
    let select = toolbar.querySelector(".category-filter");
    if (select) { select.remove(); activeCategoryFilter = "Todas"; activeComplaintPage = 1; renderComplaints(); }
    else {
      select = document.createElement("select");
      select.className = "detail-select category-filter";
      select.setAttribute("aria-label", "Filtrar por categoria");
      select.innerHTML = `<option>Todas</option>${categories.map((item) => `<option>${item.name}</option>`).join("")}`;
      select.addEventListener("change", () => { activeCategoryFilter = select.value; activeComplaintPage = 1; renderComplaints(); });
      toolbar.append(select);
    }
    return;
  }
  if (action === "export-report") { exportReport(); return; }
  if (action === "read-notifications") {
    document.querySelector(".notification-dot").hidden = true;
    document.querySelector(".notification-popover").hidden = true;
    document.querySelector(".notification-button").setAttribute("aria-expanded", "false");
    showToast("Notificações marcadas como lidas.");
    return;
  }
  if (action === "attach") {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*,.pdf,.doc,.docx";
    picker.addEventListener("change", () => {
      if (picker.files?.[0]) showToast(`Arquivo selecionado: ${picker.files[0].name}`);
    });
    picker.click();
    return;
  }
  const dialogText = {
    "chat-info": ["Sobre o chat geral", "Este espaço é compartilhado pela comunidade escolar. Mantenha as conversas respeitosas e não compartilhe informações pessoais de estudantes."]
  };
  if (dialogText[action]) {
    openDialog(`<h2>${dialogText[action][0]}</h2><p>${dialogText[action][1]}</p>`);
    return;
  }
  if (action === "new-message") {
    openDialog(`<h2>Nova conversa</h2><p>Inicie uma conversa direta com um membro da escola.</p><form id="new-message-form"><label>Nome da pessoa<input name="name" required placeholder="Nome completo"></label><label>Função<input name="role" placeholder="Ex.: Professor(a)"></label><button class="button button-primary" type="submit">Iniciar conversa</button></form>`);
    return;
  }
  if (action === "change-password") {
    openDialog(`<h2>Alterar senha</h2><p>Escolha uma senha segura com pelo menos 10 caracteres.</p><form id="password-form"><label>Senha atual<input name="current" type="password" required minlength="10"></label><label>Nova senha<input name="password" type="password" required minlength="10"></label><label>Confirmar nova senha<input name="confirmation" type="password" required minlength="10"></label><button class="button button-primary" type="submit">Atualizar senha</button></form>`);
  }
});

document.addEventListener("submit", async (event) => {
  if (event.target.id === "response-form") {
    event.preventDefault();
    const text = event.target.elements.response.value.trim();
    if (!text) return;
    const complaint = complaints.find((item) => item.id === activeComplaintId);
    if (!complaint) return;
    const submit = event.target.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      if (demoMode) {
        const response = {
          author: currentUser.fullName,
          date: new Intl.DateTimeFormat("pt-BR").format(new Date()),
          text
        };
        const records = {
          ...demoRecords,
          complaints: demoRecords.complaints.map((item) => item.id === complaint.id
            ? { ...item, responses: [...item.responses, response], updatedAt: new Date().toISOString() }
            : item)
        };
        if (!saveDemoRecords(records)) return;
      } else {
        await apiRequest(`/api/complaints/${encodeURIComponent(complaint.id)}/responses`, {
          method: "POST",
          body: JSON.stringify({ message: text })
        });
      }
      await refreshComplaints();
      renderAll();
      showToast("Resposta enviada e adicionada ao histórico.");
    } catch (error) {
      showToast(error.message);
    } finally {
      submit.disabled = false;
    }
  } else if (event.target.id === "new-complaint-form") {
    createComplaint(event);
  } else if (event.target.id === "new-suggestion-form") {
    event.preventDefault();
    const form = event.target;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const values = {
        title: form.elements.title.value.trim(),
        description: form.elements.description.value.trim()
      };
      if (demoMode) {
        const suggestion = {
          id: `DEMO-S${Date.now()}`,
          userId: currentUser.id,
          ...values,
          status: "Recebida",
          author: currentUser.fullName,
          date: new Intl.DateTimeFormat("pt-BR").format(new Date())
        };
        if (!saveDemoRecords({ ...demoRecords, suggestions: [suggestion, ...demoRecords.suggestions] })) return;
      } else {
        await apiRequest("/api/suggestions", {
          method: "POST",
          body: JSON.stringify(values)
        });
      }
      await refreshSuggestions();
      getDialog().close();
      renderSuggestions();
      showToast("Sugestão registrada com sucesso.");
    } catch (error) {
      showToast(error.message);
    } finally {
      submit.disabled = false;
    }
  } else if (event.target.id === "complaint-rating-form") {
    event.preventDefault();
    const form = event.target;
    const complaint = complaints.find((item) => item.id === activeComplaintId);
    if (!complaint) return;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    apiRequest(`/api/complaints/${encodeURIComponent(complaint.id)}/rating`, {
      method: "POST",
      body: JSON.stringify({
        rating: Number(form.elements.rating.value),
        comment: form.elements.comment.value.trim()
      })
    }).then(async () => {
      await refreshComplaints();
      renderAll();
      showToast("Avaliação registrada com sucesso.");
    }).catch((error) => showToast(error.message))
      .finally(() => { submit.disabled = false; });
  } else if (event.target.id === "new-message-form") {
    event.preventDefault();
    const name = event.target.elements.name.value.trim();
    if (directPeople.some((person) => person.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
      showToast("Já existe uma conversa com essa pessoa.");
      return;
    }
    const person = { name, initials: name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(), role: event.target.elements.role.value.trim() || "Membro da escola", color: "blue-avatar", preview: "Conversa iniciada", time: "agora", messages: [] };
    directPeople.unshift(person);
    activePersonName = person.name;
    persist("schoolfix-direct-people", directPeople);
    getDialog().close();
    goToPage("mensagens");
    renderDirectList();
    showToast("Nova conversa iniciada.");
  } else if (event.target.id === "password-form") {
    event.preventDefault();
    const form = event.target;
    if (form.elements.password.value !== form.elements.confirmation.value) {
      showToast("A confirmação da senha não corresponde.");
      return;
    }
    apiRequest("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: form.elements.current.value, newPassword: form.elements.password.value })
    }).then(() => {
      getDialog().close();
      showToast("Senha atualizada com sucesso.");
    }).catch((error) => showToast(error.message));
  } else if (event.target.id === "admin-user-form") {
    event.preventDefault();
    const form = event.target;
    const feedback = document.getElementById("admin-user-feedback");
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    feedback.hidden = true;
    apiRequest("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    }).then(({ user }) => {
      feedback.textContent = `Conta de ${user.fullName} cadastrada com sucesso.`;
      feedback.classList.remove("error");
      feedback.hidden = false;
      form.reset();
    }).catch((error) => {
      feedback.textContent = error.message;
      feedback.classList.add("error");
      feedback.hidden = false;
    }).finally(() => { submit.disabled = false; });
  }
});

document.getElementById("complaint-search").addEventListener("input", () => {
  activeComplaintPage = 1;
  renderComplaints();
});
document.getElementById("people-search").addEventListener("input", renderDirectList);
document.querySelectorAll(".filter-chip").forEach((button) => button.addEventListener("click", () => {
  activeStatusFilter = button.dataset.filter;
  activeComplaintPage = 1;
  document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("selected", chip === button));
  renderComplaints();
}));
document.querySelectorAll(".channel").forEach((button) => button.addEventListener("click", () => {
  activeChannel = button.textContent.replace("#", "").trim();
  document.querySelectorAll(".channel").forEach((channel) => channel.classList.toggle("selected", channel === button));
  document.querySelector(".chat-room-heading p").textContent = activeChannel === "Geral"
    ? "Conversa aberta para toda a comunidade"
    : `Conversa do canal ${activeChannel}`;
  renderChannel();
}));
document.getElementById("complaint-detail").addEventListener("change", async (event) => {
  if (event.target.id !== "complaint-status") return;
  const complaint = complaints.find((item) => item.id === activeComplaintId);
  if (!complaint) return;
  const previousStatus = complaint.status;
  event.target.disabled = true;
  try {
    if (demoMode) {
      const records = {
        ...demoRecords,
        complaints: demoRecords.complaints.map((item) => item.id === complaint.id
          ? { ...item, status: event.target.value, updatedAt: new Date().toISOString() }
          : item)
      };
      if (!saveDemoRecords(records)) return;
    } else {
      await apiRequest(`/api/complaints/${encodeURIComponent(complaint.id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: event.target.value })
      });
    }
    await refreshComplaints();
    renderAll();
    showToast("Status da reclamação atualizado.");
  } catch (error) {
    complaint.status = previousStatus;
    renderComplaintDetail();
    showToast(error.message);
  }
});
document.getElementById("general-chat-form").addEventListener("submit", (event) => addChatMessage(event, true));
document.getElementById("direct-chat-form").addEventListener("submit", (event) => addChatMessage(event, false));
document.getElementById("report-period").addEventListener("change", (event) => {
  currentReportPeriod = Number(event.target.value);
  renderReports();
});
document.getElementById("institution-form").addEventListener("submit", (event) => {
  event.preventDefault();
  saveSettings(event.currentTarget);
});
document.getElementById("preferences-form").addEventListener("submit", (event) => {
  event.preventDefault();
  saveSettings(event.currentTarget);
});
document.getElementById("logout-button").addEventListener("click", async () => {
  const button = document.getElementById("logout-button");
  button.disabled = true;
  if (demoMode) {
    window.location.replace("login.html");
    return;
  }
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
    window.location.replace("/");
  } catch (error) {
    button.disabled = false;
    showToast(error.message);
  }
});
window.addEventListener("storage", (event) => {
  if (!demoMode || event.key !== demoRecordsKey) return;
  refreshDemoRecords();
  renderAll();
});
document.querySelectorAll('.settings-card input[type="checkbox"]').forEach((input) => input.addEventListener("change", () => {
  const values = readStored("schoolfix-settings", {});
  values[input.name] = input.checked;
  persist("schoolfix-settings", values);
  showToast("Preferência de notificação atualizada.");
}));
document.querySelector(".notification-button").addEventListener("click", (event) => {
  const popover = document.querySelector(".notification-popover");
  popover.hidden = !popover.hidden;
  event.currentTarget.setAttribute("aria-expanded", String(!popover.hidden));
});
document.getElementById("app-dialog").addEventListener("click", (event) => {
  if (event.target === getDialog()) getDialog().close();
});
document.querySelector(".dialog-close").addEventListener("click", () => getDialog().close());
window.addEventListener("hashchange", () => {
  const page = location.hash.slice(1);
  if (page) goToPage(page);
});

initializeAuthenticatedApp();
