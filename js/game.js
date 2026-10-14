// Logique du jeu : génération des questions, vérification, score, sauvegarde.
// Aucune manipulation du DOM ici (voir ui.js).

/* ---------- Stockage local ---------- */
const Storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* stockage indisponible : on ignore */
    }
  },
};

/* ---------- Pays à réviser (erreurs passées) ---------- */
const Review = {
  list() { return Storage.get("geoquiz.review", []); },
  add(code) {
    const l = Review.list();
    if (!l.includes(code)) Storage.set("geoquiz.review", [...l, code]);
  },
  remove(code) { Storage.set("geoquiz.review", Review.list().filter((c) => c !== code)); },
};

/* ---------- Aléatoire (avec graine pour le défi du jour) ---------- */
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle(array, rng = Math.random) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function todayKey() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/* ---------- Saisie libre : comparaison tolérante ---------- */

// Autres noms acceptés en saisie libre
const ALIASES = {
  ae: ["EAU", "Emirats"], by: ["Bélarus"], cd: ["République démocratique du Congo", "RDC", "Congo-Kinshasa"],
  cg: ["République du Congo", "Congo-Brazzaville"], cv: ["Cabo Verde"], cz: ["République tchèque"],
  gb: ["UK", "Grande-Bretagne"], kn: ["Saint-Kitts-et-Nevis"], md: ["Moldova"], mk: ["Macédoine"],
  mm: ["Myanmar"], nl: ["Hollande"], sv: ["El Salvador"], sz: ["Swaziland"], tl: ["Timor-Leste"],
  us: ["USA", "États-Unis d'Amérique", "Amérique"], va: ["Saint-Siège"], cf: ["République centrafricaine"],
  kr: ["Corée"], ba: ["Bosnie"], mh: ["Marshall"], sb: ["Salomon"], tt: ["Trinidad"],
};

function normalize(text) {
  return text
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/^(le |la |les |l')/, "")
    .replace(/[^a-z]/g, "");
}

function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function namesOf(country) {
  return [country.name, ...(ALIASES[country.code] || [])].map(normalize);
}

function distanceTo(input, country) {
  return Math.min(...namesOf(country).map((n) => levenshtein(input, n)));
}

// Vrai si le texte tapé désigne bien `answer` (fautes de frappe tolérées).
function matchesTyped(text, answer) {
  const input = normalize(text || "");
  if (!input) return false;
  const d = distanceTo(input, answer);
  if (d === 0) return true;
  const tolerance = input.length <= 3 ? 0 : input.length <= 6 ? 1 : input.length <= 10 ? 2 : 3;
  if (d > tolerance) return false;
  // Refusé si un autre pays correspond mieux (ex. « Irak » quand la réponse est Iran)
  return COUNTRIES.every((c) => c === answer || distanceTo(input, c) > d);
}

/* ---------- Quiz ---------- */
const MODE_LABELS = {
  flag: "Drapeau → Pays",
  reverse: "Pays → Drapeau",
  capital: "Pays → Capitale",
  type: "Drapeau → Saisie",
  map: "Pays → Carte",
};
const CHOICE_MODES = ["flag", "reverse", "capital"];
const TIMED_DURATION = 60; // secondes

class Quiz {
  constructor({ mode = "flag", continent = "all", count = "10", daily = false, timed = false, review = false } = {}) {
    this.daily = daily;
    this.review = review;
    this.mode = daily || review ? "flag" : mode;
    this.continent = daily || review ? "all" : continent;
    this.timed = !daily && !review && timed;
    this.count = daily ? "10" : review || this.timed ? "all" : String(count);
    this.rng = daily ? mulberry32(hashString("geoquiz-" + todayKey())) : Math.random;
    this.timeUp = false;

    let pool = this.eligible(COUNTRIES).filter(
      (c) => this.continent === "all" || c.continent === this.continent
    );
    if (review) {
      const codes = Review.list();
      pool = pool.filter((c) => codes.includes(c.code));
    }
    const n = this.count === "all" ? pool.length : Math.min(Number(this.count), pool.length);

    this.questions = shuffle(pool, this.rng)
      .slice(0, n)
      .map((answer) => ({ answer, choices: this.hasChoices ? this.makeChoices(answer) : null }));

    this.index = 0;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.results = []; // { question, given, ok }
  }

  get hasChoices() { return CHOICE_MODES.includes(this.mode); }

  // Pays utilisables selon le mode
  eligible(list) {
    if (this.mode === "capital") return list.filter((c) => c.capital);
    if (this.mode === "map") return list.filter((c) => typeof MAP_PATHS !== "undefined" && MAP_PATHS[c.code]);
    return list;
  }

  // 1 bonne réponse + 3 leurres, de préférence du même continent (plus difficile).
  makeChoices(answer) {
    const others = this.eligible(COUNTRIES).filter((c) => c !== answer);
    const same = others.filter((c) => c.continent === answer.continent);
    const rest = others.filter((c) => c.continent !== answer.continent);

    const picks = shuffle(same, this.rng).slice(0, 3);
    if (picks.length < 3) picks.push(...shuffle(rest, this.rng).slice(0, 3-picks.length));
    return shuffle([answer, ...picks], this.rng);
  }

  get total() { return this.questions.length; }
  get answeredCount() { return this.results.length; }
  get current() { return this.questions[this.index]; }
  get finished() { return this.timeUp || this.index >= this.total; }
  get correctCount() { return this.results.filter((r) => r.ok).length; }

  // `given` : un pays (QCM, carte), un texte (saisie libre) ou null (passé).
  // Renvoie true si la réponse est correcte.
  answer(given) {
    const q = this.current;
    const ok = given !== null && (this.mode === "type" ? matchesTyped(given, q.answer) : given === q.answer);
    if (ok) {
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.score += 100 + Math.min(this.streak - 1, 5) * 20; // bonus de série (max +100)
      Review.remove(q.answer.code);
    } else {
      this.streak = 0;
      Review.add(q.answer.code);
    }
    this.results.push({ question: q, given, ok });
    return ok;
  }

  next() { this.index++; }

  get configKey() {
    if (this.daily) return "daily";
    return `${this.mode}|${this.continent}|${this.timed ? "60s" : this.count}`;
  }

  get configLabel() {
    if (this.daily) return "Défi du jour";
    if (this.review) return "Révision";
    const region = this.continent === "all" ? "Monde" : this.continent;
    const n = this.timed ? "⏱️ 60 s" : this.count === "all" ? "tous" : this.count;
    return `${MODE_LABELS[this.mode]} · ${region} · ${n}`;
  }

  get emojiGrid() {
    return this.results.map((r) => (r.ok ? "🟩" : "🟥")).join("");
  }

  /* ----- Sauvegarde ----- */

  // Enregistre le meilleur score pour cette configuration. Renvoie true si record.
  saveBest() {
    if (this.daily || this.review || this.answeredCount === 0) return false;
    const best = Storage.get("geoquiz.best", {});
    const prev = best[this.configKey];
    if (!prev || this.score > prev.score) {
      best[this.configKey] = {
        score: this.score, label: this.configLabel,
        correct: this.correctCount, total: this.answeredCount,
      };
      Storage.set("geoquiz.best", best);
      return true;
    }
    return false;
  }

  saveDaily() {
    if (!this.daily || Quiz.dailyResult()) return;
    Storage.set("geoquiz.daily", {
      date: todayKey(),
      correct: this.correctCount,
      total: this.total,
      score: this.score,
      grid: this.emojiGrid,
    });
  }

  static dailyResult() {
    const d = Storage.get("geoquiz.daily", null);
    return d && d.date === todayKey() ? d : null;
  }

  static bestScores() {
    return Object.values(Storage.get("geoquiz.best", {})).sort((a, b) => b.score - a.score);
  }
}