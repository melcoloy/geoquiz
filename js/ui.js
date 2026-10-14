// Interface : affichage des écrans, gestion des clics et du clavier.

const $ = (sel) => document.querySelector(sel);
const flagUrl = (code, w = 320) => `https://flagcdn.com/w${w}/${code}.png`;

let quiz = null;
let answered = false;

/* ---------- Navigation entre écrans ---------- */
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
    loading: "eager",
  });
}

/* ---------- Menu ---------- */
function renderMenu() {
  // Défi du jour
  const daily = Quiz.dailyResult();
  const btnDaily = $("#btn-daily");
  if (daily) {
    $("#daily-status").textContent = `Fait aujourd'hui : ${daily.correct}/${daily.total} ${daily.grid}`;
    btnDaily.textContent = "Reviens demain 🌙";
    btnDaily.disabled = true;
  } else {
    $("#daily-status").textContent = "";
    btnDaily.textContent = "Lancer le défi";
    btnDaily.disabled = false;
  }

  // Meilleurs scores
  const list = $("#best-scores");
  list.innerHTML = "";
  const best = Quiz.bestScores().slice(0, 5);
  if (best.length === 0) {
    list.append(el("li", { className: "muted", textContent: "Aucun score pour l'instant." }));
  } else {
    for (const b of best) {
      list.append(
        el("li", {}, [
          el("span", { textContent: b.label }),
          el("strong", { textContent: `${b.score} pts (${b.correct}/${b.total})` }),
        ])
      );
    }
  }
  showScreen("menu");
}

function readSettings() {
  return {
    mode: document.querySelector('input[name="mode"]:checked').value,
    count: document.querySelector('input[name="count"]:checked').value,
    continent: $("#continent").value,
  };
}

function startQuiz(options) {
  quiz = new Quiz(options);
  if (quiz.total === 0) {
    alert("Aucun pays disponible pour cette sélection.");
    return;
  }
  showScreen("quiz");
  renderQuestion();
}

/* ---------- Question ---------- */
function renderQuestion() {
  answered = false;
  const { answer, choices } = quiz.current;

  $("#q-progress").textContent = `${quiz.index + 1} / ${quiz.total}`;
  $("#q-score").textContent = `${quiz.score} pts`;
  $("#q-streak").textContent = `🔥 ${quiz.streak}`;
  $("#progress-fill").style.width = `${(quiz.index / quiz.total) * 100}%`;
  $("#btn-next").hidden = true;

  // Énoncé
  const prompt = $("#q-prompt");
  prompt.innerHTML = "";
  if (quiz.mode === "flag") {
    prompt.append(flagImg(answer.code, "flag-big"));
    prompt.append(el("p", { className: "question", textContent: "Quel est ce pays ?" }));
  } else if (quiz.mode === "reverse") {
    prompt.append(el("p", { className: "country", textContent: answer.name }));
    prompt.append(el("p", { className: "question", textContent: "Quel est son drapeau ?" }));
  } else {
    prompt.append(flagImg(answer.code, "flag-small", 80));
    prompt.append(el("p", { className: "country", textContent: answer.name }));
    prompt.append(el("p", { className: "question", textContent: "Quelle est sa capitale ?" }));
  }

  // Choix
  const box = $("#q-choices");
  box.innerHTML = "";
  choices.forEach((choice, i) => {
    const btn = el("button", { className: "choice" });
    btn.append(el("span", { className: "key", textContent: i + 1 }));
    if (quiz.mode === "reverse") {
      const img = flagImg(choice.code, "", 160);
      img.alt = `Option ${i + 1}`;
      btn.append(img);
    } else {
      btn.append(quiz.mode === "capital" ? choice.capital : choice.name);
    }
    btn.addEventListener("click", () => onAnswer(i));
    box.append(btn);
  });
}

function onAnswer(i) {
  if (answered) return;
  answered = true;

  const { answer, choices } = quiz.current;
  const ok = quiz.answer(choices[i]);
  const buttons = [...document.querySelectorAll(".choice")];

  buttons.forEach((b, j) => {
    b.disabled = true;
    if (choices[j] === answer) b.classList.add("correct");
  });
  if (!ok) buttons[i].classList.add("wrong");

  $("#q-score").textContent = `${quiz.score} pts`;
  $("#q-streak").textContent = `🔥 ${quiz.streak}`;
  $("#progress-fill").style.width = `${((quiz.index + 1) / quiz.total) * 100}%`;

  const next = $("#btn-next");
  next.textContent = quiz.index + 1 < quiz.total ? "Suivant →" : "Voir le résultat";
  next.hidden = false;
  next.focus();
}

function onNext() {
  if (!answered) return;
  quiz.next();
  if (quiz.finished) renderResult();
  else renderQuestion();
}

/* ---------- Résultat ---------- */
function renderResult() {
  const correct = quiz.correctCount;
  const ratio = correct / quiz.total;
  const record = quiz.saveBest();
  quiz.saveDaily();

  $("#r-title").textContent =
    ratio === 1 ? "Parfait ! 🏆" : ratio >= 0.8 ? "Excellent ! 🎉" : ratio >= 0.5 ? "Pas mal ! 👍" : "À retravailler 📚";
  $("#r-summary").textContent = `${correct} / ${quiz.total}`;
  $("#r-details").textContent =
    `${quiz.score} pts · meilleure série : ${quiz.bestStreak}` + (record ? " · 🆕 Nouveau record !" : "");
  $("#r-grid").textContent = quiz.emojiGrid;
  $("#btn-share").hidden = !quiz.daily;
  $("#btn-replay").textContent = quiz.daily ? "Partie libre" : "Rejouer";

  // Erreurs
  const mistakes = quiz.results.filter((r) => !r.ok);
  const list = $("#r-mistakes");
  list.innerHTML = "";
  $("#r-mistakes-card").hidden = mistakes.length === 0;
  for (const { question, given } of mistakes) {
    const a = question.answer;
    const givenText = quiz.mode === "capital" ? given.capital : given.name;
    list.append(
      el("li", {}, [
        flagImg(a.code, "", 80),
        el("div", {}, [
          el("strong", { textContent: a.name }),
          a.capital ? ` — ${a.capital}` : "",
          el("div", { className: "wrong-answer", textContent: `Ta réponse : ${givenText}` }),
        ]),
      ])
    );
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
$("#btn-next").addEventListener("click", onNext);
$("#btn-quit").addEventListener("click", renderMenu);
$("#btn-menu").addEventListener("click", renderMenu);
$("#btn-share").addEventListener("click", share);
$("#btn-replay").addEventListener("click", () => {
  if (quiz.daily) {
    renderMenu();
  } else {
    startQuiz({ mode: quiz.mode, continent: quiz.continent, count: quiz.count });
  }
});

document.addEventListener("keydown", (e) => {
  if (!$("#screen-quiz").classList.contains("active")) return;
  if (!answered && e.key >= "1" && e.key <= "4") {
    onAnswer(Number(e.key) - 1);
  } else if (answered && e.key === "Enter") {
    e.preventDefault();
    onNext();
  }
});

renderMenu();
