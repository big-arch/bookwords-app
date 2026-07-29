/* BIM Academy — офлайн-приложение для изучения BIM, Revit, Navisworks, AutoCAD и Civil 3D */
(function () {
  "use strict";

  const APP_VERSION = "2026-07-29-v1";
  const STORE_KEY = "bim-academy-state-v1";
  const CONTENT = window.BIM_CONTENT || { courses: [], glossary: [], videos: [] };
  const FIGURES = window.BIM_FIGURES || {};

  const view = document.getElementById("view");
  const topTitle = document.getElementById("topTitle");
  const topSubtitle = document.getElementById("topSubtitle");
  const backBtn = document.getElementById("backBtn");
  const themeBtn = document.getElementById("themeBtn");
  const toastEl = document.getElementById("toast");

  /* ================= вспомогательные функции ================= */

  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/\s+/g, " ")
      .trim();

  const hardNorm = (s) => norm(s).replace(/[^a-zа-я0-9]/g, "");

  const todayKey = (d) => {
    const x = d || new Date();
    return (
      x.getFullYear() +
      "-" +
      String(x.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(x.getDate()).padStart(2, "0")
    );
  };

  const shiftDay = (key, delta) => {
    const p = key.split("-").map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + delta);
    return todayKey(d);
  };

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  };

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  const ICONS = {
    cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    revit: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>',
    clash: '<circle cx="9.5" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>',
    cad: '<path d="M4 17L17 4l3 3L7 20H4z"/><path d="M14 7l3 3"/>',
    terrain: '<path d="M3 19l6-9 4 5 2-3 6 7z"/><path d="M3 19h18"/>',
    play: '<path d="M8 5l12 7-12 7z"/>',
    arrow: '<path d="M9 5l7 7-7 7"/>'
  };

  const RANKS = [
    { min: 0, title: "Стажёр" },
    { min: 60, title: "Чертёжник" },
    { min: 160, title: "Моделлер" },
    { min: 320, title: "BIM-специалист" },
    { min: 560, title: "BIM-координатор" },
    { min: 900, title: "BIM-менеджер" },
    { min: 1400, title: "BIM-эксперт" }
  ];

  const BADGES = [
    { id: "first", em: "🎯", title: "Первый шаг", desc: "пройден первый урок", test: (s) => lessonsDone() >= 1 },
    { id: "ten", em: "📚", title: "Десятка", desc: "10 уроков пройдено", test: () => lessonsDone() >= 10 },
    { id: "course", em: "🏆", title: "Курс закрыт", desc: "все уроки одного курса", test: () => CONTENT.courses.some((c) => courseProgress(c).done === c.lessons.length) },
    { id: "all", em: "👑", title: "Полный охват", desc: "все уроки всех курсов", test: () => CONTENT.courses.every((c) => courseProgress(c).done === c.lessons.length) },
    { id: "q100", em: "🧠", title: "Сто вопросов", desc: "100 ответов в тестах", test: (s) => s.answers.total >= 100 },
    { id: "exam", em: "🎓", title: "Экзамен сдан", desc: "экзамен на 90% и выше", test: (s) => !!s.flags.exam90 },
    { id: "perfect", em: "💎", title: "Без ошибок", desc: "тест из 10+ вопросов на 100%", test: (s) => !!s.flags.perfect },
    { id: "streak", em: "🔥", title: "Неделя подряд", desc: "7 дней с выполненной целью", test: (s) => s.streak.best >= 7 },
    { id: "terms", em: "📖", title: "Знаток терминов", desc: "открыто 25 терминов", test: (s) => s.terms.length >= 25 },
    { id: "fix", em: "🧹", title: "Работа над ошибками", desc: "пройден тест по ошибкам", test: (s) => !!s.flags.mistakes }
  ];

  const MISTAKE_HOURS = [0, 8, 24, 72, 168];

  /* ================= состояние ================= */

  const defaultState = () => ({
    v: 1,
    lessons: {},
    bookmarks: [],
    answers: { total: 0, correct: 0 },
    byCourse: {},
    mistakes: {},
    history: [],
    days: {},
    streak: { current: 0, best: 0, last: "" },
    settings: { theme: "auto", goal: 10 },
    myVideos: [],
    terms: [],
    flags: {},
    xp: 0,
    lastLesson: ""
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return Object.assign(base, parsed, {
        answers: Object.assign(base.answers, parsed.answers),
        streak: Object.assign(base.streak, parsed.streak),
        settings: Object.assign(base.settings, parsed.settings),
        flags: Object.assign(base.flags, parsed.flags)
      });
    } catch (e) {
      return defaultState();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      /* приватный режим — просто работаем без сохранения */
    }
  }

  /* ================= индексы контента ================= */

  const courseById = {};
  const lessonById = {};
  const lessonCourse = {};
  const allQuestions = [];
  const allLessons = [];

  CONTENT.courses.forEach((course) => {
    courseById[course.id] = course;
    course.lessons.forEach((lesson, li) => {
      lessonById[lesson.id] = lesson;
      lessonCourse[lesson.id] = course.id;
      lesson.index = li;
      allLessons.push(lesson);
      (lesson.questions || []).forEach((q, qi) => {
        q.id = lesson.id + "#" + qi;
        q.courseId = course.id;
        q.lessonId = lesson.id;
        allQuestions.push(q);
      });
    });
  });

  const questionById = {};
  allQuestions.forEach((q) => (questionById[q.id] = q));

  function lessonText(lesson) {
    const parts = [lesson.title, lesson.goal || "", (lesson.tags || []).join(" ")];
    (lesson.blocks || []).forEach((b) => {
      if (b.text) parts.push(b.text);
      if (b.title) parts.push(b.title);
      if (b.items) parts.push(b.items.join(" "));
      if (b.caption) parts.push(b.caption);
      if (b.rows) parts.push(b.rows.map((r) => r.join(" ")).join(" "));
    });
    return parts.join(" ");
  }

  const searchIndex = [];
  allLessons.forEach((lesson) => {
    searchIndex.push({
      kind: "Урок",
      title: lesson.title,
      sub: (courseById[lessonCourse[lesson.id]] || {}).title + " · " + lesson.minutes + " мин",
      href: "#/lesson/" + lesson.id,
      hay: norm(lessonText(lesson)),
      course: lessonCourse[lesson.id]
    });
  });
  CONTENT.glossary.forEach((t) => {
    searchIndex.push({
      kind: "Термин",
      title: t.term + (t.full ? " — " + t.full : ""),
      sub: t.text,
      href: "#/glossary?q=" + encodeURIComponent(t.term),
      hay: norm(t.term + " " + (t.full || "") + " " + t.text),
      course: t.course
    });
  });
  CONTENT.videos.forEach((v) => {
    searchIndex.push({
      kind: "Видео",
      title: v.title,
      sub: v.description,
      href: "#/videos?q=" + encodeURIComponent(v.title),
      hay: norm(v.title + " " + v.description + " " + v.query),
      course: v.course
    });
  });
  allQuestions.forEach((q) => {
    searchIndex.push({
      kind: "Вопрос",
      title: q.q,
      sub: q.explain || "",
      href: "#/lesson/" + q.lessonId,
      hay: norm(q.q + " " + (q.explain || "")),
      course: q.courseId
    });
  });

  /* ================= прогресс ================= */

  function lessonsDone() {
    return Object.keys(state.lessons).filter((k) => state.lessons[k] && state.lessons[k].done).length;
  }

  function courseProgress(course) {
    const done = course.lessons.filter((l) => state.lessons[l.id] && state.lessons[l.id].done).length;
    return { done: done, total: course.lessons.length, pct: Math.round((done / course.lessons.length) * 100) };
  }

  function totalProgress() {
    const total = allLessons.length;
    const done = lessonsDone();
    return { done: done, total: total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function accuracy() {
    if (!state.answers.total) return 0;
    return Math.round((state.answers.correct / state.answers.total) * 100);
  }

  function rank() {
    let cur = RANKS[0];
    let next = null;
    for (let i = 0; i < RANKS.length; i++) {
      if (state.xp >= RANKS[i].min) cur = RANKS[i];
      else {
        next = RANKS[i];
        break;
      }
    }
    return { cur: cur, next: next };
  }

  function todayStats() {
    return state.days[todayKey()] || { lessons: 0, questions: 0 };
  }

  function bumpDay(field, n) {
    const key = todayKey();
    if (!state.days[key]) state.days[key] = { lessons: 0, questions: 0 };
    state.days[key][field] += n;
    checkStreak();
  }

  function checkStreak() {
    const key = todayKey();
    const day = state.days[key] || { questions: 0 };
    if (day.questions < state.settings.goal) return;
    if (state.streak.last === key) return;
    state.streak.current = state.streak.last === shiftDay(key, -1) ? state.streak.current + 1 : 1;
    state.streak.last = key;
    if (state.streak.current > state.streak.best) state.streak.best = state.streak.current;
    toast("Цель дня выполнена! Серия: " + state.streak.current + " " + plural(state.streak.current, "день", "дня", "дней"));
  }

  function dueMistakes() {
    const now = Date.now();
    return Object.keys(state.mistakes)
      .filter((id) => questionById[id] && state.mistakes[id].dueAt <= now)
      .sort((a, b) => state.mistakes[a].dueAt - state.mistakes[b].dueAt);
  }

  function nextLesson() {
    if (state.lastLesson && lessonById[state.lastLesson] && !(state.lessons[state.lastLesson] || {}).done) {
      return lessonById[state.lastLesson];
    }
    for (const l of allLessons) if (!(state.lessons[l.id] || {}).done) return l;
    return allLessons[0];
  }

  /* ================= общие компоненты разметки ================= */

  function ringHtml(pct, size) {
    const r = 32;
    const c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(100, pct));
    return (
      '<div class="ring"><svg viewBox="0 0 74 74"><circle class="track" cx="37" cy="37" r="' +
      r +
      '"/><circle class="bar" cx="37" cy="37" r="' +
      r +
      '" stroke-dasharray="' +
      ((v / 100) * c).toFixed(1) +
      " " +
      c.toFixed(1) +
      '"/></svg><b>' +
      Math.round(v) +
      "%</b></div>"
    );
  }

  function courseIcon(course) {
    return (
      '<div class="course-icon"><svg viewBox="0 0 24 24">' + (ICONS[course.icon] || ICONS.cube) + "</svg></div>"
    );
  }

  function courseCard(course) {
    const p = courseProgress(course);
    return (
      '<a class="course-card" href="#/course/' +
      course.id +
      '" style="--accent:' +
      course.accent +
      '"><div class="cc-head">' +
      courseIcon(course) +
      "<div><h3>" +
      esc(course.title) +
      '</h3><div class="cc-sub">' +
      esc(course.subtitle) +
      "</div></div></div>" +
      '<p class="cc-text">' +
      esc(course.summary) +
      "</p>" +
      '<div class="progress"><i style="width:' +
      p.pct +
      '%"></i></div><div class="progress-meta"><span>' +
      p.done +
      " из " +
      p.total +
      " " +
      plural(p.total, "урока", "уроков", "уроков") +
      "</span><span>" +
      p.pct +
      "%</span></div></a>"
    );
  }

  function lessonRow(lesson, n) {
    const done = (state.lessons[lesson.id] || {}).done;
    const qn = (lesson.questions || []).length;
    return (
      '<a class="lesson' +
      (done ? " is-done" : "") +
      '" href="#/lesson/' +
      lesson.id +
      '"><div class="lesson-num">' +
      (done ? "✓" : n) +
      '</div><div class="lesson-body"><b>' +
      esc(lesson.title) +
      "</b><span>" +
      lesson.minutes +
      " мин · " +
      esc(lesson.level) +
      " · " +
      qn +
      " " +
      plural(qn, "вопрос", "вопроса", "вопросов") +
      '</span></div><div class="lesson-arrow"><svg viewBox="0 0 24 24">' +
      ICONS.arrow +
      "</svg></div></a>"
    );
  }

  /* ================= экраны ================= */

  function renderHome() {
    setTop("BIM Academy", "Revit · Navisworks · AutoCAD · Civil 3D");
    const hour = new Date().getHours();
    const hello = hour < 5 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
    const t = todayStats();
    const goalPct = Math.min(100, (t.questions / state.settings.goal) * 100);
    const tp = totalProgress();
    const cont = nextLesson();
    const due = dueMistakes().length;
    const r = rank();
    const termOfDay = CONTENT.glossary.length
      ? CONTENT.glossary[
          (new Date().getFullYear() * 372 + new Date().getMonth() * 31 + new Date().getDate()) % CONTENT.glossary.length
        ]
      : null;

    let html = '<section class="section"><div class="hero"><div class="hero-top"><div><h1>' +
      hello +
      "!</h1><p>Решено сегодня: " +
      t.questions +
      " из " +
      state.settings.goal +
      " " +
      plural(state.settings.goal, "вопроса", "вопросов", "вопросов") +
      "</p></div>" +
      ringHtml(goalPct) +
      '</div><div class="hero-stats"><div class="hero-stat"><b>' +
      state.streak.current +
      "</b><span>дней подряд</span></div>" +
      '<div class="hero-stat"><b>' +
      tp.done +
      "/" +
      tp.total +
      "</b><span>уроков</span></div>" +
      '<div class="hero-stat"><b>' +
      accuracy() +
      "%</b><span>точность</span></div></div></div></section>";

    html +=
      '<section class="section"><div class="section-head"><h2>Продолжить</h2><a href="#/courses">все курсы</a></div>' +
      '<a class="card" href="#/lesson/' +
      cont.id +
      '" style="--accent:' +
      (courseById[lessonCourse[cont.id]] || {}).accent +
      '"><div class="row"><span class="chip accent">' +
      esc((courseById[lessonCourse[cont.id]] || {}).title) +
      '</span><span class="chip">' +
      cont.minutes +
      ' мин</span></div><h3 style="margin-top:10px">' +
      esc(cont.title) +
      "</h3><p>" +
      esc(cont.goal || "") +
      "</p></a></section>";

    html +=
      '<section class="section"><div class="grid grid-2">' +
      actionTile("#/quiz/mix/10", "⚡", "Быстрый тест", "10 вопросов") +
      actionTile("#/quiz/mistakes/all", "🎯", "Мои ошибки", due ? due + " к повтору" : "всё закрыто") +
      actionTile("#/glossary", "📖", "Глоссарий", CONTENT.glossary.length + " терминов") +
      actionTile("#/keys", "⌨️", "Горячие клавиши", "шпаргалки") +
      "</div></section>";

    html +=
      '<section class="section"><div class="section-head"><h2>Курсы</h2></div><div class="grid">' +
      CONTENT.courses.map(courseCard).join("") +
      "</div></section>";

    if (termOfDay) {
      html +=
        '<section class="section"><div class="section-head"><h2>Термин дня</h2></div><div class="card"><div class="row spread"><h3>' +
        esc(termOfDay.term) +
        '</h3><span class="chip">' +
        esc((courseById[termOfDay.course] || {}).title || "BIM") +
        "</span></div><p>" +
        esc(termOfDay.text) +
        "</p></div></section>";
    }

    html +=
      '<section class="section"><div class="card"><div class="row spread"><div><h3>' +
      esc(r.cur.title) +
      "</h3><p>" +
      state.xp +
      " XP" +
      (r.next ? " · до «" + esc(r.next.title) + "»: " + (r.next.min - state.xp) + " XP" : " · максимальный уровень") +
      '</p></div><a class="btn small soft" href="#/more">Профиль</a></div>' +
      (r.next
        ? '<div class="progress" style="margin-top:12px"><i style="width:' +
          Math.min(100, Math.round(((state.xp - r.cur.min) / (r.next.min - r.cur.min)) * 100)) +
          '%"></i></div>'
        : "") +
      "</div></section>";

    view.innerHTML = html;
  }

  function actionTile(href, em, title, sub) {
    return (
      '<a class="stat-tile" href="' +
      href +
      '"><b style="font-size:24px">' +
      em +
      '</b><b style="font-size:14px;margin-top:4px">' +
      esc(title) +
      "</b><span>" +
      esc(sub) +
      "</span></a>"
    );
  }

  function renderCourses() {
    setTop("Курсы", allLessons.length + " уроков · " + allQuestions.length + " вопросов");
    const tp = totalProgress();
    view.innerHTML =
      '<section class="section"><div class="card"><div class="row spread"><div><h3>Общий прогресс</h3><p>' +
      tp.done +
      " из " +
      tp.total +
      " уроков пройдено</p></div><b style=\"font-size:24px\">" +
      tp.pct +
      '%</b></div><div class="progress" style="margin-top:12px"><i style="width:' +
      tp.pct +
      '%"></i></div></div></section>' +
      '<section class="section"><div class="grid">' +
      CONTENT.courses.map(courseCard).join("") +
      "</div></section>";
  }

  function renderCourse(id) {
    const course = courseById[id];
    if (!course) return renderNotFound();
    setTop(course.title, course.subtitle);
    const p = courseProgress(course);
    const terms = CONTENT.glossary.filter((t) => t.course === id);
    const videos = CONTENT.videos.filter((v) => v.course === id);
    const qn = course.lessons.reduce((a, l) => a + (l.questions || []).length, 0);

    view.innerHTML =
      '<div style="--accent:' +
      course.accent +
      '">' +
      '<section class="section"><div class="card"><div class="cc-head row">' +
      courseIcon(course) +
      "<div><h3>" +
      esc(course.title) +
      '</h3><div class="cc-sub muted small">' +
      esc(course.level || course.subtitle) +
      "</div></div></div><p style=\"margin-top:10px\">" +
      esc(course.summary) +
      '</p><div class="progress" style="margin-top:12px"><i style="width:' +
      p.pct +
      '%"></i></div><div class="progress-meta"><span>' +
      p.done +
      " / " +
      p.total +
      " уроков</span><span>" +
      qn +
      " вопросов</span></div></div></section>" +
      '<section class="section"><div class="btn-row">' +
      '<a class="btn primary" href="#/quiz/course/' +
      id +
      '">Тест по курсу</a>' +
      '<a class="btn soft" href="#/quiz/exam/' +
      id +
      '">Экзамен</a></div></section>' +
      '<section class="section"><div class="section-head"><h2>Уроки</h2><span class="muted small">' +
      p.total +
      "</span></div>" +
      course.lessons.map((l, i) => lessonRow(l, i + 1)).join("") +
      "</section>" +
      '<section class="section"><div class="grid grid-2">' +
      actionTile("#/videos?course=" + id, "▶️", "Видеоуроки", videos.length + " " + plural(videos.length, "видео", "видео", "видео")) +
      actionTile("#/glossary?course=" + id, "📖", "Термины курса", terms.length + " " + plural(terms.length, "термин", "термина", "терминов")) +
      "</div></section></div>";
  }

  function renderLesson(id) {
    const lesson = lessonById[id];
    if (!lesson) return renderNotFound();
    const course = courseById[lessonCourse[id]];
    setTop(lesson.title, course.title);
    state.lastLesson = id;
    save();

    const done = (state.lessons[id] || {}).done;
    const marked = state.bookmarks.indexOf(id) >= 0;
    const list = course.lessons;
    const prev = list[lesson.index - 1];
    const next = list[lesson.index + 1];
    const qn = (lesson.questions || []).length;

    let html = '<div style="--accent:' + course.accent + '">';
    html +=
      '<section class="lesson-hero"><div class="row row-wrap"><span class="chip accent">' +
      esc(course.title) +
      '</span><span class="chip">' +
      lesson.minutes +
      ' мин</span><span class="chip">' +
      esc(lesson.level) +
      "</span>" +
      (done ? '<span class="chip done">✓ пройден</span>' : "") +
      "</div><h1>" +
      esc(lesson.title) +
      "</h1>" +
      (lesson.goal ? '<div class="goal"><b>Цель урока: </b>' + esc(lesson.goal) + "</div>" : "") +
      "</section>";

    (lesson.blocks || []).forEach((b) => {
      html += '<section class="block">' + renderBlock(b) + "</section>";
    });

    if (lesson.terms && lesson.terms.length) {
      html +=
        '<section class="block"><h4>Термины урока</h4><div class="row row-wrap">' +
        lesson.terms
          .map(
            (t) =>
              '<a class="chip accent" href="#/glossary?q=' + encodeURIComponent(t) + '">' + esc(t) + "</a>"
          )
          .join("") +
        "</div></section>";
    }

    html += '<section class="section mt">';
    if (qn) {
      html +=
        '<a class="btn primary block" href="#/quiz/lesson/' +
        id +
        '">Пройти мини-тест · ' +
        qn +
        " " +
        plural(qn, "вопрос", "вопроса", "вопросов") +
        "</a>";
    }
    html +=
      '<div class="btn-row mt"><button class="btn' +
      (done ? "" : " soft") +
      '" data-act="toggle-done" data-id="' +
      id +
      '">' +
      (done ? "Пройден ✓" : "Отметить пройденным") +
      '</button><button class="btn" data-act="bookmark" data-id="' +
      id +
      '">' +
      (marked ? "★ В закладках" : "☆ В закладки") +
      "</button></div>";

    html += '<div class="btn-row mt">';
    if (prev) html += '<a class="btn" href="#/lesson/' + prev.id + '">← Назад</a>';
    if (next) html += '<a class="btn" href="#/lesson/' + next.id + '">Далее →</a>';
    if (!next) html += '<a class="btn soft" href="#/quiz/exam/' + course.id + '">Экзамен по курсу</a>';
    html += "</div></section></div>";

    view.innerHTML = html;
  }

  function renderBlock(b) {
    switch (b.type) {
      case "text":
        return "<p>" + esc(b.text) + "</p>";
      case "list":
        return (
          (b.title ? "<h4>" + esc(b.title) + "</h4>" : "") +
          '<ul class="bullets">' +
          b.items.map((i) => "<li>" + esc(i) + "</li>").join("") +
          "</ul>"
        );
      case "steps":
        return (
          (b.title ? "<h4>" + esc(b.title) + "</h4>" : "") +
          '<ol class="steps">' +
          b.items.map((i) => "<li>" + esc(i) + "</li>").join("") +
          "</ol>"
        );
      case "note":
        return (
          '<div class="note ' +
          (b.kind || "tip") +
          '">' +
          (b.title ? "<b>" + esc(b.title) + "</b>" : "") +
          "<p>" +
          esc(b.text) +
          "</p></div>"
        );
      case "key":
        return (
          '<div class="keybox"><b>Запомнить</b><ul>' +
          b.items.map((i) => "<li>" + esc(i) + "</li>").join("") +
          "</ul></div>"
        );
      case "figure":
        return (
          '<figure class="figure"><div class="fig-box">' +
          (FIGURES[b.figure] || "") +
          "</div>" +
          (b.caption ? "<figcaption>" + esc(b.caption) + "</figcaption>" : "") +
          "</figure>"
        );
      case "table":
        return (
          (b.title ? "<h4>" + esc(b.title) + "</h4>" : "") +
          '<div class="table-wrap"><table><thead><tr>' +
          b.head.map((h) => "<th>" + esc(h) + "</th>").join("") +
          "</tr></thead><tbody>" +
          b.rows
            .map((r) => "<tr>" + r.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>")
            .join("") +
          "</tbody></table></div>"
        );
      default:
        return "";
    }
  }

  function renderTests() {
    setTop("Тесты", allQuestions.length + " вопросов в базе");
    const due = dueMistakes().length;
    const mistakesTotal = Object.keys(state.mistakes).filter((id) => questionById[id]).length;

    let html =
      '<section class="section"><div class="card"><div class="row spread"><div><h3>Ваша точность</h3><p>' +
      state.answers.correct +
      " верных из " +
      state.answers.total +
      "</p></div><b style=\"font-size:24px\">" +
      accuracy() +
      "%</b></div></div></section>";

    html +=
      '<section class="section"><div class="section-head"><h2>Быстрый старт</h2></div>' +
      '<a class="menu-item" href="#/quiz/mix/10"><span class="mi-ico">⚡</span><span class="mi-body"><b>Случайные 10 вопросов</b><span class="mi-sub">по всем курсам</span></span></a>' +
      '<a class="menu-item" href="#/quiz/mix/25"><span class="mi-ico">🧩</span><span class="mi-body"><b>Большой тест · 25 вопросов</b><span class="mi-sub">проверка общей подготовки</span></span></a>' +
      '<a class="menu-item" href="#/quiz/mistakes/all"><span class="mi-ico">🎯</span><span class="mi-body"><b>Мои ошибки</b><span class="mi-sub">' +
      (mistakesTotal
        ? due
          ? due + " " + plural(due, "вопрос", "вопроса", "вопросов") + " готовы к повтору"
          : "все " + mistakesTotal + " на паузе до срока повтора"
        : "ошибок пока нет") +
      "</span></span></a></section>";

    html += '<section class="section"><div class="section-head"><h2>По курсам</h2></div>';
    CONTENT.courses.forEach((c) => {
      const st = state.byCourse[c.id] || { total: 0, correct: 0 };
      const acc = st.total ? Math.round((st.correct / st.total) * 100) : 0;
      const qn = c.lessons.reduce((a, l) => a + (l.questions || []).length, 0);
      html +=
        '<div class="card" style="--accent:' +
        c.accent +
        '"><div class="row spread"><div><h3>' +
        esc(c.title) +
        "</h3><p>" +
        qn +
        " вопросов · точность " +
        acc +
        '%</p></div></div><div class="btn-row mt"><a class="btn small soft" href="#/quiz/course/' +
        c.id +
        '">10 вопросов</a><a class="btn small" href="#/quiz/exam/' +
        c.id +
        '">Экзамен</a></div></div>';
    });
    html += "</section>";

    if (state.history.length) {
      html += '<section class="section"><div class="section-head"><h2>История</h2></div>';
      state.history
        .slice(0, 8)
        .forEach((h) => {
          const pct = Math.round((h.correct / h.total) * 100);
          html +=
            '<div class="result"><span class="kind">' +
            esc(h.mode) +
            "</span><b>" +
            esc(h.title) +
            "</b><span>" +
            h.correct +
            " из " +
            h.total +
            " · " +
            pct +
            "% · " +
            new Date(h.at).toLocaleDateString("ru-RU") +
            "</span></div>";
        });
      html += "</section>";
    }

    view.innerHTML = html;
  }

  /* ================= движок тестов ================= */

  let quiz = null;

  function startQuiz(mode, arg) {
    let items = [];
    let title = "Тест";
    let modeName = "Тест";

    if (mode === "lesson") {
      const lesson = lessonById[arg];
      if (!lesson) return renderNotFound();
      items = (lesson.questions || []).slice();
      title = lesson.title;
      modeName = "Мини-тест";
    } else if (mode === "course") {
      const course = courseById[arg];
      if (!course) return renderNotFound();
      items = shuffle(allQuestions.filter((q) => q.courseId === arg)).slice(0, 10);
      title = course.title + " · тест";
      modeName = "Тест по курсу";
    } else if (mode === "exam") {
      const course = courseById[arg];
      if (!course) return renderNotFound();
      items = shuffle(allQuestions.filter((q) => q.courseId === arg)).slice(0, 25);
      title = course.title + " · экзамен";
      modeName = "Экзамен";
    } else if (mode === "mix") {
      const n = Math.max(5, Math.min(50, parseInt(arg, 10) || 10));
      items = shuffle(allQuestions).slice(0, n);
      title = "Случайные вопросы";
      modeName = "Случайный тест";
    } else if (mode === "mistakes") {
      let ids = dueMistakes();
      if (!ids.length) ids = Object.keys(state.mistakes).filter((id) => questionById[id]);
      items = shuffle(ids.map((id) => questionById[id])).slice(0, 15);
      title = "Работа над ошибками";
      modeName = "Ошибки";
    }

    if (!items.length) {
      setTop("Тесты", "");
      view.innerHTML =
        '<div class="empty"><span class="em">🎉</span><b>Вопросов для этого режима нет</b><p class="muted small mt">Ошибок к повтору не осталось. Пройдите новый урок или случайный тест.</p><div class="btn-row mt"><a class="btn primary" href="#/quiz/mix/10">Случайный тест</a><a class="btn" href="#/tests">Назад</a></div></div>';
      return;
    }

    quiz = {
      mode: mode,
      modeName: modeName,
      title: title,
      items: items,
      idx: 0,
      sel: [],
      checked: false,
      correct: 0,
      wrong: [],
      startedAt: Date.now()
    };
    renderQuestion();
  }

  function renderQuestion() {
    const q = quiz.items[quiz.idx];
    setTop(quiz.title, quiz.idx + 1 + " из " + quiz.items.length);
    const pct = (quiz.idx / quiz.items.length) * 100;
    const kind =
      q.type === "multi"
        ? "Несколько ответов"
        : q.type === "bool"
        ? "Верно или нет"
        : q.type === "input"
        ? "Впишите ответ"
        : "Один ответ";

    let body = "";
    if (q.type === "single" || q.type === "multi") {
      body =
        '<div class="options">' +
        q.options
          .map(
            (o, i) =>
              '<button class="option' +
              (q.type === "single" ? " round" : "") +
              '" data-act="pick" data-i="' +
              i +
              '"><span class="mark">' +
              (q.type === "single" ? "•" : "✓") +
              "</span><span>" +
              esc(o) +
              "</span></button>"
          )
          .join("") +
        "</div>";
      if (q.type === "multi")
        body += '<button class="btn primary block mt" data-act="check">Проверить</button>';
    } else if (q.type === "bool") {
      body =
        '<div class="options"><button class="option round" data-act="pick" data-i="1"><span class="mark">•</span><span>Верно</span></button>' +
        '<button class="option round" data-act="pick" data-i="0"><span class="mark">•</span><span>Неверно</span></button></div>';
    } else if (q.type === "input") {
      body =
        '<input class="answer-input" id="answerInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Ваш ответ" />' +
        '<button class="btn primary block mt" data-act="check">Проверить</button>';
    }

    view.innerHTML =
      '<div class="quiz-top"><div class="progress"><i style="width:' +
      pct +
      '%"></i></div><span class="quiz-count">' +
      (quiz.idx + 1) +
      "/" +
      quiz.items.length +
      "</span></div>" +
      '<div class="question" style="--accent:' +
      ((courseById[q.courseId] || {}).accent || "#4f7cf7") +
      '"><span class="q-kind">' +
      kind +
      "</span><h2>" +
      esc(q.q) +
      "</h2>" +
      body +
      '<div id="verdict"></div></div>' +
      '<div class="btn-row mt"><a class="btn" href="#/lesson/' +
      q.lessonId +
      '">К уроку</a><button class="btn" data-act="quit">Прервать</button></div>';

    quiz.sel = [];
    quiz.checked = false;
    const input = document.getElementById("answerInput");
    if (input) setTimeout(() => input.focus(), 60);
  }

  function pick(i) {
    const q = quiz.items[quiz.idx];
    if (quiz.checked) return;
    if (q.type === "multi") {
      const at = quiz.sel.indexOf(i);
      if (at >= 0) quiz.sel.splice(at, 1);
      else quiz.sel.push(i);
      document.querySelectorAll(".option").forEach((el) => {
        el.classList.toggle("sel", quiz.sel.indexOf(Number(el.dataset.i)) >= 0);
      });
    } else {
      quiz.sel = [i];
      checkAnswer();
    }
  }

  function isCorrect(q, sel, text) {
    if (q.type === "single") return sel[0] === q.answer;
    if (q.type === "bool") return (sel[0] === 1) === q.answer;
    if (q.type === "multi") {
      const want = q.answer.slice().sort().join(",");
      return sel.slice().sort().join(",") === want;
    }
    if (q.type === "input") {
      const a = norm(text);
      const b = hardNorm(text);
      if (!a) return false;
      return q.answer.some((v) => norm(v) === a || hardNorm(v) === b);
    }
    return false;
  }

  function correctText(q) {
    if (q.type === "single") return q.options[q.answer];
    if (q.type === "bool") return q.answer ? "Верно" : "Неверно";
    if (q.type === "multi") return q.answer.map((i) => q.options[i]).join(" · ");
    if (q.type === "input") return q.answer[0];
    return "";
  }

  function checkAnswer() {
    if (quiz.checked) return;
    const q = quiz.items[quiz.idx];
    const input = document.getElementById("answerInput");
    const text = input ? input.value : "";
    if (q.type === "multi" && !quiz.sel.length) return toast("Выберите хотя бы один вариант");
    if (q.type === "input" && !text.trim()) return toast("Введите ответ");

    const ok = isCorrect(q, quiz.sel, text);
    quiz.checked = true;
    if (ok) quiz.correct++;
    else quiz.wrong.push({ q: q, given: q.type === "input" ? text : quiz.sel.slice() });

    // отметка вариантов
    document.querySelectorAll(".option").forEach((el) => {
      el.setAttribute("disabled", "disabled");
      const val = Number(el.dataset.i);
      let isRight;
      if (q.type === "bool") isRight = (val === 1) === (q.answer === true);
      else if (q.type === "multi") isRight = q.answer.indexOf(val) >= 0;
      else isRight = val === q.answer;
      if (isRight) el.classList.add("right");
      else if (quiz.sel.indexOf(val) >= 0) el.classList.add("wrong");
    });
    if (input) input.setAttribute("disabled", "disabled");

    const verdict = document.getElementById("verdict");
    verdict.innerHTML =
      '<div class="verdict ' +
      (ok ? "ok" : "no") +
      '"><b>' +
      (ok ? "Верно" : "Ошибка") +
      "</b>" +
      (ok ? "" : '<p><b class="ans-label">Правильный ответ: </b>' + esc(correctText(q)) + "</p>") +
      (q.explain ? "<p>" + esc(q.explain) + "</p>" : "") +
      '</div><button class="btn primary block mt" data-act="next">' +
      (quiz.idx + 1 < quiz.items.length ? "Дальше →" : "Результат") +
      "</button>";

    // статистика
    state.answers.total++;
    if (ok) state.answers.correct++;
    const cs = state.byCourse[q.courseId] || { total: 0, correct: 0 };
    cs.total++;
    if (ok) cs.correct++;
    state.byCourse[q.courseId] = cs;
    if (ok) state.xp += 3;
    bumpDay("questions", 1);

    // интервальное повторение ошибок
    const m = state.mistakes[q.id];
    if (ok) {
      if (m) {
        const box = Math.min(MISTAKE_HOURS.length - 1, (m.box || 0) + 1);
        if (box >= MISTAKE_HOURS.length - 1) delete state.mistakes[q.id];
        else state.mistakes[q.id] = { box: box, dueAt: Date.now() + MISTAKE_HOURS[box] * 3600000 };
      }
    } else {
      state.mistakes[q.id] = { box: 0, dueAt: Date.now() };
    }
    save();

    const nextBtn = verdict.querySelector('[data-act="next"]');
    if (nextBtn) nextBtn.focus();
  }

  function nextQuestion() {
    if (quiz.idx + 1 < quiz.items.length) {
      quiz.idx++;
      renderQuestion();
      window.scrollTo(0, 0);
    } else {
      finishQuiz();
    }
  }

  function finishQuiz() {
    const total = quiz.items.length;
    const pct = Math.round((quiz.correct / total) * 100);
    state.history.unshift({
      at: Date.now(),
      mode: quiz.modeName,
      title: quiz.title,
      correct: quiz.correct,
      total: total
    });
    state.history = state.history.slice(0, 30);
    if (quiz.mode === "exam" && pct >= 90) state.flags.exam90 = true;
    if (total >= 10 && pct === 100) state.flags.perfect = true;
    if (quiz.mode === "mistakes") state.flags.mistakes = true;
    if (quiz.mode === "exam" && pct >= 80) state.xp += 25;
    save();

    setTop("Результат", quiz.title);
    const r = 58;
    const c = 2 * Math.PI * r;
    const verdictText =
      pct >= 90 ? "Отличный результат" : pct >= 70 ? "Хорошо, но есть пробелы" : pct >= 50 ? "Стоит повторить тему" : "Нужно вернуться к уроку";

    let html =
      '<section class="section center"><div class="result-ring"><svg viewBox="0 0 132 132"><circle class="track" cx="66" cy="66" r="' +
      r +
      '"/><circle class="bar" cx="66" cy="66" r="' +
      r +
      '" stroke-dasharray="' +
      ((pct / 100) * c).toFixed(1) +
      " " +
      c.toFixed(1) +
      '"/></svg><b>' +
      pct +
      "%</b></div><h2 style=\"margin:0\">" +
      verdictText +
      '</h2><p class="muted">' +
      quiz.correct +
      " верных из " +
      total +
      " · +" +
      quiz.correct * 3 +
      " XP</p></section>";

    if (quiz.wrong.length) {
      html += '<section class="section"><div class="section-head"><h2>Разбор ошибок</h2></div>';
      quiz.wrong.forEach((w) => {
        html +=
          '<div class="mistake"><b>' +
          esc(w.q.q) +
          '</b><div class="ans">Правильно: ' +
          esc(correctText(w.q)) +
          "</div>" +
          (w.q.explain ? '<div class="muted small mt">' + esc(w.q.explain) + "</div>" : "") +
          '<a class="btn small soft mt" href="#/lesson/' +
          w.q.lessonId +
          '">Открыть урок</a></div>';
      });
      html += "</section>";
    } else {
      html +=
        '<section class="section"><div class="note tip"><b>Ни одной ошибки</b><p>Можно двигаться дальше — попробуйте экзамен или следующий курс.</p></div></section>';
    }

    html +=
      '<section class="section"><div class="btn-row">' +
      (quiz.wrong.length ? '<button class="btn primary" data-act="retry-wrong">Повторить ошибки</button>' : "") +
      '<a class="btn" href="#/tests">К тестам</a><a class="btn" href="#/">На главную</a></div></section>';

    const wrongItems = quiz.wrong.map((w) => w.q);
    view.innerHTML = html;
    view._wrongItems = wrongItems;
    quiz = null;
  }

  /* ================= видео ================= */

  function renderVideos(params) {
    setTop("Видеоуроки", "подборки и свои ссылки");
    const active = params.get("course") || "all";
    const query = norm(params.get("q") || "");
    let list = CONTENT.videos.slice();
    if (active !== "all") list = list.filter((v) => v.course === active);
    if (query) list = list.filter((v) => norm(v.title + " " + v.description).indexOf(query) >= 0);

    let html =
      '<div class="filters"><button data-act="vfilter" data-id="all" class="' +
      (active === "all" ? "on" : "") +
      '">Все</button>' +
      CONTENT.courses
        .map(
          (c) =>
            '<button data-act="vfilter" data-id="' +
            c.id +
            '" class="' +
            (active === c.id ? "on" : "") +
            '">' +
            esc(c.title) +
            "</button>"
        )
        .join("") +
      "</div>";

    html +=
      '<section class="section"><div class="note tip"><b>Как это работает</b><p>«Смотреть» открывает YouTube с подборкой уроков по теме — такие ссылки не устаревают. Свои видео можно сохранить в конце страницы.</p></div></section>';

    if (state.myVideos.length) {
      html += '<section class="section"><div class="section-head"><h2>Мои видео</h2></div>';
      state.myVideos.forEach((v, i) => {
        html +=
          '<div class="video-card"><div class="vc-top"><div class="play"><svg viewBox="0 0 24 24">' +
          ICONS.play +
          "</svg></div><div><b>" +
          esc(v.title) +
          "</b><span>" +
          esc((courseById[v.course] || {}).title || "Своё видео") +
          '</span></div></div><div class="btn-row mt"><a class="btn small primary" href="' +
          esc(v.url) +
          '" target="_blank" rel="noopener">Открыть</a><button class="btn small" data-act="del-video" data-i="' +
          i +
          '">Удалить</button></div></div>';
      });
      html += "</section>";
    }

    html += '<section class="section"><div class="section-head"><h2>Подборки по темам</h2><span class="muted small">' + list.length + "</span></div>";
    if (!list.length) html += '<div class="empty"><span class="em">🔍</span>Ничего не найдено</div>';
    list.forEach((v) => {
      const course = courseById[v.course] || {};
      const lesson = lessonById[v.lesson];
      html +=
        '<div class="video-card" style="--accent:' +
        course.accent +
        '"><div class="vc-top"><div class="play"><svg viewBox="0 0 24 24">' +
        ICONS.play +
        "</svg></div><div><b>" +
        esc(v.title) +
        "</b><span>" +
        esc(course.title) +
        " · " +
        esc(v.level) +
        "</span></div></div><p>" +
        esc(v.description) +
        '</p><div class="btn-row mt"><a class="btn small primary" href="https://www.youtube.com/results?search_query=' +
        encodeURIComponent(v.query) +
        '" target="_blank" rel="noopener">Смотреть</a>' +
        (lesson ? '<a class="btn small" href="#/lesson/' + lesson.id + '">Урок по теме</a>' : "") +
        "</div></div>";
    });
    html += "</section>";

    html +=
      '<section class="section"><details class="term"><summary>➕ Добавить своё видео</summary><div class="term-body">' +
      '<input class="answer-input" id="vTitle" type="text" placeholder="Название" /><input class="answer-input mt" id="vUrl" type="url" placeholder="Ссылка (https://...)" />' +
      '<select class="answer-input mt" id="vCourse">' +
      CONTENT.courses.map((c) => '<option value="' + c.id + '">' + esc(c.title) + "</option>").join("") +
      '</select><button class="btn primary block mt" data-act="add-video">Сохранить</button></div></details></section>';

    view.innerHTML = html;
  }

  /* ================= глоссарий ================= */

  function renderGlossary(params) {
    setTop("Глоссарий", CONTENT.glossary.length + " терминов");
    const active = params.get("course") || "all";
    const q = params.get("q") || "";

    let html =
      '<div class="search-wrap"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" fill="none"/><path d="M16 16l4 4"/></svg>' +
      '<input class="search-field" id="glossarySearch" type="search" placeholder="Поиск термина" value="' +
      esc(q) +
      '" /></div>';

    html +=
      '<div class="filters"><button data-act="gfilter" data-id="all" class="' +
      (active === "all" ? "on" : "") +
      '">Все</button>' +
      CONTENT.courses
        .map(
          (c) =>
            '<button data-act="gfilter" data-id="' +
            c.id +
            '" class="' +
            (active === c.id ? "on" : "") +
            '">' +
            esc(c.title) +
            "</button>"
        )
        .join("") +
      "</div>";

    html += '<div id="termList"></div>';
    view.innerHTML = html;

    const box = document.getElementById("termList");
    const input = document.getElementById("glossarySearch");

    function draw(value) {
      const nq = norm(value);
      let list = CONTENT.glossary.slice();
      if (active !== "all") list = list.filter((t) => t.course === active);
      if (nq) list = list.filter((t) => norm(t.term + " " + (t.full || "") + " " + t.text).indexOf(nq) >= 0);
      list.sort((a, b) => a.term.localeCompare(b.term, "ru"));

      if (!list.length) {
        box.innerHTML = '<div class="empty"><span class="em">🔍</span>Термин не найден</div>';
        return;
      }
      box.innerHTML = list
        .map((t) => {
          const course = courseById[t.course] || {};
          return (
            '<details class="term" data-term="' +
            esc(t.term) +
            '" style="--accent:' +
            course.accent +
            '"' +
            (nq && list.length <= 3 ? " open" : "") +
            "><summary><span>" +
            esc(t.term) +
            (t.full ? ' <span class="term-full">(' + esc(t.full) + ")</span>" : "") +
            '</span></summary><div class="term-body">' +
            esc(t.text) +
            '<div class="row mt"><span class="chip accent">' +
            esc(course.title || "BIM") +
            "</span></div></div></details>"
          );
        })
        .join("");
    }

    draw(q);
    if (input) {
      input.addEventListener("input", () => {
        clearTimeout(input._t);
        input._t = setTimeout(() => draw(input.value), 140);
      });
    }
  }

  /* ================= поиск ================= */

  function renderSearch(params) {
    setTop("Поиск", "уроки, термины, вопросы, видео");
    const q = params.get("q") || "";
    let html =
      '<div class="search-wrap"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" fill="none"/><path d="M16 16l4 4"/></svg>' +
      '<input class="search-field" id="mainSearch" type="search" placeholder="Что ищем? Например: коллизии, LOD, слои" value="' +
      esc(q) +
      '" /></div><div id="searchResults"></div>';
    view.innerHTML = html;

    const input = document.getElementById("mainSearch");
    const box = document.getElementById("searchResults");

    function run(value) {
      const nq = norm(value);
      if (nq.length < 2) {
        box.innerHTML =
          '<div class="section"><div class="section-head"><h2>Популярное</h2></div><div class="row row-wrap">' +
          ["коллизии", "LOD", "IFC", "семейства", "слои", "спецификации", "коридор", "рабочие наборы", "печать", "поверхность"]
            .map((w) => '<button class="chip accent" data-act="suggest" data-w="' + w + '">' + w + "</button>")
            .join("") +
          "</div></div>";
        return;
      }
      const words = nq.split(" ").filter(Boolean);
      const found = searchIndex
        .map((item) => {
          let score = 0;
          words.forEach((w) => {
            const at = item.hay.indexOf(w);
            if (at >= 0) score += at < 60 ? 3 : 1;
            if (norm(item.title).indexOf(w) >= 0) score += 4;
          });
          return { item: item, score: score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 40);

      if (!found.length) {
        box.innerHTML = '<div class="empty"><span class="em">🤔</span>Ничего не нашлось. Попробуйте другое слово.</div>';
        return;
      }
      box.innerHTML =
        '<div class="section"><div class="section-head"><h2>Найдено</h2><span class="muted small">' +
        found.length +
        "</span></div>" +
        found
          .map((x) => {
            const it = x.item;
            const accent = (courseById[it.course] || {}).accent || "#4f7cf7";
            return (
              '<a class="result" href="' +
              it.href +
              '" style="--accent:' +
              accent +
              '"><span class="kind">' +
              it.kind +
              "</span><b>" +
              highlight(it.title, words) +
              "</b><span>" +
              highlight(cut(it.sub, 130), words) +
              "</span></a>"
            );
          })
          .join("") +
        "</div>";
    }

    function cut(s, n) {
      s = String(s || "");
      return s.length > n ? s.slice(0, n) + "…" : s;
    }

    function highlight(text, words) {
      let out = esc(text);
      words.forEach((w) => {
        if (w.length < 2) return;
        const re = new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
        out = out.replace(re, "<mark>$1</mark>");
      });
      return out;
    }

    input.addEventListener("input", () => {
      clearTimeout(input._t);
      input._t = setTimeout(() => run(input.value), 160);
    });
    box.addEventListener("click", (e) => {
      const b = e.target.closest('[data-act="suggest"]');
      if (b) {
        input.value = b.dataset.w;
        run(input.value);
      }
    });
    run(q);
    if (!q) setTimeout(() => input.focus(), 80);
  }

  /* ================= горячие клавиши ================= */

  function renderKeys() {
    setTop("Горячие клавиши", "шпаргалки по программам");
    let html = '<section class="section"><p class="muted small">Собрано из уроков: сочетания клавиш и служебные команды.</p></section>';
    CONTENT.courses.forEach((course) => {
      const tables = [];
      course.lessons.forEach((l) => {
        (l.blocks || []).forEach((b) => {
          if (b.type === "table" && /клавиш|команд|Ввод координат/i.test(b.title || "")) {
            tables.push({ block: b, lesson: l });
          }
        });
      });
      if (!tables.length) return;
      html +=
        '<section class="section" style="--accent:' +
        course.accent +
        '"><div class="section-head"><h2>' +
        esc(course.title) +
        "</h2></div>";
      tables.forEach((t) => {
        html +=
          '<div class="block">' +
          renderBlock(t.block) +
          '<a class="btn small soft mt" href="#/lesson/' +
          t.lesson.id +
          '">Урок: ' +
          esc(t.lesson.title) +
          "</a></div>";
      });
      html += "</section>";
    });
    view.innerHTML = html;
  }

  /* ================= закладки ================= */

  function renderBookmarks() {
    setTop("Закладки", state.bookmarks.length + " " + plural(state.bookmarks.length, "урок", "урока", "уроков"));
    const list = state.bookmarks.map((id) => lessonById[id]).filter(Boolean);
    if (!list.length) {
      view.innerHTML =
        '<div class="empty"><span class="em">☆</span><b>Пока пусто</b><p class="muted small mt">Открывайте урок и нажимайте «В закладки», чтобы вернуться к нему позже.</p><a class="btn primary mt" href="#/courses">К курсам</a></div>';
      return;
    }
    view.innerHTML =
      '<section class="section">' + list.map((l, i) => lessonRow(l, i + 1)).join("") + "</section>";
  }

  /* ================= профиль / ещё ================= */

  function renderMore() {
    setTop("Профиль и настройки", "прогресс, темы, данные");
    const r = rank();
    const tp = totalProgress();
    const t = todayStats();

    let html =
      '<section class="section"><div class="card"><div class="row spread"><div><h3>' +
      esc(r.cur.title) +
      "</h3><p>" +
      state.xp +
      " XP · " +
      accuracy() +
      "% точность</p></div>" +
      ringHtml(tp.pct) +
      "</div>" +
      (r.next
        ? '<div class="progress" style="margin-top:12px"><i style="width:' +
          Math.min(100, Math.round(((state.xp - r.cur.min) / (r.next.min - r.cur.min)) * 100)) +
          '%"></i></div><div class="progress-meta"><span>до «' +
          esc(r.next.title) +
          '»</span><span>' +
          (r.next.min - state.xp) +
          " XP</span></div>"
        : "") +
      "</div></section>";

    html +=
      '<section class="section"><div class="grid grid-2">' +
      statTile(tp.done + "/" + tp.total, "уроков пройдено") +
      statTile(state.answers.total, "ответов в тестах") +
      statTile(state.streak.current, "дней подряд") +
      statTile(state.streak.best, "лучшая серия") +
      statTile(t.questions, "вопросов сегодня") +
      statTile(Object.keys(state.mistakes).filter((id) => questionById[id]).length, "ошибок в работе") +
      "</div></section>";

    html +=
      '<section class="section"><div class="section-head"><h2>Достижения</h2><span class="muted small">' +
      BADGES.filter((b) => b.test(state)).length +
      " из " +
      BADGES.length +
      '</span></div><div class="grid grid-2">' +
      BADGES.map(
        (b) =>
          '<div class="badge' +
          (b.test(state) ? " on" : "") +
          '"><span class="em">' +
          b.em +
          "</span><b>" +
          esc(b.title) +
          "</b><span>" +
          esc(b.desc) +
          "</span></div>"
      ).join("") +
      "</div></section>";

    html +=
      '<section class="section"><div class="section-head"><h2>Разделы</h2></div>' +
      '<a class="menu-item" href="#/bookmarks"><span class="mi-ico">★</span><span class="mi-body"><b>Закладки</b><span class="mi-sub">' +
      state.bookmarks.length +
      ' сохранённых уроков</span></span></a>' +
      '<a class="menu-item" href="#/keys"><span class="mi-ico">⌨️</span><span class="mi-body"><b>Горячие клавиши</b><span class="mi-sub">Revit, AutoCAD и другие</span></span></a>' +
      '<a class="menu-item" href="#/glossary"><span class="mi-ico">📖</span><span class="mi-body"><b>Глоссарий</b><span class="mi-sub">' +
      CONTENT.glossary.length +
      " терминов</span></span></a></section>";

    html +=
      '<section class="section"><div class="section-head"><h2>Тема оформления</h2></div><div class="segmented">' +
      ["auto", "light", "dark"]
        .map(
          (m) =>
            '<button data-act="theme" data-m="' +
            m +
            '" class="' +
            (state.settings.theme === m ? "on" : "") +
            '">' +
            (m === "auto" ? "Как в системе" : m === "light" ? "Светлая" : "Тёмная") +
            "</button>"
        )
        .join("") +
      "</div></section>";

    html +=
      '<section class="section"><div class="section-head"><h2>Цель на день</h2></div><div class="segmented">' +
      [5, 10, 20, 30]
        .map(
          (g) =>
            '<button data-act="goal" data-g="' +
            g +
            '" class="' +
            (state.settings.goal === g ? "on" : "") +
            '">' +
            g +
            "</button>"
        )
        .join("") +
      '</div><p class="muted small mt">Столько вопросов нужно решить, чтобы день засчитался в серию.</p></section>';

    html +=
      '<section class="section"><div class="section-head"><h2>Данные</h2></div>' +
      '<button class="menu-item" data-act="export"><span class="mi-ico">⬇️</span><span class="mi-body"><b>Экспорт прогресса</b><span class="mi-sub">файл JSON для переноса на другое устройство</span></span></button>' +
      '<button class="menu-item" data-act="import"><span class="mi-ico">⬆️</span><span class="mi-body"><b>Импорт прогресса</b><span class="mi-sub">загрузить сохранённый файл</span></span></button>' +
      '<button class="menu-item" data-act="install"><span class="mi-ico">📲</span><span class="mi-body"><b>Установить на телефон</b><span class="mi-sub">работает офлайн, как обычное приложение</span></span></button>' +
      '<button class="menu-item" data-act="reset"><span class="mi-ico">🗑</span><span class="mi-body"><b>Сбросить прогресс</b><span class="mi-sub">удалит статистику, закладки и ошибки</span></span></button>' +
      '<input type="file" id="importFile" class="file-input" accept="application/json,.json" /></section>';

    html +=
      '<section class="section"><div class="card"><h3>О приложении</h3><p>BIM Academy — офлайн-справочник и тренажёр по BIM, Revit, Navisworks, AutoCAD и Civil 3D. ' +
      allLessons.length +
      " уроков, " +
      allQuestions.length +
      " вопросов, " +
      CONTENT.glossary.length +
      " терминов, " +
      CONTENT.videos.length +
      ' видеоподборок.</p><p class="mt small">Версия ' +
      APP_VERSION +
      "</p></div></section>";

    view.innerHTML = html;
  }

  function statTile(v, label) {
    return '<div class="stat-tile"><b>' + esc(v) + "</b><span>" + esc(label) + "</span></div>";
  }

  function renderNotFound() {
    setTop("Не найдено", "");
    view.innerHTML =
      '<div class="empty"><span class="em">🧭</span><b>Страница не найдена</b><a class="btn primary mt" href="#/">На главную</a></div>';
  }

  /* ================= действия ================= */

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;

    if (act === "pick") return pick(Number(el.dataset.i));
    if (act === "check") return checkAnswer();
    if (act === "next") return nextQuestion();
    if (act === "quit") {
      quiz = null;
      location.hash = "#/tests";
      return;
    }
    if (act === "retry-wrong") {
      const items = view._wrongItems || [];
      if (!items.length) return;
      quiz = {
        mode: "mistakes",
        modeName: "Повтор ошибок",
        title: "Повтор ошибок",
        items: shuffle(items),
        idx: 0,
        sel: [],
        checked: false,
        correct: 0,
        wrong: [],
        startedAt: Date.now()
      };
      renderQuestion();
      window.scrollTo(0, 0);
      return;
    }
    if (act === "toggle-done") {
      const id = el.dataset.id;
      const cur = state.lessons[id] || {};
      if (cur.done) {
        delete state.lessons[id];
        toast("Отметка снята");
      } else {
        state.lessons[id] = { done: true, at: Date.now() };
        state.xp += 12;
        bumpDay("lessons", 1);
        toast("Урок пройден. +12 XP");
      }
      save();
      renderLesson(id);
      return;
    }
    if (act === "bookmark") {
      const id = el.dataset.id;
      const at = state.bookmarks.indexOf(id);
      if (at >= 0) {
        state.bookmarks.splice(at, 1);
        toast("Убрано из закладок");
      } else {
        state.bookmarks.push(id);
        toast("Добавлено в закладки");
      }
      save();
      renderLesson(id);
      return;
    }
    if (act === "theme") {
      state.settings.theme = el.dataset.m;
      save();
      applyTheme();
      renderMore();
      return;
    }
    if (act === "goal") {
      state.settings.goal = Number(el.dataset.g);
      save();
      renderMore();
      return;
    }
    if (act === "gfilter") {
      const val = document.getElementById("glossarySearch");
      location.hash =
        "#/glossary?course=" + el.dataset.id + (val && val.value ? "&q=" + encodeURIComponent(val.value) : "");
      return;
    }
    if (act === "vfilter") {
      location.hash = "#/videos?course=" + el.dataset.id;
      return;
    }
    if (act === "add-video") {
      const title = document.getElementById("vTitle").value.trim();
      const url = document.getElementById("vUrl").value.trim();
      const course = document.getElementById("vCourse").value;
      if (!title || !url) return toast("Заполните название и ссылку");
      if (!/^https?:\/\//i.test(url)) return toast("Ссылка должна начинаться с http");
      state.myVideos.unshift({ title: title, url: url, course: course });
      save();
      toast("Видео сохранено");
      route();
      return;
    }
    if (act === "del-video") {
      state.myVideos.splice(Number(el.dataset.i), 1);
      save();
      route();
      return;
    }
    if (act === "export") return exportData();
    if (act === "import") {
      const f = document.getElementById("importFile");
      f.onchange = importData;
      f.click();
      return;
    }
    if (act === "install") {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt = null;
      } else {
        toast("На iPhone: «Поделиться» → «На экран Домой»");
      }
      return;
    }
    if (act === "reset") {
      if (confirm("Удалить весь прогресс: уроки, статистику, закладки и ошибки?")) {
        state = defaultState();
        save();
        applyTheme();
        toast("Прогресс сброшен");
        location.hash = "#/";
        route();
      }
      return;
    }
  });

  // запоминаем открытые термины (для достижения)
  document.addEventListener("toggle", (e) => {
    const d = e.target;
    if (!d.classList || !d.classList.contains("term") || !d.open) return;
    const term = d.dataset.term;
    if (term && state.terms.indexOf(term) < 0) {
      state.terms.push(term);
      save();
    }
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (!quiz) return;
    const nextBtn = document.querySelector('[data-act="next"]');
    if (nextBtn) {
      e.preventDefault();
      nextQuestion();
      return;
    }
    const checkBtn = document.querySelector('[data-act="check"]');
    if (checkBtn) {
      e.preventDefault();
      checkAnswer();
    }
  });

  function exportData() {
    const data = JSON.stringify({ app: "bim-academy", version: APP_VERSION, savedAt: new Date().toISOString(), state: state }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bim-academy-progress-" + todayKey() + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    toast("Файл прогресса сохранён");
  }

  function importData(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = parsed.state || parsed;
        if (!incoming || typeof incoming !== "object") throw new Error("bad");
        state = Object.assign(defaultState(), incoming);
        save();
        applyTheme();
        toast("Прогресс загружен");
        route();
      } catch (err) {
        toast("Не удалось прочитать файл");
      }
    };
    reader.readAsText(file);
  }

  /* ================= тема ================= */

  function applyTheme() {
    const mode = state.settings.theme;
    const dark = mode === "dark" || (mode === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }

  themeBtn.addEventListener("click", () => {
    const order = ["auto", "light", "dark"];
    const cur = order.indexOf(state.settings.theme);
    state.settings.theme = order[(cur + 1) % order.length];
    save();
    applyTheme();
    toast(
      state.settings.theme === "auto" ? "Тема: как в системе" : state.settings.theme === "light" ? "Светлая тема" : "Тёмная тема"
    );
    if (currentRoute()[0] === "more") renderMore();
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  /* ================= маршрутизация ================= */

  function setTop(title, sub) {
    topTitle.textContent = title;
    topSubtitle.textContent = sub || "";
  }

  function currentRoute() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, search] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    return [parts[0] || "home", parts[1], parts[2], new URLSearchParams(search || "")];
  }

  const TAB_ROUTES = { home: "home", courses: "courses", tests: "tests", videos: "videos", more: "more" };

  function route() {
    const [name, a, b, params] = currentRoute();

    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", TAB_ROUTES[name] === t.dataset.tab);
    });
    backBtn.hidden = !!TAB_ROUTES[name];

    switch (name) {
      case "home":
        renderHome();
        break;
      case "courses":
        renderCourses();
        break;
      case "course":
        renderCourse(a);
        break;
      case "lesson":
        renderLesson(a);
        break;
      case "tests":
        renderTests();
        break;
      case "quiz":
        startQuiz(a, b);
        break;
      case "videos":
        renderVideos(params);
        break;
      case "glossary":
        renderGlossary(params);
        break;
      case "search":
        renderSearch(params);
        break;
      case "keys":
        renderKeys();
        break;
      case "bookmarks":
        renderBookmarks();
        break;
      case "more":
        renderMore();
        break;
      default:
        renderNotFound();
    }
    window.scrollTo(0, 0);
  }

  backBtn.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.hash = "#/";
  });

  window.addEventListener("hashchange", route);

  /* ================= PWA ================= */

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  /* ================= запуск ================= */

  applyTheme();
  if (!location.hash) location.hash = "#/";
  route();
})();
