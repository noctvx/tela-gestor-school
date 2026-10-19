const initialComplaints = [
  { id: "1024", title: "Infiltração no teto do Laboratório de Química", category: "Infraestrutura", author: "Prof. Alberto", initials: "PA", status: "Urgente", date: "15 Out, 10:42", description: "Durante as chuvas de ontem, formou-se uma infiltração no teto do laboratório de química, próximo às bancadas. A água pode danificar os equipamentos e oferece risco para estudantes e professores.", responses: [{ author: "Gestor Mario", date: "15 Out, 11:06", text: "Obrigado pelo aviso. A equipe de manutenção foi acionada e fará uma vistoria ainda hoje." }] },
  { id: "1023", title: "Falta de opções veganas na merenda escolar", category: "Alimentação", author: "Maria S. (Mãe)", initials: "MS", status: "Em Análise", date: "15 Out, 08:15", description: "Gostaria de solicitar mais opções veganas no cardápio da merenda. Atualmente há poucas alternativas para estudantes com restrições alimentares.", responses: [] },
  { id: "1022", title: "Discussão recorrente no intervalo do 9º ano", category: "Convivência", author: "Lucas Torres", initials: "LT", status: "Pendente", date: "14 Out, 16:30", description: "Há discussões recorrentes durante o intervalo entre alguns estudantes do 9º ano. Seria importante acompanhar a situação e conversar com a turma.", responses: [] },
  { id: "1021", title: "Substituição do material didático de Geografia", category: "Pedagógico", author: "Cláudia L.", initials: "CL", status: "Resolvido", date: "14 Out, 14:00", description: "Os livros de Geografia utilizados pela turma estão desatualizados e alguns exemplares estão danificados.", responses: [{ author: "Gestor Mario", date: "14 Out, 15:22", text: "Os novos materiais já foram solicitados e entregues à coordenação." }] },
  { id: "1020", title: "Ar condicionado quebrado na sala 204", category: "Infraestrutura", author: "Prof. Alberto", initials: "PA", status: "Em Análise", date: "12 Out, 11:10", description: "O ar condicionado da sala 204 parou de funcionar e a sala fica muito quente durante as aulas da tarde.", responses: [] },
  { id: "1019", title: "Troca de lâmpadas no corredor do bloco B", category: "Infraestrutura", author: "Laura Nunes", initials: "LN", status: "Resolvido", date: "11 Out, 09:40", description: "Algumas lâmpadas do corredor do bloco B estão queimadas, deixando o espaço com pouca iluminação.", responses: [] },
  { id: "1018", title: "Mais livros de literatura na biblioteca", category: "Pedagógico", author: "Ana Silva", initials: "AS", status: "Pendente", date: "10 Out, 13:25", description: "A biblioteca poderia receber novos títulos de literatura contemporânea para as turmas do ensino médio.", responses: [] },
  { id: "1017", title: "Manutenção dos bebedouros do pátio", category: "Infraestrutura", author: "Marcos Souza", initials: "MS", status: "Arquivada", date: "08 Out, 08:55", description: "Dois bebedouros do pátio estão com vazamento e precisam de manutenção.", responses: [] }
];

const statusClass = {
  "Urgente": "status-urgent",
  "Pendente": "status-pending",
  "Em Análise": "status-analysis",
  "Resolvido": "status-resolved",
  "Arquivada": "status-archived"
};
const categories = [
  { name: "Infraestrutura", amount: 45, color: "#dd7773" },
  { name: "Pedagógico", amount: 35, color: "#6f88db" },
  { name: "Convivência", amount: 28, color: "#e5ad5e" },
  { name: "Alimentação", amount: 16, color: "#55a889" }
];
const directPeopleInitial = [
  { name: "Ana Silva", initials: "AS", role: "Professora", color: "lavender", preview: "Obrigada pelo retorno!", time: "09:31", messages: [{ author: "Ana Silva", time: "09:12", text: "Olá, Gestor! Gostaria de saber se já temos novidades sobre a biblioteca." }, { author: "Gestor Mario", time: "09:20", text: "Oi, Ana! Estou confirmando o cronograma com a equipe e retorno assim que tiver uma atualização." }, { author: "Ana Silva", time: "09:31", text: "Obrigada pelo retorno!" }] },
  { name: "Marcos Souza", initials: "MS", role: "Coordenador", color: "mint", preview: "Perfeito, vou acompanhar.", time: "Ontem", messages: [{ author: "Marcos Souza", time: "Ontem", text: "Consegui falar com a equipe de manutenção." }, { author: "Gestor Mario", time: "Ontem", text: "Perfeito, vou acompanhar. Obrigado!" }] },
  { name: "Lucas Torres", initials: "LT", role: "Aluno", color: "peach", preview: "Valeu pela ajuda!", time: "Seg", messages: [{ author: "Lucas Torres", time: "Seg", text: "Olá, gostaria de saber como faço para acompanhar uma reclamação." }, { author: "Gestor Mario", time: "Seg", text: "Você pode acompanhar o status na área de reclamações." }, { author: "Lucas Torres", time: "Seg", text: "Valeu pela ajuda!" }] },
  { name: "Carla Pereira", initials: "CP", role: "Professora", color: "blue-avatar", preview: "Até mais!", time: "12 Out", messages: [{ author: "Carla Pereira", time: "12 Out", text: "Obrigada pelas informações sobre o calendário escolar." }] }
];

function readStored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn(`Não foi possível ler os dados locais de ${key}.`, error);
    return fallback;
  }
}

let complaints = readStored("schoolfix-complaints", initialComplaints);
if (!Array.isArray(complaints)) complaints = initialComplaints;
let activeComplaintId = complaints[0]?.id || null;
let activeStatusFilter = "Todas";
let activeCategoryFilter = "Todas";
let activeComplaintPage = 1;
const complaintPageSize = 6;
let activePage = "inicio";
let toastTimer;
let directPeople = readStored("schoolfix-direct-people", directPeopleInitial);
if (!Array.isArray(directPeople)) directPeople = directPeopleInitial;
let activePersonName = directPeople[0]?.name || "";
let activeChannel = "Geral";
let channelMessages = readStored("schoolfix-channel-messages", {});
if (!channelMessages || typeof channelMessages !== "object" || Array.isArray(channelMessages)) channelMessages = {};
let currentReportPeriod = 30;

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
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
  document.getElementById("home-complaints").innerHTML = complaints.slice(0, 5).map((complaint) => `
    <tr data-complaint-id="${escapeText(complaint.id)}">
      <td class="issue-cell">${escapeText(complaint.title)}<span class="issue-subtitle">#${escapeText(complaint.id)}</span></td>
      <td>${escapeText(complaint.category)}</td><td>${complaintStatus(complaint)}</td><td>${escapeText(complaint.date)}</td><td class="row-open">›</td>
    </tr>`).join("");
  document.getElementById("home-categories").innerHTML = categories.map((category) => `
    <div class="category-item"><div class="category-meta"><span>${category.name}</span><span>${category.amount} ocorrências</span></div>
    <div class="progress-track"><span style="width:${Math.round(category.amount / 148 * 100)}%;background:${category.color}"></span></div></div>`).join("");
}

function getFilteredComplaints() {
  const query = document.getElementById("complaint-search").value.trim().toLocaleLowerCase("pt-BR");
  return complaints.filter((complaint) => {
    const matchesStatus = activeStatusFilter === "Todas"
      || (activeStatusFilter === "Aberta" && ["Urgente", "Pendente"].includes(complaint.status))
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
  rows.innerHTML = pageComplaints.map((complaint) => `
    <tr data-complaint-id="${escapeText(complaint.id)}" aria-selected="${complaint.id === activeComplaintId}">
      <td class="protocol">#${escapeText(complaint.id)}</td>
      <td class="issue-cell">${escapeText(complaint.title)}</td><td>${escapeText(complaint.category)}</td>
      <td><span class="author-cell"><span class="mini-avatar">${escapeText(complaint.initials)}</span><span class="author-name">${escapeText(complaint.author)}</span></span></td>
      <td>${complaintStatus(complaint)}</td><td>${escapeText(complaint.date)}</td><td class="row-open">›</td>
    </tr>`).join("");
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
  detail.innerHTML = `
    <div class="detail-top"><div><span class="detail-protocol">PROTOCOLO #${escapeText(complaint.id)}</span><h2>${escapeText(complaint.title)}</h2></div>${complaintStatus(complaint)}</div>
    <div class="detail-field"><span class="detail-label">Categoria</span><div class="detail-value">${escapeText(complaint.category)} <span style="color:#9a9eac">·</span> Por ${escapeText(complaint.author)}</div></div>
    <div class="detail-field detail-description-field"><span class="detail-label">Descrição do problema</span><div class="detail-value detail-description">${escapeText(complaint.description)}</div></div>
    <div class="detail-field"><label class="detail-label" for="complaint-status">Atualizar status</label><select class="detail-select" id="complaint-status"><option ${complaint.status === "Urgente" ? "selected" : ""}>Urgente</option><option ${complaint.status === "Pendente" ? "selected" : ""}>Pendente</option><option ${complaint.status === "Em Análise" ? "selected" : ""}>Em Análise</option><option ${complaint.status === "Resolvido" ? "selected" : ""}>Resolvido</option><option ${complaint.status === "Arquivada" ? "selected" : ""}>Arquivada</option></select></div>
    <div class="detail-field response-block"><span class="detail-label">Histórico de respostas (${complaint.responses.length})</span><div class="response-list">${responses || '<div class="empty-state">Nenhuma resposta enviada ainda.</div>'}</div></div>
    <form class="response-form response-block" id="response-form"><label class="detail-label" for="response-text">Campo de resposta oficial</label><textarea id="response-text" name="response" placeholder="Escreva a resposta oficial para o usuário..." required></textarea><button class="button button-primary" type="submit">Enviar resposta</button></form>`;
}

function renderReports() {
  const period = currentReportPeriod;
  const statusValues = [
    { name: "Resolvidas", count: period === 30 ? 71 : period === 90 ? 124 : 287, color: "#38a879" },
    { name: "Em análise", count: period === 30 ? 45 : period === 90 ? 79 : 169, color: "#5082dc" },
    { name: "Pendentes", count: period === 30 ? 32 : period === 90 ? 48 : 108, color: "#e7a13b" }
  ];
  const total = statusValues.reduce((sum, item) => sum + item.count, 0);
  document.getElementById("report-status-bars").innerHTML = statusValues.map((item) => `
    <div class="report-status-row"><div class="report-status-label"><span>${item.name}</span><span>${item.count} chamados</span></div><div class="report-track"><span style="width:${Math.round(item.count / total * 100)}%;background:${item.color}"></span></div></div>`).join("");
  const chartItems = [
    { name: "Infra", amount: 45, color: "#e84a4f" },
    { name: "Ensino", amount: 35, color: "#4788e6" },
    { name: "Conv.", amount: 28, color: "#eba535" },
    { name: "Alim.", amount: 16, color: "#38a879" }
  ];
  document.getElementById("category-chart").innerHTML = chartItems.map((item) => `
    <div class="chart-column"><strong>${item.amount}</strong><div class="chart-bar" style="height:${Math.max(14, item.amount / 45 * 105)}px;background:${item.color}"></div><span>${item.name}</span></div>`).join("");
}

function renderMessages(container, messages) {
  container.innerHTML = "";
  const separator = document.createElement("div");
  separator.className = "date-separator";
  separator.innerHTML = "<span>HOJE</span>";
  container.append(separator);
  messages.forEach((message) => {
    const article = document.createElement("article");
    article.className = `message${message.author === "Gestor Mario" ? " own-message" : ""}`;
    const initials = message.author === "Gestor Mario" ? "M" : message.author.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
    const avatar = document.createElement("span");
    avatar.className = `person-avatar ${message.author === "Gestor Mario" ? "navy-avatar" : "mint"}`;
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

function getChannelMessages(channel) {
  if (!channelMessages[channel]) {
    channelMessages[channel] = channel === "Geral" ? [
      { author: "Ana Silva", time: "09:12", text: "Oi, pessoal! Alguém sabe quando teremos novidades sobre a biblioteca?" },
      { author: "Marcos Souza", time: "09:18", text: "Oi, Ana! Estamos organizando tudo e logo compartilharemos as atualizações por aqui." },
      { author: "Gestor Mario", time: "09:24", text: "Excelente ponto! Vou confirmar o cronograma com a equipe e aviso vocês ainda hoje." },
      { author: "Lucas Torres", time: "09:31", text: "Obrigado pelo retorno, Gestor! 😊" }
    ] : [];
  }
  return channelMessages[channel];
}

function renderChannel() {
  const messages = getChannelMessages(activeChannel);
  const container = document.getElementById("general-messages");
  renderMessages(container, messages);
  document.querySelector(".chat-room-heading h2").textContent = `# ${activeChannel}`;
  if (messages.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Este canal ainda não tem mensagens. Comece a conversa!";
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

function addChatMessage(event, channel) {
  event.preventDefault();
  const input = event.currentTarget.elements.message;
  const text = input.value.trim();
  if (!text) return;
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
  if (channel) {
    getChannelMessages(activeChannel).push({ author: "Gestor Mario", time, text });
    persist("schoolfix-channel-messages", channelMessages);
    renderChannel();
  } else {
    const person = directPeople.find((item) => item.name === activePersonName);
    if (!person) return;
    person.messages.push({ author: "Gestor Mario", time, text });
    person.preview = text;
    person.time = time;
    persist("schoolfix-direct-people", directPeople);
    renderDirectList();
  }
  input.value = "";
}

function createComplaint(event) {
  event.preventDefault();
  const form = event.target;
  const title = form.elements.title.value.trim();
  if (!title) return;
  const nextId = String(Math.max(0, ...complaints.map((complaint) => Number(complaint.id) || 0)) + 1);
  const complaint = {
    id: nextId,
    title,
    category: form.elements.category.value,
    author: form.elements.author.value.trim() || "Gestor Mario",
    initials: "GM",
    status: "Pendente",
    date: "15 Out, agora",
    description: form.elements.description.value.trim() || "Reclamação registrada pela gestão escolar.",
    responses: []
  };
  complaints.unshift(complaint);
  activeComplaintId = complaint.id;
  activeComplaintPage = 1;
  persist("schoolfix-complaints", complaints);
  getDialog().close();
  renderAll();
  goToPage("reclamacoes");
  showToast("Reclamação registrada com sucesso.");
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
    openDialog(`<h2>Nova reclamação</h2><p>Registre uma ocorrência para acompanhar e responder pela plataforma.</p><form id="new-complaint-form"><label>Título<input name="title" required maxlength="100" placeholder="Ex.: Manutenção da sala 204"></label><label>Categoria<select name="category"><option>Infraestrutura</option><option>Pedagógico</option><option>Convivência</option><option>Alimentação</option></select></label><label>Solicitante<input name="author" placeholder="Nome do solicitante"></label><label>Descrição<textarea name="description" placeholder="Descreva a situação..."></textarea></label><button class="button button-primary" type="submit">Registrar reclamação</button></form>`);
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
    "chat-info": ["Sobre o chat geral", "Este espaço é compartilhado pela comunidade escolar. Mantenha as conversas respeitosas e não compartilhe informações pessoais de estudantes."],
    members: ["Membros do canal", "Ana Silva · Professora<br>Marcos Souza · Coordenador<br>Lucas Torres · Aluno<br>Carla Pereira · Professora<br>Gestor Mario · Gestor Geral"]
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
    openDialog(`<h2>Alterar senha</h2><p>Escolha uma senha segura com pelo menos 8 caracteres.</p><form id="password-form"><label>Senha atual<input name="current" type="password" required></label><label>Nova senha<input name="password" type="password" required minlength="8"></label><label>Confirmar nova senha<input name="confirmation" type="password" required minlength="8"></label><button class="button button-primary" type="submit">Atualizar senha</button></form>`);
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "response-form") {
    event.preventDefault();
    const text = event.target.elements.response.value.trim();
    if (!text) return;
    const complaint = complaints.find((item) => item.id === activeComplaintId);
    if (!complaint) return;
    const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    complaint.responses.push({ author: "Gestor Mario", date: `15 Out, ${time}`, text });
    persist("schoolfix-complaints", complaints);
    renderComplaints();
    showToast("Resposta enviada e adicionada ao histórico.");
  } else if (event.target.id === "new-complaint-form") {
    createComplaint(event);
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
    getDialog().close();
    showToast("Senha atualizada com sucesso.");
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
document.getElementById("complaint-detail").addEventListener("change", (event) => {
  if (event.target.id !== "complaint-status") return;
  const complaint = complaints.find((item) => item.id === activeComplaintId);
  if (!complaint) return;
  complaint.status = event.target.value;
  persist("schoolfix-complaints", complaints);
  renderHome();
  renderComplaints();
  showToast("Status da reclamação atualizado.");
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

restoreSettings();
renderAll();
const initialPage = location.hash.slice(1);
if (initialPage && document.getElementById(`page-${initialPage}`)) goToPage(initialPage);
