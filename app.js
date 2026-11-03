const $ = id => document.getElementById(id);

if (typeof window !== "undefined" && window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

function showToast(message) {
  let toast = $("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "toast-notification";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = "1";
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => { toast.style.opacity = "0"; }, 2800);
}

let soundEnabled = true;
function playFinishChime() {
  if (!soundEnabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.14);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.14 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.14);
      osc.stop(ctx.currentTime + i * 0.14 + 0.36);
    });
  } catch (e) {}
}

function getCurrentWeekKey(dateObj = new Date()) {
  const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

const RANK_TIERS = [
  { minHours: 0, name: "HIERRO III", gem: "🪨" },
  { minHours: 2, name: "HIERRO II", gem: "🪨" },
  { minHours: 4, name: "HIERRO I", gem: "🪨" },
  { minHours: 6, name: "BRONCE III", gem: "🥉" },
  { minHours: 8, name: "BRONCE II", gem: "🥉" },
  { minHours: 10, name: "BRONCE I", gem: "🥉" },
  { minHours: 13, name: "PLATA III", gem: "🥈" },
  { minHours: 16, name: "PLATA II", gem: "🥈" },
  { minHours: 19, name: "PLATA I", gem: "🥈" },
  { minHours: 22, name: "ORO III", gem: "🥇" },
  { minHours: 25, name: "ORO II", gem: "🥇" },
  { minHours: 28, name: "ORO I", gem: "🥇" },
  { minHours: 32, name: "PLATINO", gem: "💠" },
  { minHours: 36, name: "DIAMANTE", gem: "💎" },
  { minHours: 40, name: "MAESTRO", gem: "👑" },
  { minHours: 45, name: "GRAN MAESTRO", gem: "🔥" }
];

const defaultData = {
  xp: 120,
  currentWeekKey: getCurrentWeekKey(),
  weeklyMinutes: 0,
  pastWeeks: [
    { weekKey: "2026-W43", hours: 8.5, rank: "BRONCE II", xpBonus: 170 },
    { weekKey: "2026-W44", hours: 14.0, rank: "PLATA III", xpBonus: 280 }
  ],
  sessions: [],
  subjects: [
    { id: 1, name: "Anatomía", color: "#3b82f6", minutes: 90 },
    { id: 2, name: "Histología", color: "#8b5cf6", minutes: 45 },
    { id: 3, name: "Embriología", color: "#f59e0b", minutes: 30 }
  ],
  cards: [
    { id: 101, subjectId: 1, front: "¿Qué estructura conecta los dos hemisferios cerebrales?", back: "El cuerpo calloso.", reviews: 1 },
    { id: 102, subjectId: 2, front: "¿Cuál es el epitelio de las vías urinarias?", back: "Epitelio polimorfo o de transición (urotelio).", reviews: 2 }
  ],
  activeDays: []
};

let data;
try {
  const raw = localStorage.getItem("studyupData_v3");
  data = raw ? { ...structuredClone(defaultData), ...JSON.parse(raw) } : structuredClone(defaultData);
} catch (e) {
  data = structuredClone(defaultData);
}

function saveData() {
  try { localStorage.setItem("studyupData_v3", JSON.stringify(data)); } catch (e) {}
}

function checkWeeklyRollover() {
  const actualWeek = getCurrentWeekKey();
  if (data.currentWeekKey && data.currentWeekKey !== actualWeek) {
    archiveCurrentWeekAndReset(actualWeek);
  }
}

function archiveCurrentWeekAndReset(newWeekKey) {
  const hours = Number((data.weeklyMinutes / 60).toFixed(1));
  const rankObj = getRankInfo(hours);
  const xpBonus = Math.round(hours * 20);
  data.pastWeeks.unshift({ weekKey: data.currentWeekKey, hours, rank: rankObj.current.name, xpBonus });
  data.xp += xpBonus;
  data.currentWeekKey = newWeekKey;
  data.weeklyMinutes = 0;
  saveData();
  showToast(`¡Nueva semana iniciada! Bono semanal: +${xpBonus} XP`);
}

function getRankInfo(hours) {
  let current = RANK_TIERS[0], next = RANK_TIERS[1];
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (hours >= RANK_TIERS[i].minHours) {
      current = RANK_TIERS[i];
      next = RANK_TIERS[i + 1] || null;
    }
  }
  let progressPct = 100, remainingHours = 0;
  if (next) {
    const span = next.minHours - current.minHours;
    progressPct = Math.min(100, Math.max(5, Math.round(((hours - current.minHours) / span) * 100)));
    remainingHours = Math.max(0, next.minHours - hours);
  }
  return { current, next, progressPct, remainingHours };
}

function getCountdownToNextMonday() {
  const now = new Date(), nextMonday = new Date(now);
  const day = now.getDay();
  nextMonday.setDate(now.getDate() + (day === 0 ? 1 : 8 - day));
  nextMonday.setHours(0, 0, 0, 0);
  const diffMs = Math.max(0, nextMonday - now);
  const d = Math.floor(diffMs / 86400000);
  const h = Math.floor((diffMs / 3600000) % 24);
  return `REINICIO SEMANAL EN ${d}D ${h}H`;
}

function calculateStreak() {
  const days = new Set(data.activeDays);
  let streak = 0;
  const date = new Date();
  if (!days.has(date.toDateString())) date.setDate(date.getDate() - 1);
  while (days.has(date.toDateString())) {
    streak++;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}

function navigateTo(viewName) {
  ["home", "study", "pdf", "ranking"].forEach(v => {
    const el = $(`view-${v}`);
    if (el) el.classList.toggle("hidden", v !== viewName);
  });
  document.querySelectorAll(".bottom-nav .nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.nav === viewName);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}

let timerMode = "pomo25", targetSeconds = 1500, elapsedSeconds = 0, timerRunning = false, timerInterval = null, lastTickTime = null;

function setTimerMode(mode, customMin = 30) {
  if (timerRunning) pauseTimer();
  timerMode = mode;
  elapsedSeconds = 0;
  if (mode === "pomo25") targetSeconds = 1500;
  else if (mode === "deep50") targetSeconds = 3000;
  else if (mode === "quick15") targetSeconds = 900;
  else if (mode === "custom") targetSeconds = Math.max(1, Number(customMin)) * 60;
  else targetSeconds = 0;

  $("customMinutesRow").classList.toggle("hidden", mode !== "custom");
  document.querySelectorAll("#timerModePills .pill-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  $("startBtn").textContent = "▶ Iniciar sesión";
  $("timerStateLabel").textContent = mode === "stopwatch" ? "MODO CRONÓMETRO LIBRE" : "TEMPORIZADOR PREPARADO";
  updateTimerDisplay();
}

function formatClock(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600), m = Math.floor((totalSeconds % 3600) / 60), s = totalSeconds % 60;
  return (h > 0 ? [h, m, s] : [m, s]).map(n => String(n).padStart(2, "0")).join(":");
}

function updateTimerDisplay() {
  $("timer").textContent = formatClock(timerMode === "stopwatch" ? elapsedSeconds : Math.max(0, targetSeconds - elapsedSeconds));
  $("saveBtn").disabled = elapsedSeconds < 60;
}

function pauseTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  $("startBtn").textContent = "▶ Continuar";
  $("timerStateLabel").textContent = "SESIÓN EN PAUSA";
}

function toggleTimer() {
  if (timerRunning) { pauseTimer(); return; }
  timerRunning = true;
  lastTickTime = Date.now();
  $("startBtn").textContent = "Ⅱ Pausar";
  $("timerStateLabel").textContent = "ENFOQUE ACTIVO EN CURSO...";
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const now = Date.now();
    elapsedSeconds += Math.max(1, Math.floor((now - lastTickTime) / 1000));
    lastTickTime = now;
    if (timerMode !== "stopwatch" && elapsedSeconds >= targetSeconds) {
      elapsedSeconds = targetSeconds;
      updateTimerDisplay();
      clearInterval(timerInterval);
      timerRunning = false;
      playFinishChime();
      $("timerStateLabel").textContent = "¡TIEMPO COMPLETADO! (+25 XP BONO)";
      $("startBtn").textContent = "▶ Iniciar nueva";
      saveSession(true);
      return;
    }
    updateTimerDisplay();
  }, 1000);
}

function resetTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  elapsedSeconds = 0;
  $("startBtn").textContent = "▶ Iniciar sesión";
  $("timerStateLabel").textContent = "LISTO PARA EMPEZAR";
  updateTimerDisplay();
}

function saveSession(autoCompleted = false) {
  const subjectId = Number($("subjectSelect").value);
  const subject = data.subjects.find(s => s.id === subjectId) || data.subjects[0];
  if (!subject || elapsedSeconds < 60) {
    showToast("Estudiá al menos 1 minuto para guardar la sesión.");
    return;
  }
  const minutes = Math.floor(elapsedSeconds / 60);
  const xpEarned = minutes * 2 + (autoCompleted ? 25 : 0);
  subject.minutes += minutes;
  data.weeklyMinutes += minutes;
  data.xp += xpEarned;
  data.sessions.unshift({ subject: subject.name, minutes, xp: xpEarned, mode: timerMode, date: new Date().toISOString() });
  const today = new Date().toDateString();
  if (!data.activeDays.includes(today)) data.activeDays.push(today);
  saveData();
  resetTimer();
  render();
  showToast(`¡Sesión de ${minutes} min guardada! +${xpEarned} XP`);
}

let pdfDraftCards = [];
async function handlePdfUpload(file) {
  if (!file) return;
  $("pdfWorkspace").classList.remove("hidden");
  $("pdfFileNameLabel").textContent = `📄 ${file.name}`;
  $("pdfStatsLabel").textContent = "Extrayendo texto del PDF...";
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    const maxPages = Math.min(pdf.numPages, 25);
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(" ") + "\n\n";
    }
    $("pdfExtractedText").value = fullText.trim();
    $("pdfStatsLabel").textContent = `${maxPages} página(s) procesadas con éxito`;
    generateCardsFromText(fullText);
    showToast("¡PDF analizado! Revisá las flashcards sugeridas.");
  } catch (err) {
    $("pdfStatsLabel").textContent = "Modo manual activado";
  }
}

function loadSamplePdfContent() {
  const sampleText = [
    "Neurona: Unidad estructural y funcional del sistema nervioso encargada de transmitir impulsos eléctricos y químicos.",
    "Mielina: Capa lipoproteica que envuelve los axones y acelera la conducción saltatoria del potencial de acción.",
    "Células de Schwann: Células gliales que forman la vaina de mielina en el sistema nervioso periférico (SNP).",
    "Oligodendrocitos: Células gliales encargadas de formar la vaina de mielina en el sistema nervioso central (SNC).",
    "Sinapsis química: Unión funcional intercelular mediada por la liberación de neurotransmisores.",
    "Polígono de Willis: Anillo arterial anastomótico en la base del encéfalo que garantiza el flujo cerebral."
  ].join("\n\n");
  $("pdfWorkspace").classList.remove("hidden");
  $("pdfFileNameLabel").textContent = "📄 Apuntes_Neuroanatomia_Demo.pdf";
  $("pdfStatsLabel").textContent = "6 conceptos clave extraídos automáticamente";
  $("pdfExtractedText").value = sampleText;
  generateCardsFromText(sampleText);
  showToast("PDF de ejemplo cargado con 6 flashcards sugeridas.");
}

function generateCardsFromText(rawText) {
  const lines = rawText.split(/\n+/).map(l => l.trim()).filter(l => l.length > 18);
  const generated = [];
  lines.forEach(line => {
    const colonMatch = line.match(/^([^:–\-]{3,65})[:–\-]\s+(.{12,})$/);
    if (colonMatch) {
      generated.push({ front: `¿Qué es o cómo se define "${colonMatch[1].trim()}"?`, back: colonMatch[2].trim() });
    } else {
      const words = line.split(" ").slice(0, 6).join(" ").replace(/[.,:;]/g, "");
      generated.push({ front: `Explicá el concepto clave sobre: "${words}..."`, back: line.slice(0, 260) });
    }
  });
  pdfDraftCards = generated.slice(0, 12);
  renderPdfDrafts();
}

function renderPdfDrafts() {
  const list = $("pdfDraftsList");
  list.innerHTML = "";
  $("draftCountBadge").textContent = pdfDraftCards.length;
  pdfDraftCards.forEach((draft, idx) => {
    const card = document.createElement("div");
    card.className = "draft-card";
    const qInput = document.createElement("input");
    qInput.value = draft.front;
    qInput.style.marginBottom = "8px";
    qInput.addEventListener("input", e => { pdfDraftCards[idx].front = e.target.value; });
    const aInput = document.createElement("textarea");
    aInput.rows = 2;
    aInput.value = draft.back;
    aInput.style.marginBottom = "8px";
    aInput.addEventListener("input", e => { pdfDraftCards[idx].back = e.target.value; });
    const actions = document.createElement("div");
    actions.className = "timer-actions";
    const addOneBtn = document.createElement("button");
    addOneBtn.type = "button";
    addOneBtn.className = "secondary-btn";
    addOneBtn.textContent = "＋ Guardar esta tarjeta (+3 XP)";
    addOneBtn.addEventListener("click", () => {
      const subjId = Number($("pdfTargetSubjectSelect").value) || data.subjects[0]?.id || 1;
      data.cards.push({ id: Date.now() + idx, subjectId: subjId, front: pdfDraftCards[idx].front, back: pdfDraftCards[idx].back, reviews: 0 });
      data.xp += 3;
      pdfDraftCards.splice(idx, 1);
      saveData(); renderPdfDrafts(); renderFlashcards(); renderStats();
      showToast("Flashcard añadida (+3 XP)");
    });
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "danger-btn";
    removeBtn.textContent = "Descartar";
    removeBtn.addEventListener("click", () => { pdfDraftCards.splice(idx, 1); renderPdfDrafts(); });
    actions.append(addOneBtn, removeBtn);
    card.append(qInput, aInput, actions);
    list.appendChild(card);
  });
}

let selectedCardIndex = 0;
function getFilteredCards() {
  const filterVal = $("deckFilterSubject") ? $("deckFilterSubject").value : "all";
  return (!filterVal || filterVal === "all") ? data.cards : data.cards.filter(c => String(c.subjectId) === String(filterVal));
}

function renderFlashcards() {
  const cards = getFilteredCards();
  $("totalCardsStat").textContent = data.cards.length;
  $("dueCardsStat").textContent = `${data.cards.length} listas para repaso activo`;
  if (!cards.length) {
    $("cardSubjectBadge").textContent = "Sin tarjetas";
    $("cardCounterBadge").textContent = "0 / 0";
    $("cardQuestion").textContent = "No hay flashcards en esta vista. Subí un PDF o creá una tarjeta.";
    $("cardAnswer").textContent = "";
    $("cardAnswer").classList.add("hidden");
    return;
  }
  if (selectedCardIndex >= cards.length) selectedCardIndex = 0;
  if (selectedCardIndex < 0) selectedCardIndex = cards.length - 1;
  const card = cards[selectedCardIndex];
  const subj = data.subjects.find(s => s.id === Number(card.subjectId));
  $("cardSubjectBadge").textContent = subj ? subj.name : "General";
  $("cardCounterBadge").textContent = `${selectedCardIndex + 1} / ${cards.length}`;
  $("cardQuestion").textContent = card.front;
  $("cardAnswer").textContent = card.back;
  $("cardAnswer").classList.add("hidden");
}

function rateCurrentCard(rating) {
  const cards = getFilteredCards();
  if (!cards.length) return;
  const gained = { hard: 2, good: 5, easy: 8 }[rating] || 4;
  cards[selectedCardIndex].reviews = (cards[selectedCardIndex].reviews || 0) + 1;
  data.xp += gained;
  selectedCardIndex = (selectedCardIndex + 1) % cards.length;
  saveData(); renderStats(); renderFlashcards();
  showToast(`¡Repaso registrado! +${gained} XP`);
}

function renderStats() {
  const weeklyHours = data.weeklyMinutes / 60;
  const rankInfo = getRankInfo(weeklyHours);
  $("totalXp").textContent = data.xp;
  $("level").textContent = Math.floor(data.xp / 500) + 1;
  $("nextLevel").textContent = `${500 - (data.xp % 500)} XP para subir de nivel`;
  $("overallRank").textContent = rankInfo.current.name;
  $("overallRankGem").textContent = rankInfo.current.gem;
  $("weeklyHours").textContent = `${weeklyHours.toFixed(1)} h estudiadas esta semana`;
  $("rankProgressFill").style.width = `${rankInfo.progressPct}%`;
  $("weekResetCountdown").textContent = getCountdownToNextMonday();
  $("nextRankHint").textContent = rankInfo.next
    ? `Faltan ${rankInfo.remainingHours.toFixed(1)} h esta semana para ascender a ${rankInfo.next.name}`
    : "¡Alcanzaste el rango máximo de la liga semanal!";
  $("streak").textContent = calculateStreak();
}

function populateSubjectSelects() {
  [$("subjectSelect"), $("pdfTargetSubjectSelect"), $("cardSubjectSelect")].forEach(sel => {
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = "";
    data.subjects.forEach(subj => {
      const opt = document.createElement("option");
      opt.value = subj.id;
      opt.textContent = subj.name;
      sel.appendChild(opt);
    });
    if (prev && Array.from(sel.options).some(o => o.value === prev)) sel.value = prev;
  });
  const filterSel = $("deckFilterSubject");
  if (filterSel) {
    const prevFilter = filterSel.value || "all";
    filterSel.innerHTML = `<option value="all">Todas las materias (${data.cards.length})</option>`;
    data.subjects.forEach(subj => {
      const count = data.cards.filter(c => Number(c.subjectId) === subj.id).length;
      const opt = document.createElement("option");
      opt.value = subj.id;
      opt.textContent = `${subj.name} (${count})`;
      filterSel.appendChild(opt);
    });
    filterSel.value = prevFilter;
  }
}

function renderSubjects() {
  populateSubjectSelects();
  const list = $("subjectsList");
  list.innerHTML = "";
  data.subjects.forEach(subject => {
    const hours = (subject.minutes / 60).toFixed(1);
    const subjRank = getRankInfo(subject.minutes / 60).current;
    const item = document.createElement("div");
    item.className = "subject-card";
    item.style.borderLeft = `4px solid ${subject.color}`;
    item.innerHTML = `<div class="subject-card-header"><strong>${subject.name}</strong><small class="pill-btn active">${subjRank.gem} ${subjRank.name}</small></div><p class="muted" style="margin-top:6px">${hours} h acumuladas · ${data.cards.filter(c => Number(c.subjectId) === subject.id).length} flashcards</p>`;
    list.appendChild(item);
  });
}

function renderMissions() {
  const minutes = data.weeklyMinutes;
  const missions = [
    { title: "Estudiá 2 horas esta semana", goal: 120, current: minutes, unit: "min" },
    { title: "Estudiá 6 horas (Ascenso a Bronce)", goal: 360, current: minutes, unit: "min" },
    { title: "Estudiá 13 horas (Ascenso a Plata)", goal: 780, current: minutes, unit: "min" },
    { title: "Creá o importá 5 Flashcards desde PDF", goal: 5, current: data.cards.length, unit: "cards" }
  ];
  const container = $("missions");
  container.innerHTML = "";
  let completed = 0;
  missions.forEach(m => {
    const done = m.current >= m.goal;
    if (done) completed++;
    const item = document.createElement("div");
    item.className = "mission-item";
    item.innerHTML = `<strong>${done ? "✅ " : "○ "}${m.title}</strong><p class="muted">${Math.min(m.current, m.goal)} / ${m.goal} ${m.unit}</p>`;
    container.appendChild(item);
  });
  $("missionCount").textContent = `${completed}/${missions.length}`;
}

function renderHistory() {
  const history = $("sessionHistory");
  history.innerHTML = "";
  if (!data.sessions.length) {
    history.innerHTML = `<p class="muted">Todavía no tenés sesiones registradas hoy.</p>`;
    return;
  }
  data.sessions.slice(0, 6).forEach(session => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.textContent = `${session.subject} · ${session.minutes} min · +${session.xp} XP`;
    history.appendChild(item);
  });
}

function renderRankingView() {
  const userHours = Number((data.weeklyMinutes / 60).toFixed(1));
  const competitors = [
    { name: "Valentina M. (Medicina)", hours: 19.5, isUser: false },
    { name: "Lucas R. (Ingeniería)", hours: 14.0, isUser: false },
    { name: "Camila T. (Neurociencias)", hours: 9.2, isUser: false },
    { name: "Mateo G. (Bioquímica)", hours: 4.5, isUser: false },
    { name: "Sofía L. (Anatomía)", hours: 1.8, isUser: false },
    { name: "Tú (StudyUp)", hours: userHours, isUser: true }
  ].sort((a, b) => b.hours - a.hours);

  const board = $("weeklyLeaderboard");
  board.innerHTML = "";
  competitors.forEach((comp, index) => {
    const rInfo = getRankInfo(comp.hours).current;
    const row = document.createElement("div");
    row.className = "league-row";
    if (comp.isUser) { row.style.borderColor = "var(--blue)"; row.style.background = "rgba(59, 130, 246, 0.14)"; }
    row.innerHTML = `<div class="subject-card-header"><strong>#${index + 1} ${comp.name}</strong><span class="muted">${comp.hours.toFixed(1)} h · ${rInfo.gem} ${rInfo.name}</span></div>`;
    board.appendChild(row);
  });

  const tiersContainer = $("rankTiersList");
  tiersContainer.innerHTML = "";
  const currentRankName = getRankInfo(userHours).current.name;
  RANK_TIERS.filter((_, idx) => idx % 2 === 0 || idx === RANK_TIERS.length - 1).forEach(tier => {
    const row = document.createElement("div");
    row.className = "league-row";
    if (tier.name === currentRankName) row.style.borderColor = "var(--gold)";
    row.innerHTML = `<strong>${tier.gem} ${tier.name}</strong> <span class="muted" style="float:right;">${tier.minHours}+ h / semana</span>`;
    tiersContainer.appendChild(row);
  });

  const pastContainer = $("pastWeeksHistory");
  pastContainer.innerHTML = "";
  (data.pastWeeks || []).slice(0, 6).forEach(w => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.textContent = `Semana ${w.weekKey} · Rango: ${w.rank} (${w.hours} h) · Bono: +${w.xpBonus} XP`;
    pastContainer.appendChild(item);
  });
}

function render() {
  checkWeeklyRollover();
  renderStats();
  renderSubjects();
  renderMissions();
  renderHistory();
  renderFlashcards();
  renderRankingView();
}

document.querySelectorAll("[data-nav]").forEach(btn => btn.addEventListener("click", () => navigateTo(btn.dataset.nav)));
$("brandHomeBtn").addEventListener("click", () => navigateTo("home"));
document.querySelectorAll("#timerModePills .pill-btn").forEach(btn => btn.addEventListener("click", () => setTimerMode(btn.dataset.mode, $("customMinutesInput").value)));
$("applyCustomMinutesBtn").addEventListener("click", () => setTimerMode("custom", $("customMinutesInput").value));
$("startBtn").addEventListener("click", toggleTimer);
$("resetBtn").addEventListener("click", resetTimer);
$("saveBtn").addEventListener("click", () => saveSession(false));

function openSubjectModal() { $("subjectModal").classList.remove("hidden"); $("subjectName").focus(); }
function closeSubjectModal() { $("subjectModal").classList.add("hidden"); }
$("openAddSubjectHome").addEventListener("click", openSubjectModal);
$("addSubjectBtnStudy").addEventListener("click", openSubjectModal);
$("closeSubjectModalTop").addEventListener("click", closeSubjectModal);
$("closeSubjectModalBtn").addEventListener("click", closeSubjectModal);

$("subjectForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("subjectName").value.trim();
  if (!name) return;
  data.subjects.push({ id: Date.now(), name, color: $("subjectColor").value, minutes: 0 });
  saveData(); $("subjectForm").reset(); closeSubjectModal(); render();
  showToast(`¡Materia "${name}" creada!`);
});

function openCardModal() { populateSubjectSelects(); $("cardModal").classList.remove("hidden"); $("cardFront").focus(); }
function closeCardModal() { $("cardModal").classList.add("hidden"); }
$("openManualCardModalBtn").addEventListener("click", openCardModal);
$("addCardBtnDeck").addEventListener("click", openCardModal);
$("closeCardModalTop").addEventListener("click", closeCardModal);
$("closeCardModalBtn").addEventListener("click", closeCardModal);

$("cardForm").addEventListener("submit", e => {
  e.preventDefault();
  const front = $("cardFront").value.trim(), back = $("cardBack").value.trim();
  const subjectId = Number($("cardSubjectSelect").value) || data.subjects[0]?.id || 1;
  if (!front || !back) return;
  data.cards.push({ id: Date.now(), subjectId, front, back, reviews: 0 });
  data.xp += 5;
  saveData(); $("cardForm").reset(); closeCardModal(); render();
  showToast("¡Flashcard guardada! (+5 XP)");
});

$("pdfFileInput").addEventListener("change", e => { if (e.target.files?.[0]) handlePdfUpload(e.target.files[0]); });
$("loadSamplePdfBtn").addEventListener("click", loadSamplePdfContent);
$("generateDraftsFromTextBtn").addEventListener("click", () => {
  const text = $("pdfExtractedText").value.trim();
  if (text) generateCardsFromText(text);
});
$("closePdfWorkspaceBtn").addEventListener("click", () => $("pdfWorkspace").classList.add("hidden"));
$("saveAllDraftsBtn").addEventListener("click", () => {
  if (!pdfDraftCards.length) return;
  const subjId = Number($("pdfTargetSubjectSelect").value) || data.subjects[0]?.id || 1;
  pdfDraftCards.forEach((d, i) => data.cards.push({ id: Date.now() + i, subjectId: subjId, front: d.front, back: d.back, reviews: 0 }));
  pdfDraftCards = [];
  data.xp += 15;
  saveData(); renderPdfDrafts(); render();
  showToast("¡Flashcards guardadas desde PDF! (+15 XP)");
});

$("deckFilterSubject").addEventListener("change", () => { selectedCardIndex = 0; renderFlashcards(); });
$("flipCardBtn").addEventListener("click", () => $("cardAnswer").classList.toggle("hidden"));
$("flashcardBox").addEventListener("click", () => $("cardAnswer").classList.toggle("hidden"));
$("prevCardBtn").addEventListener("click", () => {
  const cards = getFilteredCards();
  if (cards.length) { selectedCardIndex = (selectedCardIndex - 1 + cards.length) % cards.length; renderFlashcards(); }
});
$("nextCardBtn").addEventListener("click", () => {
  const cards = getFilteredCards();
  if (cards.length) { selectedCardIndex = (selectedCardIndex + 1) % cards.length; renderFlashcards(); }
});
document.querySelectorAll(".srs-btn").forEach(btn => btn.addEventListener("click", () => rateCurrentCard(btn.dataset.rating)));
$("deleteCurrentCardBtn").addEventListener("click", () => {
  const cards = getFilteredCards();
  if (!cards.length) return;
  const targetId = cards[selectedCardIndex].id;
  data.cards = data.cards.filter(c => c.id !== targetId);
  selectedCardIndex = 0;
  saveData(); render();
  showToast("Flashcard eliminada.");
});

$("simulateWeekRolloverBtn").addEventListener("click", () => {
  const nextWeekLabel = `${data.currentWeekKey}-cerrada`;
  archiveCurrentWeekAndReset(getCurrentWeekKey());
  data.pastWeeks[0].weekKey = nextWeekLabel;
  saveData(); render();
});

$("soundToggleBtn").addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  $("soundToggleBtn").textContent = soundEnabled ? "🔔" : "🔕";
});

try { if (localStorage.getItem("studyupTheme") === "light") document.body.classList.add("light-mode"); } catch (e) {}
$("themeBtn").addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light-mode");
  try { localStorage.setItem("studyupTheme", isLight ? "light" : "dark"); } catch (e) {}
});

render();
updateTimerDisplay();
