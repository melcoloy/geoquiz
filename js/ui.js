// Interface : affichage des écrans, gestion des clics, du clavier et du chrono.

const $ = (sel) => document.querySelector(sel);
const flagUrl = (code, w = 320) => `https://flagcdn.com/w${w}/${code}.png`;

const AUTO_NEXT_OK = 650;     // ms avant la question suivante après une bonne réponse
const AUTO_NEXT_TIMED = 1300; // ms après une erreur en contre-la-montre

let quiz = null;
let answered = false;
let autoNextTimer = null;
let clockTimer = null;
let endTime = 0;
let mapSvg = null;

/* ---------- Utilitaires ---------- */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(`#screen-${id}`).classList.add("active");
  window.scrollTo(0, 0);
}

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of [].concat(children)) node.append(child);
  return node;
}

function flagImg(code, className, w = 320) {
  return el("img", {
    className,
    src: flagUrl(code, w),
    srcset: `${flagUrl(code, w * 2)} 2x`,
    alt: "Drapeau",
  });
}

function stopTimers() {
  clearTimeout(autoNextTimer);
  clearInterval(clockTimer);
  autoNextTimer = clockTimer = null;
}

/* ---------- Menu ---------- */
function renderMenu() {
  stopTimers();

  // Défi du jour
  const daily = Quiz.dailyResult();
  const btnDaily = $("#btn-daily");
  $("#daily-status").textContent = daily ? `Fait aujourd'hui : ${daily.correct}/${daily.total} ${daily.grid}` : "";
  btnDaily.textContent = daily ? "Reviens demain 🌙" : "Lancer le défi";
  btnDaily.disabled = !!daily;

  // Révision
  const n = Review.list().length;
  $("#review-status").textContent = n
    ? `${n} pays raté${n > 1 ? "s" : ""} à revoir. Ils disparaissent de la liste quand tu les trouves.`
    : "Aucune erreur à revoir pour l'instant 👌";
  $("#btn-review").disabled = n === 0;
  $("#btn-review").textContent = n ? `Réviser mes erreurs (${n})` : "Réviser mes erreurs";

  // Meilleurs scores
  const list = $("#best-scores");
  list.innerHTML = "";
  const best = Quiz.bestScores().slice(0, 5);
  if (best.length === 0) {
    list.append(el("li", { className: "muted", textContent: "Aucun score pour l'instant." }));
  } else {
    for (const b of best) {
      list.append(el("li", {}, [
        el("span", { textContent: b.label }),
        el("strong", { textContent: `${b.score} pts (${b.correct}/${b.total})` }),
      ]));
    }
  }
  showScreen("menu");
}

function readSettings() {
  return {
    mode: document.querySelector('input[name="mode"]:checked').value,
    count: document.querySelector('input[name="count"]:checked').value,
    continent: $("#continent").value,
    timed: $("#timed").checked,
  };
}

// Le nombre de questions n'a pas de sens en contre-la-montre
function syncCountOptions() {
  document.querySelectorAll('input[name="count"]').forEach((i) => (i.disabled = $("#timed").checked));
}

function startQuiz(options) {
  stopTimers();
  quiz = new Quiz(options);
  if (quiz.total === 0) {
    alert("Aucun pays disponible pour cette sélection.");
    return;
  }
  $("#q-hint").textContent =
    quiz.mode === "type" ? "Tape le nom du pays puis Entrée. Les petites fautes sont tolérées."
    : quiz.mode === "map" ? "Clique sur le pays. Les petits pays sont signalés par un rond."
    : "Raccourcis : touches 1–4 pour répondre, Entrée pour continuer.";

  if (quiz.timed) {
    endTime = Date.now() + TIMED_DURATION * 1000;
    clockTimer = setInterval(tick, 200);
  }
  showScreen("quiz");
  renderQuestion();
  tick();
}

/* ---------- Chrono ---------- */
function tick() {
  if (!quiz.timed) return;
  const left = Math.max(0, endTime - Date.now());
  $("#q-progress").textContent = `⏱️ ${Math.ceil(left / 1000)} s`;
  $("#q-progress").classList.toggle("urgent", left < 10000);
  $("#progress-fill").style.width = `${(left / (TIMED_DURATION * 1000)) * 100}%`;
  if (left === 0) {
    quiz.timeUp = true;
    renderResult();
  }
}

/* ---------- Question ---------- */
function renderQuestion() {
  answered = false;
  const { answer } = quiz.current;

  if (!quiz.timed) {
    $("#q-progress").textContent = `${quiz.index + 1} / ${quiz.total}`;
    $("#progress-fill").style.width = `${(quiz.index / quiz.total) * 100}%`;
  }
  $("#q-score").textContent = `${quiz.score} pts`;
  $("#q-streak").textContent = `🔥 ${quiz.streak}`;
  $("#btn-next").hidden = true;
  $("#q-feedback").textContent = "";
  $("#q-feedback").className = "feedback";

  // Énoncé
  const prompt = $("#q-prompt");
  prompt.innerHTML = "";
  if (quiz.mode === "flag" || quiz.mode === "type") {
    prompt.append(flagImg(answer.code, "flag-big"));
    prompt.append(el("p", { className: "question", textContent: "Quel est ce pays ?" }));
  } else if (quiz.mode === "reverse") {
    prompt.append(el("p", { className: "country", textContent: answer.name }));
    prompt.append(el("p", { className: "question", textContent: "Quel est son drapeau ?" }));
  } else if (quiz.mode === "capital") {
    prompt.append(flagImg(answer.code, "flag-small", 80));
    prompt.append(el("p", { className: "country", textContent: answer.name }));
    prompt.append(el("p", { className: "question", textContent: "Quelle est sa capitale ?" }));
  } else {
    prompt.append(el("p", { className: "country", textContent: answer.name }));
    prompt.append(el("p", { className: "question", textContent: "Où se trouve ce pays ?" }));
  }

  // Zone de réponse
  const box = $("#q-answer");
  box.innerHTML = "";
  box.className = "";
  if (quiz.hasChoices) renderChoices(box);
  else if (quiz.mode === "type") renderTyping(box);
  else renderMap(box);
}

function renderChoices(box) {
  box.className = "choices";
  quiz.current.choices.forEach((choice, i) => {
    const btn = el("button", { className: "choice" });
    btn.append(el("span", { className: "key", textContent: i + 1 }));
    if (quiz.mode === "reverse") {
      const img = flagImg(choice.code, "", 160);
      img.alt = `Option ${i + 1}`;
      btn.append(img);
    } else {
      btn.append(quiz.mode === "capital" ? choice.capital : choice.name);
    }
    btn.addEventListener("click", () => onAnswer(choice));
    box.append(btn);
  });
}

function renderTyping(box) {
  const input = el("input", {
    type: "text", id: "type-input", placeholder: "Nom du pays…",
    autocomplete: "off", spellcheck: false,
  });
  const form = el("form", { className: "type-form" }, [
    input,
    el("button", { type: "submit", className: "btn primary", textContent: "Valider" }),
    el("button", { type: "button", className: "btn ghost", textContent: "Je passe", onclick: () => onAnswer(null) }),
  ]);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (input.value.trim()) onAnswer(input.value);
  });
  box.append(form);
  input.focus();
}

/* ---------- Carte ---------- */
function buildMap() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "world-map");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Carte du monde");

  const others = document.createElementNS(NS, "path");
  others.setAttribute("d", MAP_OTHERS);
  others.setAttribute("class", "other");
  svg.append(others);

  for (const [code, d] of Object.entries(MAP_PATHS)) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    p.dataset.code = code;
    svg.append(p);
  }
  for (const [code, [x, y]] of Object.entries(MAP_MARKERS)) {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", x);
    c.setAttribute("cy", y);
    c.dataset.code = code;
    c.classList.add("marker");
    svg.append(c);
  }

  svg.addEventListener("click", (e) => {
    const target = e.target.closest("[data-code]");
    if (!target || answered) return;
    onAnswer(COUNTRIES.find((c) => c.code === target.dataset.code) || null);
  });
  return svg;
}

function renderMap(box) {
  if (!mapSvg) mapSvg = buildMap();
  const { answer } = quiz.current;
  const view = MAP_VIEWS[quiz.continent === "all" ? answer.continent : quiz.continent];
  mapSvg.setAttribute("viewBox", view.join(" "));
  mapSvg.style.setProperty("--marker-r", (view[2] / 160).toFixed(2));
  mapSvg.style.setProperty("--stroke", (view[2] / 1400).toFixed(3));
  mapSvg.querySelectorAll(".correct, .wrong").forEach((n) => n.classList.remove("correct", "wrong"));
  mapSvg.classList.remove("locked");
  box.className = "map-box";
  box.append(mapSvg);
}

function markMap(answer, given) {
  mapSvg.classList.add("locked");
  mapSvg.querySelectorAll(`[data-code="${answer.code}"]`).forEach((n) => n.classList.add("correct"));
  if (given && given !== answer) {
    mapSvg.querySelectorAll(`[data-code="${given.code}"]`).forEach((n) => n.classList.add("wrong"));
  }
}

/* ---------- Réponse ---------- */
function onAnswer(given) {
  if (answered || quiz.finished) return;
  answered = true;

  const { answer, choices } = quiz.current;
  const ok = quiz.answer(given);

  // Retour visuel selon le mode
  if (quiz.hasChoices) {
    [...document.querySelectorAll(".choice")].forEach((b, j) => {
      b.disabled = true;
      if (choices[j] === answer) b.classList.add("correct");
      else if (choices[j] === given) b.classList.add("wrong");
    });
  } else if (quiz.mode === "type") {
    const input = $("#type-input");
    input.disabled = true;
    input.classList.add(ok ? "correct" : "wrong");
    document.querySelectorAll(".type-form button").forEach((b) => (b.disabled = true));
  } else {
    markMap(answer, given);
  }

  const fb = $("#q-feedback");
  if (ok) {
    fb.textContent = quiz.mode === "type" && normalize(given) !== normalize(answer.name) ? `✅ ${answer.name}` : "";
    fb.className = "feedback good";
  } else {
    const extra = quiz.mode === "capital" ? answer.capital : answer.name;
    fb.textContent = `❌ C'était : ${extra}`;
    fb.className = "feedback bad";
  }

  $("#q-score").textContent = `${quiz.score} pts`;
  $("#q-streak").textContent = `🔥 ${quiz.streak}`;
  if (!quiz.timed) $("#progress-fill").style.width = `${((quiz.index + 1) / quiz.total) * 100}%`;

  // Bonne réponse (ou contre-la-montre) → on enchaîne tout seul
  if (ok || quiz.timed) {
    autoNextTimer = setTimeout(onNext, ok ? AUTO_NEXT_OK : AUTO_NEXT_TIMED);
  } else {
    const next = $("#btn-next");
    next.textContent = quiz.index + 1 < quiz.total ? "Suivant →" : "Voir le résultat";
    next.hidden = false;
    next.focus();
  }
}

function onNext() {
  if (!answered || quiz.timeUp) return;
  clearTimeout(autoNextTimer);
  quiz.next();
  if (quiz.finished) renderResult();
  else renderQuestion();
}

/* ---------- Résultat ---------- */
function givenLabel(given) {
  if (given === null) return "(pas de réponse)";
  if (typeof given === "string") return given;
  return quiz.mode === "capital" ? given.capital : given.name;
}

function renderResult() {
  stopTimers();
  const correct = quiz.correctCount;
  const answeredN = quiz.answeredCount;
  const ratio = answeredN ? correct / answeredN : 0;
  const record = quiz.saveBest();
  quiz.saveDaily();

  if (quiz.timed) {
    $("#r-title").textContent = correct >= 25 ? "Fusée ! 🚀" : correct >= 15 ? "Rapide ! ⚡" : "Temps écoulé ⏱️";
    $("#r-summary").textContent = `${correct} bonne${correct > 1 ? "s" : ""} réponse${correct > 1 ? "s" : ""}`;
  } else {
    $("#r-title").textContent =
      ratio === 1 ? "Parfait ! 🏆" : ratio >= 0.8 ? "Excellent ! 🎉" : ratio >= 0.5 ? "Pas mal ! 👍" : "À retravailler 📚";
    $("#r-summary").textContent = `${correct} / ${answeredN}`;
  }
  $("#r-details").textContent =
    `${quiz.score} pts · meilleure série : ${quiz.bestStreak}` +
    (quiz.timed ? ` · ${answeredN} question${answeredN > 1 ? "s" : ""}` : "") +
    (record ? " · 🆕 Nouveau record !" : "");
  $("#r-grid").textContent = quiz.emojiGrid;
  $("#btn-share").hidden = !quiz.daily;
  $("#btn-replay").textContent = quiz.daily ? "Partie libre" : quiz.review ? "Réviser encore" : "Rejouer";
  $("#btn-replay").disabled = quiz.review && Review.list().length === 0;

  // Erreurs
  const mistakes = quiz.results.filter((r) => !r.ok);
  const list = $("#r-mistakes");
  list.innerHTML = "";
  $("#r-mistakes-card").hidden = mistakes.length === 0;
  for (const { question, given } of mistakes) {
    const a = question.answer;
    list.append(el("li", {}, [
      flagImg(a.code, "", 80),
      el("div", {}, [
        el("strong", { textContent: a.name }),
        a.capital ? ` — ${a.capital}` : "",
        el("div", { className: "wrong-answer", textContent: `Ta réponse : ${givenLabel(given)}` }),
      ]),
    ]));
  }
  showScreen("result");
}

async function share() {
  const text = `🌍 GéoQuiz — Défi du ${todayKey()}\n${quiz.correctCount}/${quiz.total} ${quiz.emojiGrid}\n${location.href}`;
  const btn = $("#btn-share");
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "✅ Copié !";
  } catch {
    prompt("Copie ce texte :", text);
  }
  setTimeout(() => (btn.textContent = "📋 Copier le résultat"), 2000);
}

/* ---------- Événements ---------- */
$("#btn-start").addEventListener("click", () => startQuiz(readSettings()));
$("#btn-daily").addEventListener("click", () => startQuiz({ daily: true }));
$("#btn-review").addEventListener("click", () => startQuiz({ review: true }));
$("#btn-next").addEventListener("click", onNext);
$("#btn-quit").addEventListener("click", renderMenu);
$("#btn-menu").addEventListener("click", renderMenu);
$("#btn-share").addEventListener("click", share);
$("#timed").addEventListener("change", syncCountOptions);
$("#btn-replay").addEventListener("click", () => {
  if (quiz.daily) renderMenu();
  else if (quiz.review) startQuiz({ review: true });
  else startQuiz({ mode: quiz.mode, continent: quiz.continent, count: quiz.count, timed: quiz.timed });
});

document.addEventListener("keydown", (e) => {
  if (!$("#screen-quiz").classList.contains("active")) return;
  if (!answered && quiz.hasChoices && e.key >= "1" && e.key <= "4") {
    onAnswer(quiz.current.choices[Number(e.key) - 1]);
  } else if (answered && e.key === "Enter") {
    e.preventDefault();
    onNext();
  }
});

syncCountOptions();
renderMenu();