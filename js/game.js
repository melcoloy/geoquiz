// Logique du jeu : génération des questions, score, sauvegarde.
// Aucune manipulation du DOM ici (voir ui.js).

/* ---------- Stockage local (scores, défi du jour) ---------- */
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

/* ---------- Quiz ---------- */
const MODE_LABELS = {
  flag: "Drapeau → Pays",
  reverse: "Pays → Drapeau",
  capital: "Pays → Capitale",
};

class Quiz {
  constructor({ mode = "flag", continent = "all", count = "10", daily = false } = {}) {
    this.mode = daily ? "flag" : mode;
    this.continent = daily ? "all" : continent;
    this.count = daily ? "10" : String(count);
    this.daily = daily;
    this.rng = daily ? mulberry32(hashString("geoquiz-" + todayKey())) : Math.random;

    const pool = this.eligible(COUNTRIES).filter(
      (c) => this.continent === "all" || c.continent === this.continent
    );
    const n = this.count === "all" ? pool.length : Math.min(Number(this.count), pool.length);

    this.questions = shuffle(pool, this.rng)
      .slice(0, n)
      .map((answer) => ({ answer, choices: this.makeChoices(answer) }));

    this.index = 0;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.results = []; // { question, given, ok }
  }

  // En mode capitale, on ignore les pays sans capitale renseignée.
  eligible(list) {
    return this.mode === "capital" ? list.filter((c) => c.capital) : list;
  }

  // 1 bonne réponse + 3 leurres, de préférence du même continent (plus difficile).
  makeChoices(answer) {
    const others = this.eligible(COUNTRIES).filter((c) => c !== answer);
    const same = others.filter((c) => c.continent === answer.continent);
    const rest = others.filter((c) => c.continent !== answer.continent);

    const picks = shuffle(same, this.rng).slice(0, 3);
    if (picks.length < 3) picks.push(...shuffle(rest, this.rng).slice(0, 3 - picks.length));
    return shuffle([answer, ...picks], this.rng);
  }

  get total() { return this.questions.length; }
  get current() { return this.questions[this.index]; }
  get finished() { return this.index >= this.total; }
  get correctCount() { return this.results.filter((r) => r.ok).length; }

  // Renvoie true si la réponse est correcte.
  answer(choice) {
    const q = this.current;
    const ok = choice === q.answer;
    if (ok) {
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      // 100 pts + bonus de série (max +100)
      this.score += 100 + Math.min(this.streak - 1, 5) * 20;
    } else {
      this.streak = 0;
    }
    this.results.push({ question: q, given: choice, ok });
    return ok;
  }

  next() { this.index++; }

  get configKey() {
    return this.daily ? "daily" : `${this.mode}|${this.continent}|${this.count}`;
  }

  get configLabel() {
    if (this.daily) return "Défi du jour";
    const region = this.continent === "all" ? "Monde" : this.continent;
    const n = this.count === "all" ? "tous" : this.count;
    return `${MODE_LABELS[this.mode]} · ${region} · ${n}`;
  }

  get emojiGrid() {
    return this.results.map((r) => (r.ok ? "🟩" : "🟥")).join("");
  }

  /* ----- Sauvegarde ----- */

  // Enregistre le meilleur score pour cette configuration. Renvoie true si record.
  saveBest() {
    if (this.daily) return false;
    const best = Storage.get("geoquiz.best", {});
    const prev = best[this.configKey];
    if (!prev || this.score > prev.score) {
      best[this.configKey] = { score: this.score, label: this.configLabel, correct: this.correctCount, total: this.total };
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
