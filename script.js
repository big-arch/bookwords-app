const STORAGE_KEY = "bookwords.v1";
const DAILY_GOAL_KEY = "bookwords.dailyGoal.v1";
const STREAK_KEY = "bookwords.streak.v1";
const IMAGE_CACHE_KEY = "bookwords.imageCache.v1";
const TRANSLATION_DEBOUNCE_MS = 450;
const DAILY_GOAL = 10;
const MAX_STARS = 7;
const AI_IMAGE_ENDPOINT = "https://image.pollinations.ai/prompt/";
const QUIZ_MODES = ["en-ru", "ru-en", "spell", "listen"];

const fallbackTranslations = {
  apple: ["яблоко"],
  book: ["книга"],
  castle: ["замок", "крепость"],
  cloak: ["плащ", "мантия"],
  door: ["дверь"],
  forest: ["лес"],
  glimpse: ["мимолетный взгляд", "проблеск"],
  hill: ["холм"],
  house: ["дом"],
  journey: ["путешествие"],
  king: ["король"],
  light: ["свет", "легкий"],
  river: ["река"],
  shadow: ["тень"],
  sword: ["меч"],
  wander: ["бродить", "странствовать"],
  wizard: ["волшебник"]
};

const sampleData = {
  collections: [
    {
      id: crypto.randomUUID(),
      name: "The Hobbit",
      createdAt: Date.now(),
      words: [
        {
          id: crypto.randomUUID(),
          en: "burrow",
          ru: "нора",
          example: "The hobbit-hole was not a nasty, dirty, wet hole.",
          image: "",
          score: 1,
          dueAt: Date.now()
        },
        {
          id: crypto.randomUUID(),
          en: "wander",
          ru: "бродить, странствовать",
          example: "Not all those who wander are lost.",
          image: "",
          score: 0,
          dueAt: Date.now()
        },
        {
          id: crypto.randomUUID(),
          en: "cloak",
          ru: "плащ",
          example: "He wrapped his cloak around him.",
          image: "",
          score: 2,
          dueAt: Date.now() + 86400000
        }
      ]
    }
  ]
};

let state = loadState();
let imageCache = loadImageCache();
refreshGeneratedImages();
let activeCollectionId = state.collections[0]?.id || null;
let mixMode = false;
let activeTab = "today";
let cardIndex = 0;
let quizMode = "en-ru";
let currentQuizWord = null;
let translationTimer = null;
let lastTranslationQuery = "";
let autoTranslationActive = true;
let wordFilter = "all";
let wordSearch = "";
let dailyGoal = loadDailyGoal();
let streak = loadStreak();
let lastAddedWordId = null;
let audioContext = null;
let audioUnlocked = false;
let deferredInstallPrompt = null;

const els = {
  collectionForm: document.querySelector("#collectionForm"),
  collectionName: document.querySelector("#collectionName"),
  collectionList: document.querySelector("#collectionList"),
  activeTitle: document.querySelector("#activeTitle"),
  totalWords: document.querySelector("#totalWords"),
  knownWords: document.querySelector("#knownWords"),
  dueWords: document.querySelector("#dueWords"),
  starBank: document.querySelector("#starBank"),
  emptyState: document.querySelector("#emptyState"),
  workspace: document.querySelector("#workspace"),
  wordForm: document.querySelector("#wordForm"),
  wordEnglish: document.querySelector("#wordEnglish"),
  wordRussian: document.querySelector("#wordRussian"),
  wordExample: document.querySelector("#wordExample"),
  translationSuggestions: document.querySelector("#translationSuggestions"),
  generatedPreview: document.querySelector("#generatedPreview"),
  wordSearch: document.querySelector("#wordSearch"),
  dailyProgress: document.querySelector("#dailyProgress"),
  dailyProgressBar: document.querySelector("#dailyProgressBar"),
  todayDashboard: document.querySelector("#todayDashboard"),
  installButton: document.querySelector("#installButton"),
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  importFile: document.querySelector("#importFile"),
  wordList: document.querySelector("#wordList"),
  wordTemplate: document.querySelector("#wordTemplate"),
  sampleButton: document.querySelector("#sampleButton"),
  flashcard: document.querySelector("#flashcard"),
  prevCard: document.querySelector("#prevCard"),
  nextCard: document.querySelector("#nextCard"),
  quizCard: document.querySelector("#quizCard")
};

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
}

function updateInstallButton() {
  if (!els.installButton) return;
  els.installButton.classList.toggle("hidden", !deferredInstallPrompt || isStandaloneApp());
}

function registerPwa() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // PWA is an upgrade path; the app should still work if registration is blocked.
    });
  });
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return sampleData;

  try {
    const parsed = JSON.parse(saved);
    return parsed.collections ? parsed : sampleData;
  } catch {
    return sampleData;
  }
}

function loadImageCache() {
  const saved = localStorage.getItem(IMAGE_CACHE_KEY);

  try {
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveImageCache() {
  localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(imageCache));
}

function getTodayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function diffDays(fromKey, toKey = getTodayKey()) {
  if (!fromKey) return Infinity;
  const from = new Date(`${fromKey}T00:00:00`);
  const to = new Date(`${toKey}T00:00:00`);
  return Math.round((to - from) / 86400000);
}

function createEmptyDailyGoal() {
  return {
    date: getTodayKey(),
    completed: false,
    modes: Object.fromEntries(QUIZ_MODES.map((mode) => [mode, []]))
  };
}

function normalizeDailyGoal(goal) {
  const normalized = createEmptyDailyGoal();
  if (!goal || goal.date !== normalized.date) return normalized;

  QUIZ_MODES.forEach((mode) => {
    normalized.modes[mode] = Array.isArray(goal.modes?.[mode]) ? goal.modes[mode] : [];
  });
  normalized.completed = Boolean(goal.completed);
  return normalized;
}

function loadDailyGoal() {
  const saved = localStorage.getItem(DAILY_GOAL_KEY);

  try {
    const parsed = saved ? JSON.parse(saved) : null;
    return normalizeDailyGoal(parsed);
  } catch {
    // Ignore damaged progress data and start a fresh day.
  }

  return createEmptyDailyGoal();
}

function loadStreak() {
  const saved = localStorage.getItem(STREAK_KEY);

  try {
    const parsed = saved ? JSON.parse(saved) : null;
    if (!parsed) return { stars: 0, lastStudyDate: "", lastAwardDate: "" };
    if (parsed.lastStudyDate && diffDays(parsed.lastStudyDate) > 1) {
      return { stars: 0, lastStudyDate: "", lastAwardDate: "" };
    }
    return {
      stars: Math.max(0, Math.min(MAX_STARS, Number(parsed.stars) || 0)),
      lastStudyDate: parsed.lastStudyDate || "",
      lastAwardDate: parsed.lastAwardDate || ""
    };
  } catch {
    return { stars: 0, lastStudyDate: "", lastAwardDate: "" };
  }
}

function saveDailyGoal() {
  localStorage.setItem(DAILY_GOAL_KEY, JSON.stringify(dailyGoal));
}

function saveStreak() {
  localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
}

function getModeProgress(mode) {
  return Math.min((dailyGoal.modes[mode] || []).length, DAILY_GOAL);
}

function isDailyGoalComplete() {
  return QUIZ_MODES.every((mode) => getModeProgress(mode) >= DAILY_GOAL);
}

function recordLessonProgress(wordId, mode, isCorrect) {
  if (!isCorrect || !QUIZ_MODES.includes(mode)) {
    renderDailyGoal();
    return { counted: false, completed: dailyGoal.completed };
  }

  const previousStudyDate = streak.lastStudyDate;
  const modeWords = dailyGoal.modes[mode];
  const wasAlreadyCounted = modeWords.includes(wordId);
  if (!modeWords.includes(wordId)) {
    modeWords.push(wordId);
  }

  if (isDailyGoalComplete() && !dailyGoal.completed) {
    dailyGoal.completed = true;
    awardDailyStar(previousStudyDate);
  }

  streak.lastStudyDate = getTodayKey();
  saveStreak();
  saveDailyGoal();
  renderDailyGoal();
  return { counted: !wasAlreadyCounted, completed: dailyGoal.completed };
}

function awardDailyStar(previousStudyDate) {
  const today = getTodayKey();
  if (streak.lastAwardDate === today) return;

  const yesterdayWasStudy = diffDays(previousStudyDate, today) === 1;
  streak.stars = yesterdayWasStudy ? Math.min(MAX_STARS, streak.stars + 1) : 1;
  streak.lastStudyDate = today;
  streak.lastAwardDate = today;
  saveStreak();
  renderStars(true);
  launchStarBurst();
}

function renderDailyGoal() {
  const completed = QUIZ_MODES.reduce((sum, mode) => sum + getModeProgress(mode), 0);
  const total = DAILY_GOAL * QUIZ_MODES.length;
  const percent = Math.round((completed / total) * 100);
  const collection = getActiveCollection();
  const wordCount = collection?.words.length || 0;
  els.dailyProgress.textContent = `${completed} / ${total}`;
  els.dailyProgressBar.style.width = `${percent}%`;
  document.querySelectorAll("[data-mode-progress]").forEach((node) => {
    const mode = node.dataset.modeProgress;
    const progress = getModeProgress(mode);
    const left = Math.max(0, DAILY_GOAL - progress);
    const wordsMissing = Math.max(0, DAILY_GOAL - wordCount);

    if (wordsMissing && progress >= wordCount) {
      node.textContent = `${progress} / ${DAILY_GOAL}, добавь ${wordsMissing} слов`;
    } else {
      node.textContent = left ? `${progress} / ${DAILY_GOAL}, осталось ${left}` : `${DAILY_GOAL} / ${DAILY_GOAL}, готово`;
    }
  });
}

function renderStars(highlight = false) {
  els.starBank.innerHTML = "";
  for (let index = 0; index < MAX_STARS; index += 1) {
    const star = document.createElement("span");
    star.className = `star ${index < streak.stars ? "filled" : ""}`;
    if (highlight && index === streak.stars - 1) star.classList.add("star-earned");
    star.textContent = "★";
    els.starBank.append(star);
  }
}

function launchStarBurst() {
  const burst = document.createElement("div");
  burst.className = "star-burst";
  burst.textContent = "★";
  document.body.append(burst);
  setTimeout(() => burst.remove(), 1200);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getActiveCollection() {
  if (mixMode) {
    return {
      id: "mixed",
      name: "Все книги",
      mixed: true,
      words: state.collections.flatMap((collection) =>
        collection.words.map((word) => ({
          ...word,
          collectionId: collection.id,
          collectionName: collection.name
        }))
      )
    };
  }

  return state.collections.find((collection) => collection.id === activeCollectionId) || null;
}

function findStoredWord(word) {
  if (!word) return null;
  if (!word.collectionId) return word;
  const collection = state.collections.find((item) => item.id === word.collectionId);
  return collection?.words.find((item) => item.id === word.id) || null;
}

function refreshGeneratedImages() {
  let changed = false;
  state.collections.forEach((collection) => {
    collection.words.forEach((word) => {
      const imageKey = getImageCacheKey(word.en, word.ru);
      if (word.imageKey !== imageKey || !word.image) {
        word.imageKey = imageKey;
        word.image = generateWordImage(word.en, word.ru);
        changed = true;
      }
    });
  });
  if (changed) saveState();
}

function normalize(value) {
  return value.trim().toLowerCase().replaceAll("ё", "е");
}

function uniqueTranslations(values) {
  const seen = new Set();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

async function fetchTranslations(word) {
  const query = word.trim().toLowerCase();
  if (!query) return [];

  const fallback = fallbackTranslations[query] || [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(query)}&langpair=en|ru`,
      { signal: controller.signal }
    );
    if (!response.ok) throw new Error("Translation request failed");
    const data = await response.json();
    const online = [
      data.responseData?.translatedText,
      ...(data.matches || []).map((match) => match.translation)
    ];
    return uniqueTranslations([...online, ...fallback]);
  } catch {
    return uniqueTranslations(fallback);
  } finally {
    clearTimeout(timeoutId);
  }
}

function showTranslationStatus(text) {
  els.translationSuggestions.classList.remove("hidden");
  els.translationSuggestions.innerHTML = `<div class="suggestion-note">${escapeHtml(text)}</div>`;
}

function hideTranslationSuggestions() {
  els.translationSuggestions.classList.add("hidden");
  els.translationSuggestions.innerHTML = "";
}

function renderTranslationSuggestions(translations) {
  if (!translations.length) {
    showTranslationStatus("Перевод не найден. Можно ввести вручную.");
    return;
  }

  if (autoTranslationActive || !els.wordRussian.value.trim()) {
    els.wordRussian.value = translations[0];
    renderGeneratedPreview();
  }

  if (translations.length === 1) {
    hideTranslationSuggestions();
    return;
  }

  els.translationSuggestions.classList.remove("hidden");
  els.translationSuggestions.innerHTML = translations
    .map((translation) => `<button type="button" data-translation="${escapeHtml(translation)}">${escapeHtml(translation)}</button>`)
    .join("");

  els.translationSuggestions.querySelectorAll("[data-translation]").forEach((button) => {
    button.addEventListener("click", () => {
      els.wordRussian.value = button.dataset.translation;
      autoTranslationActive = true;
      hideTranslationSuggestions();
      renderGeneratedPreview();
    });
  });
}

function requestTranslationsForCurrentWord() {
  const word = els.wordEnglish.value.trim();
  clearTimeout(translationTimer);

  if (word.length < 2) {
    hideTranslationSuggestions();
    renderGeneratedPreview();
    return;
  }

  translationTimer = setTimeout(async () => {
    if (word === lastTranslationQuery) return;
    lastTranslationQuery = word;
    showTranslationStatus("Ищу перевод...");
    const translations = await fetchTranslations(word);
    if (els.wordEnglish.value.trim() !== word) return;
    renderTranslationSuggestions(translations);
  }, TRANSLATION_DEBOUNCE_MS);
}

function shortLabel(word) {
  return word.en.slice(0, 2);
}

function statusText(score) {
  if (score >= 4) return "знаю";
  if (score >= 2) return "почти";
  if (score === 1) return "учу";
  return "новое";
}

function matchesWordFilter(word) {
  if (wordFilter === "due") return word.dueAt <= Date.now();
  if (wordFilter === "new") return word.score === 0;
  if (wordFilter === "known") return word.score >= 4;
  return true;
}

function matchesWordSearch(word) {
  if (!wordSearch) return true;
  const query = normalize(wordSearch);
  return [word.en, word.ru, word.example].some((value) => normalize(value || "").includes(query));
}

function getFilteredWords(words) {
  return words.filter((word) => matchesWordFilter(word) && matchesWordSearch(word));
}

function scheduleWord(word, isCorrect, shouldRender = true) {
  const storedWord = findStoredWord(word);
  if (!storedWord) return;

  storedWord.score = Math.max(0, Math.min(5, storedWord.score + (isCorrect ? 1 : -1)));
  const days = [0, 1, 2, 4, 7, 14][storedWord.score] || 14;
  storedWord.dueAt = Date.now() + days * 86400000;
  saveState();
  if (shouldRender) render();
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.86;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  return audioContext;
}

async function unlockAudio() {
  if (audioUnlocked) return;
  const context = getAudioContext();
  if (!context) return;

  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return;
    }
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.01);
  audioUnlocked = true;
}

function playTone(frequency, duration, delay = 0, type = "sine", volume = 0.06) {
  const context = getAudioContext();
  if (!context) return;

  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

async function playAnswerSound(isCorrect) {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return;
    }
  }

  if (isCorrect) {
    playTone(659.25, 0.13, 0, "sine", 0.09);
    playTone(987.77, 0.18, 0.12, "sine", 0.075);
  } else {
    playTone(246.94, 0.17, 0, "triangle", 0.085);
    playTone(185, 0.24, 0.12, "triangle", 0.075);
  }
}

function stableSeed(value) {
  return String(value)
    .split("")
    .reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
}

function getImageCacheKey(word, translation) {
  return normalize(`${word}|${translation}`);
}

function buildImagePrompt(word, translation) {
  const cleanWord = word.trim() || "word";
  const cleanTranslation = translation.trim() || "meaning";
  return [
    "one clear educational vocabulary image",
    `concept: ${cleanWord}`,
    `meaning: ${cleanTranslation}`,
    "show exactly one main object or one simple everyday situation that explains the word",
    "clean realistic storybook illustration, sharp subject, simple background, strong silhouette",
    "minimal composition, no clutter, no collage, no extra random objects, no distorted objects",
    "no written text, no letters, no captions, no watermark, no logo",
    "16:9 landscape flashcard image, centered subject, easy to understand in one second"
  ].join(", ");
}

function generateWordImage(word, translation) {
  const cacheKey = getImageCacheKey(word, translation);
  if (imageCache[cacheKey]) return imageCache[cacheKey];

  const prompt = buildImagePrompt(word, translation);
  const seed = stableSeed(`${word}|${translation}`);
  const url = `${AI_IMAGE_ENDPOINT}${encodeURIComponent(prompt)}?width=1024&height=576&seed=${seed}&nologo=true&enhance=true&model=flux`;
  imageCache[cacheKey] = url;
  saveImageCache();
  return url;
}

function generateFallbackImage(word, translation) {
  const cleanWord = word.trim() || "word";
  const cleanTranslation = translation.trim() || "перевод";
  const scene = getSceneMarkup(cleanWord, cleanTranslation);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${scene.sky}"/>
          <stop offset="1" stop-color="${scene.ground}"/>
        </linearGradient>
      </defs>
      <rect width="640" height="360" rx="28" fill="url(#bg)"/>
      <rect x="22" y="22" width="596" height="316" rx="24" fill="#ffffff" opacity="0.70"/>
      ${scene.markup}
      <rect x="34" y="262" width="572" height="58" rx="16" fill="#ffffff" opacity="0.92"/>
      <text x="58" y="298" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800" fill="#1f2933">${escapeSvg(cleanWord)}</text>
      <text x="390" y="298" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#687382" text-anchor="middle">${escapeSvg(cleanTranslation)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getSceneMarkup(word, translation) {
  const key = `${word} ${translation}`.toLowerCase();
  const includes = (...values) => values.some((value) => key.includes(value));
  const common = {
    sky: "#dff1f4",
    ground: "#eaf2df"
  };

  if (includes("castle", "замок", "крепость")) return { ...common, markup: sceneCastle() };
  if (includes("forest", "лес")) return { ...common, markup: sceneForest() };
  if (includes("river", "река")) return { sky: "#dff3ff", ground: "#dbeefa", markup: sceneRiver() };
  if (includes("door", "двер")) return { ...common, markup: sceneDoor() };
  if (includes("house", "home", "дом")) return { ...common, markup: sceneHouse() };
  if (includes("book", "книга")) return { sky: "#f7efe1", ground: "#efe5d6", markup: sceneBook() };
  if (includes("apple", "яблок")) return { sky: "#f5eadf", ground: "#edf4df", markup: sceneApple() };
  if (includes("sword", "меч")) return { sky: "#e8eef5", ground: "#e6e6e6", markup: sceneSword() };
  if (includes("shadow", "тень")) return { sky: "#dfe5ec", ground: "#e9ecef", markup: sceneShadow() };
  if (includes("light", "свет")) return { sky: "#fff3cc", ground: "#f4ead7", markup: sceneLight() };
  if (includes("cloak", "плащ", "мантия")) return { sky: "#e9edf4", ground: "#e1e7ed", markup: sceneCloak() };
  if (includes("wizard", "волшеб")) return { sky: "#ebe7f6", ground: "#e5f1ed", markup: sceneWizard() };
  if (includes("king", "король")) return { sky: "#f7edcf", ground: "#efe4d0", markup: sceneKing() };
  if (includes("journey", "wander", "брод", "странств", "путеше")) return { sky: "#e3f0f4", ground: "#e8eddc", markup: sceneJourney() };
  if (includes("glimpse", "взгляд", "проблеск")) return { sky: "#edf3f6", ground: "#e8ebe5", markup: sceneGlimpse() };
  if (includes("burrow", "нора")) return { sky: "#e6f0dd", ground: "#dac6a8", markup: sceneBurrow() };
  if (includes("hill", "холм")) return { sky: "#e5f3f6", ground: "#dfe9cf", markup: sceneHill() };
  if (includes("whisper", "шеп")) return { sky: "#e8edf2", ground: "#eef1f4", markup: sceneWhisper() };

  return { sky: "#eef3f1", ground: "#f5efe4", markup: sceneAssociation(word, translation) };
}

function sceneCastle() {
  return `
    <rect x="172" y="126" width="296" height="130" rx="10" fill="#b8c3cc"/>
    <rect x="198" y="84" width="58" height="172" rx="8" fill="#9eabb6"/>
    <rect x="384" y="84" width="58" height="172" rx="8" fill="#9eabb6"/>
    <path d="M198 84 h18 v-24 h20 v24 h20 v-24 h20 v24 h18 v34 h-96z" fill="#82919d"/>
    <path d="M384 84 h18 v-24 h20 v24 h20 v-24 h20 v24 h18 v34 h-96z" fill="#82919d"/>
    <path d="M276 126 h88 v-42 l-44-34-44 34z" fill="#8fa0ad"/>
    <path d="M300 256 v-62 q20-34 40 0 v62z" fill="#5d4a3f"/>
    <rect x="214" y="146" width="28" height="38" rx="14" fill="#eef6f8"/>
    <rect x="398" y="146" width="28" height="38" rx="14" fill="#eef6f8"/>
    <path d="M70 256 C162 222 246 232 320 250 C398 270 486 220 570 256 V338 H70z" fill="#9fbe7d" opacity="0.75"/>
  `;
}

function sceneForest() {
  return `
    <path d="M100 250 L154 92 L208 250z" fill="#2f7d58"/>
    <path d="M204 250 L270 70 L336 250z" fill="#1f6f4e"/>
    <path d="M330 250 L398 96 L466 250z" fill="#35885f"/>
    <path d="M444 250 L506 112 L568 250z" fill="#276f52"/>
    <rect x="145" y="218" width="18" height="54" fill="#8b6242"/>
    <rect x="264" y="214" width="20" height="58" fill="#805a3e"/>
    <rect x="395" y="218" width="18" height="54" fill="#8b6242"/>
    <path d="M70 270 C170 240 294 250 372 270 C460 294 520 254 590 278 V338 H70z" fill="#b7c987"/>
  `;
}

function sceneRiver() {
  return `
    <path d="M70 250 C164 204 226 296 320 248 C410 202 486 252 570 218 V338 H70z" fill="#69aee6"/>
    <path d="M80 280 C176 238 244 306 330 264 C422 218 488 266 560 236" fill="none" stroke="#ffffff" stroke-width="10" opacity="0.7"/>
    <path d="M96 236 C172 186 232 190 300 226" fill="none" stroke="#8fb56d" stroke-width="30" stroke-linecap="round"/>
    <path d="M390 220 C460 178 510 184 558 198" fill="none" stroke="#8fb56d" stroke-width="28" stroke-linecap="round"/>
  `;
}

function sceneDoor() {
  return `
    <rect x="232" y="76" width="176" height="202" rx="12" fill="#9b6545"/>
    <rect x="254" y="98" width="132" height="180" rx="8" fill="#b87a50"/>
    <circle cx="368" cy="190" r="8" fill="#f3c35f"/>
    <path d="M214 278 H426" stroke="#6f4d36" stroke-width="16" stroke-linecap="round"/>
    <path d="M414 134 C472 134 506 164 524 214" fill="none" stroke="#a8c6d4" stroke-width="10" stroke-linecap="round"/>
  `;
}

function sceneHouse() {
  return `
    <path d="M168 166 L320 66 L472 166z" fill="#c8584a"/>
    <rect x="198" y="158" width="244" height="112" rx="14" fill="#f2d8b8"/>
    <rect x="290" y="204" width="60" height="66" rx="8" fill="#8a5b43"/>
    <rect x="226" y="188" width="42" height="38" rx="6" fill="#dff3ff"/>
    <rect x="372" y="188" width="42" height="38" rx="6" fill="#dff3ff"/>
    <path d="M96 278 C180 248 270 254 338 274 C414 296 494 254 556 276 V338 H96z" fill="#a9c97f"/>
  `;
}

function sceneBook() {
  return `
    <path d="M126 110 Q222 74 320 126 V270 Q220 222 126 260z" fill="#ffffff"/>
    <path d="M514 110 Q418 74 320 126 V270 Q420 222 514 260z" fill="#f8f1e6"/>
    <path d="M320 126 V270" stroke="#c5b49c" stroke-width="8"/>
    <path d="M164 142 C208 124 252 130 292 150 M164 178 C212 158 252 166 292 184 M164 214 C214 196 252 202 292 220" stroke="#9b8d7b" stroke-width="8" stroke-linecap="round"/>
    <path d="M348 148 C390 128 434 126 476 142 M348 184 C394 162 434 164 476 178 M348 220 C392 200 434 202 476 212" stroke="#9b8d7b" stroke-width="8" stroke-linecap="round"/>
  `;
}

function sceneApple() {
  return `
    <path d="M302 126 C252 86 180 130 198 204 C216 282 284 276 320 244 C356 276 424 282 442 204 C460 130 388 86 338 126 C330 132 310 132 302 126z" fill="#d84b3f"/>
    <path d="M320 126 C318 92 336 72 366 58" fill="none" stroke="#6d4c36" stroke-width="12" stroke-linecap="round"/>
    <path d="M364 60 C408 56 426 82 424 106 C388 108 366 92 364 60z" fill="#4e9b63"/>
    <ellipse cx="276" cy="170" rx="18" ry="30" fill="#ffffff" opacity="0.28"/>
    <path d="M130 282 C236 254 404 254 510 282 V338 H130z" fill="#b8cc83"/>
  `;
}

function sceneSword() {
  return `
    <path d="M342 62 L366 86 L276 218 L252 194z" fill="#d8e2e8"/>
    <path d="M342 62 L326 178 L276 218z" fill="#b9c7d0"/>
    <rect x="224" y="190" width="102" height="22" rx="11" transform="rotate(45 275 201)" fill="#c49435"/>
    <rect x="206" y="220" width="86" height="34" rx="12" transform="rotate(45 249 237)" fill="#5d4a3f"/>
    <circle cx="218" cy="268" r="18" fill="#c49435"/>
    <path d="M132 278 H514" stroke="#b0b9bf" stroke-width="12" stroke-linecap="round"/>
  `;
}

function sceneShadow() {
  return `
    <circle cx="238" cy="102" r="44" fill="#f4c95d"/>
    <rect x="330" y="122" width="64" height="112" rx="28" fill="#687382"/>
    <circle cx="362" cy="92" r="30" fill="#687382"/>
    <path d="M356 232 C270 250 214 274 144 310 H448 C420 274 394 250 356 232z" fill="#1f2933" opacity="0.30"/>
    <path d="M96 272 H552" stroke="#bac2ca" stroke-width="12" stroke-linecap="round"/>
  `;
}

function sceneLight() {
  return `
    <circle cx="320" cy="128" r="56" fill="#f8ce4a"/>
    <g stroke="#f8ce4a" stroke-width="12" stroke-linecap="round">
      <path d="M320 42 V18"/><path d="M320 238 V214"/><path d="M234 128 H208"/><path d="M432 128 H406"/>
      <path d="M260 68 L240 48"/><path d="M380 188 L400 208"/><path d="M380 68 L400 48"/><path d="M260 188 L240 208"/>
    </g>
    <path d="M206 270 C250 222 390 222 434 270z" fill="#ffffff" opacity="0.58"/>
  `;
}

function sceneCloak() {
  return `
    <circle cx="320" cy="86" r="32" fill="#d7a77a"/>
    <path d="M276 116 C230 164 218 224 206 286 H434 C422 224 410 164 364 116 C346 132 294 132 276 116z" fill="#40536b"/>
    <path d="M280 124 C286 178 284 226 266 286" fill="none" stroke="#2d3a4b" stroke-width="14" stroke-linecap="round"/>
    <path d="M360 124 C354 178 356 226 374 286" fill="none" stroke="#2d3a4b" stroke-width="14" stroke-linecap="round"/>
    <circle cx="320" cy="138" r="10" fill="#d99a2b"/>
  `;
}

function sceneWizard() {
  return `
    <path d="M284 112 L320 36 L356 112z" fill="#4d5a9a"/>
    <circle cx="320" cy="122" r="32" fill="#d7a77a"/>
    <path d="M270 156 H370 L398 284 H242z" fill="#5b6ab5"/>
    <path d="M392 116 L478 64" stroke="#7b5f3d" stroke-width="10" stroke-linecap="round"/>
    <path d="M484 58 L498 36 M484 58 L510 62 M484 58 L496 82" stroke="#f8ce4a" stroke-width="8" stroke-linecap="round"/>
    <path d="M286 148 C306 166 334 166 354 148" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
  `;
}

function sceneKing() {
  return `
    <path d="M242 116 L278 72 L320 116 L362 72 L398 116 V158 H242z" fill="#d99a2b"/>
    <circle cx="320" cy="174" r="46" fill="#d7a77a"/>
    <path d="M236 260 C252 208 388 208 404 260 V292 H236z" fill="#7b3f57"/>
    <circle cx="278" cy="128" r="8" fill="#e8f1f4"/><circle cx="320" cy="128" r="8" fill="#e8f1f4"/><circle cx="362" cy="128" r="8" fill="#e8f1f4"/>
  `;
}

function sceneJourney() {
  return `
    <path d="M86 276 C178 178 236 322 320 222 C398 130 466 214 558 126" fill="none" stroke="#c09255" stroke-width="18" stroke-linecap="round"/>
    <path d="M98 284 C184 204 240 330 326 232 C402 146 468 226 552 140" fill="none" stroke="#f5e6c8" stroke-width="8" stroke-linecap="round"/>
    <circle cx="214" cy="190" r="20" fill="#2f8f83"/>
    <path d="M214 210 V260 M214 226 L184 250 M214 226 L244 250" stroke="#2f8f83" stroke-width="10" stroke-linecap="round"/>
    <path d="M474 108 L550 108 L550 156 L474 156z" fill="#c94f64"/>
  `;
}

function sceneGlimpse() {
  return `
    <rect x="150" y="72" width="340" height="190" rx="18" fill="#7d8f9f"/>
    <rect x="176" y="98" width="288" height="138" rx="10" fill="#dff3ff"/>
    <path d="M320 98 V236 M176 167 H464" stroke="#7d8f9f" stroke-width="10"/>
    <path d="M238 210 C276 150 364 150 402 210 C364 234 276 234 238 210z" fill="#ffffff" opacity="0.86"/>
    <circle cx="320" cy="204" r="20" fill="#2f73c8"/>
    <path d="M498 104 C536 130 556 166 560 214" fill="none" stroke="#d99a2b" stroke-width="12" stroke-linecap="round"/>
  `;
}

function sceneBurrow() {
  return `
    <path d="M112 260 C188 140 452 140 528 260z" fill="#a88967"/>
    <ellipse cx="320" cy="250" rx="92" ry="68" fill="#4b382b"/>
    <ellipse cx="320" cy="262" rx="58" ry="42" fill="#2d211a"/>
    <path d="M118 260 C210 232 438 232 522 260 V338 H118z" fill="#8fb56d"/>
    <path d="M168 230 C194 178 232 158 282 148" fill="none" stroke="#6f8f4e" stroke-width="14" stroke-linecap="round"/>
  `;
}

function sceneHill() {
  return `
    <path d="M70 278 C180 114 454 114 570 278 V338 H70z" fill="#9fbe7d"/>
    <path d="M120 288 C220 180 414 180 520 288" fill="none" stroke="#799b5c" stroke-width="12" stroke-linecap="round"/>
    <circle cx="482" cy="82" r="34" fill="#f2c85b"/>
  `;
}

function sceneWhisper() {
  return `
    <circle cx="246" cy="130" r="36" fill="#d7a77a"/>
    <path d="M196 248 C206 182 286 182 296 248z" fill="#5d7fa3"/>
    <circle cx="394" cy="130" r="36" fill="#d7a77a"/>
    <path d="M344 248 C354 182 434 182 444 248z" fill="#9d6b7b"/>
    <path d="M286 122 C320 100 350 100 382 122" fill="none" stroke="#8b9aa5" stroke-width="7" stroke-dasharray="10 12" stroke-linecap="round"/>
    <text x="320" y="92" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#687382" text-anchor="middle">shh...</text>
  `;
}

function sceneAssociation(word, translation) {
  return `
    <rect x="118" y="86" width="178" height="128" rx="16" fill="#ffffff"/>
    <path d="M138 122 H276 M138 156 H244 M138 190 H266" stroke="#a5b2bc" stroke-width="10" stroke-linecap="round"/>
    <circle cx="426" cy="132" r="42" fill="#d7a77a"/>
    <path d="M352 252 C368 186 484 186 500 252z" fill="#2f8f83"/>
    <path d="M292 150 C334 128 360 126 392 132" fill="none" stroke="#d99a2b" stroke-width="12" stroke-linecap="round"/>
    <rect x="330" y="64" width="178" height="48" rx="12" fill="#ffffff" opacity="0.92"/>
    <text x="419" y="96" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#1f2933" text-anchor="middle">${escapeSvg(word)}</text>
    <text x="320" y="238" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#687382" text-anchor="middle">ассоциация: ${escapeSvg(translation)}</text>
  `;
}

function escapeSvg(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderGeneratedPreview() {
  const word = els.wordEnglish.value.trim();
  const translation = els.wordRussian.value.trim();
  const image = word && translation ? generateWordImage(word, translation) : "";

  els.generatedPreview.innerHTML = "";
  if (!image) {
    els.generatedPreview.textContent = "Сцена появится после перевода";
    return;
  }

  const img = document.createElement("img");
  img.src = image;
  img.alt = word || "preview";
  img.onerror = () => {
    img.src = generateFallbackImage(word, translation);
  };
  els.generatedPreview.append(img);
}

function visualNode(word, className = "word-thumb") {
  const node = document.createElement("div");
  node.className = className;

  if (word.image) {
    const img = document.createElement("img");
    img.src = word.image;
    img.alt = word.en;
    img.onerror = () => {
      img.src = generateFallbackImage(word.en, word.ru);
      img.onerror = null;
    };
    node.append(img);
  } else {
    node.textContent = shortLabel(word);
  }

  return node;
}

function renderCollections() {
  els.collectionList.innerHTML = "";

  if (state.collections.length > 2) {
    const mixedButton = document.createElement("button");
    mixedButton.type = "button";
    mixedButton.className = `collection-button mix-button ${mixMode ? "active" : ""}`;
    const allWords = state.collections.reduce((sum, collection) => sum + collection.words.length, 0);
    mixedButton.innerHTML = `
      <span>
        <strong>Смешать книги</strong>
        <span>${allWords} слов из ${state.collections.length} папок</span>
      </span>
      <span>mix</span>
    `;
    mixedButton.addEventListener("click", () => {
      mixMode = true;
      cardIndex = 0;
      render();
    });
    els.collectionList.append(mixedButton);
  }

  state.collections.forEach((collection) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `collection-button ${!mixMode && collection.id === activeCollectionId ? "active" : ""}`;
    button.innerHTML = `
      <span>
        <strong>${escapeHtml(collection.name)}</strong>
        <span>${collection.words.length} слов</span>
      </span>
      <span>${collection.words.filter((word) => word.dueAt <= Date.now()).length}</span>
    `;
    button.addEventListener("click", () => {
      mixMode = false;
      activeCollectionId = collection.id;
      cardIndex = 0;
      render();
    });
    els.collectionList.append(button);
  });
}

function renderTopbar(collection) {
  els.activeTitle.textContent = collection ? collection.name : "Выберите книгу";
  const words = collection?.words || [];
  els.totalWords.textContent = words.length;
  els.knownWords.textContent = words.filter((word) => word.score >= 4).length;
  els.dueWords.textContent = words.filter((word) => word.dueAt <= Date.now()).length;
  els.emptyState.classList.toggle("hidden", Boolean(collection));
  els.workspace.classList.toggle("hidden", !collection);
}

function renderWords(collection) {
  els.wordList.innerHTML = "";

  const visibleWords = getFilteredWords(collection.words);

  if (!collection.words.length) {
    els.wordList.innerHTML = `<div class="empty-list">Пока нет слов. Добавь первое слово из книги.</div>`;
    return;
  }

  if (!visibleWords.length) {
    els.wordList.innerHTML = `<div class="empty-list">По этому фильтру слов не найдено.</div>`;
    return;
  }

  visibleWords
    .slice()
    .sort((a, b) => a.dueAt - b.dueAt)
    .forEach((word) => {
      const item = els.wordTemplate.content.firstElementChild.cloneNode(true);
      if (word.id === lastAddedWordId) {
        item.classList.add("just-added");
        setTimeout(() => {
          if (lastAddedWordId === word.id) lastAddedWordId = null;
        }, 900);
      }
      item.querySelector(".word-thumb").replaceWith(visualNode(word));
      item.querySelector("h4").textContent = word.en;
      item.querySelector(".status-pill").textContent = statusText(word.score);
      item.querySelector(".translation").textContent = word.ru;
      item.querySelector(".example").textContent = collection.mixed
        ? `${word.collectionName} · ${word.example || "Без примера"}`
        : word.example || "Без примера";
      item.querySelector(".speak").addEventListener("click", () => speak(word.en));
      item.querySelector(".bump").addEventListener("click", () => scheduleWord(word, true));
      item.querySelector(".forget").addEventListener("click", () => scheduleWord(word, false));
      const deleteButton = item.querySelector(".delete");
      if (collection.mixed) {
        deleteButton.disabled = true;
        deleteButton.title = "Удаление доступно внутри конкретной папки";
      } else {
        deleteButton.addEventListener("click", () => deleteWord(collection, word.id));
      }
      els.wordList.append(item);
    });
}

function renderToday(collection) {
  if (!collection) return;

  const words = collection.words || [];
  const scopeText = collection.mixed ? `Смешанный режим: ${state.collections.length} папок вместе.` : "Работаем с текущей папкой.";
  const due = words.filter((word) => word.dueAt <= Date.now()).length;
  const newWords = words.filter((word) => word.score === 0).length;
  const known = words.filter((word) => word.score >= 4).length;
  const completed = QUIZ_MODES.reduce((sum, mode) => sum + getModeProgress(mode), 0);
  const total = DAILY_GOAL * QUIZ_MODES.length;
  const percent = Math.round((completed / total) * 100);

  els.todayDashboard.innerHTML = `
    <section class="today-hero">
      <div>
        <p class="eyebrow">План на сегодня</p>
        <h3>${escapeHtml(scopeText)}</h3>
        <p>Закрой 4 упражнения по ${DAILY_GOAL} слов. Приложение сначала дает слова, которые еще не засчитаны в конкретном режиме.</p>
      </div>
      <div class="today-meter">
        <strong>${percent}%</strong>
        <span>${completed} / ${total}</span>
      </div>
    </section>
    <section class="today-cards">
      ${renderTodayMetric("К повтору", due)}
      ${renderTodayMetric("Новые", newWords)}
      ${renderTodayMetric("Знаю", known)}
      ${renderTodayMetric("Всего слов", words.length)}
    </section>
    <section class="lesson-grid">
      ${QUIZ_MODES.map((mode) => renderLessonCard(mode, words.length)).join("")}
    </section>
  `;

  els.todayDashboard.querySelectorAll("[data-start-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab("quiz");
      setQuizMode(button.dataset.startMode);
    });
  });
}

function renderTodayMetric(label, value) {
  return `
    <article class="today-card">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </article>
  `;
}

function getModeLabel(mode) {
  return {
    "en-ru": "EN → RU",
    "ru-en": "RU → EN",
    spell: "Правописание",
    listen: "На слух"
  }[mode];
}

function renderLessonCard(mode, wordCount) {
  const progress = getModeProgress(mode);
  const left = Math.max(0, DAILY_GOAL - progress);
  const wordsMissing = Math.max(0, DAILY_GOAL - wordCount);
  const note = wordsMissing && progress >= wordCount ? `Добавь еще ${wordsMissing} слов` : left ? `Осталось ${left}` : "Готово";
  const percent = Math.round((progress / DAILY_GOAL) * 100);

  return `
    <article class="lesson-card">
      <div>
        <h4>${getModeLabel(mode)}</h4>
        <p>${note}</p>
      </div>
      <strong>${progress} / ${DAILY_GOAL}</strong>
      <div class="lesson-track"><span style="width: ${percent}%"></span></div>
      <button type="button" data-start-mode="${mode}">${left ? "Начать" : "Повторить"}</button>
    </article>
  `;
}

function renderCard(collection) {
  const words = collection.words;
  if (!words.length) {
    els.flashcard.innerHTML = `<div class="empty-list">Добавь слова, и здесь появятся карточки.</div>`;
    return;
  }

  cardIndex = (cardIndex + words.length) % words.length;
  const word = words[cardIndex];
  els.flashcard.innerHTML = "";
  els.flashcard.append(visualNode(word, "card-art"));
  els.flashcard.insertAdjacentHTML(
    "beforeend",
    `
      <div class="flashcard-head">
        <div>
          <h3>${escapeHtml(word.en)}</h3>
          <p class="card-hint">Нажми, чтобы открыть перевод</p>
        </div>
        <button class="speak-card" type="button">Слушать</button>
      </div>
      <div class="card-reveal hidden">
        <p class="big-translation">${escapeHtml(word.ru)}</p>
        <p class="example">${escapeHtml(word.example || "Добавь пример из книги, чтобы слово жило в контексте.")}</p>
        <div class="memory-actions">
          <button type="button" data-memory="again">Забыл</button>
          <button type="button" data-memory="hard">Трудно</button>
          <button type="button" data-memory="good">Хорошо</button>
          <button type="button" data-memory="easy">Легко</button>
        </div>
      </div>
    `
  );
  els.flashcard.querySelector(".speak-card").addEventListener("click", (event) => {
    event.stopPropagation();
    speak(word.en);
  });
  els.flashcard.addEventListener("click", () => {
    els.flashcard.querySelector(".card-reveal").classList.remove("hidden");
    els.flashcard.querySelector(".card-hint").textContent = "Перевод открыт";
  });
  els.flashcard.querySelectorAll("[data-memory]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      applyMemoryGrade(word, button.dataset.memory);
    });
  });
}

function applyMemoryGrade(word, grade) {
  const storedWord = findStoredWord(word);
  if (!storedWord) return;

  const delta = {
    again: -2,
    hard: -1,
    good: 1,
    easy: 2
  }[grade];

  storedWord.score = Math.max(0, Math.min(5, storedWord.score + delta));
  const days = { again: 0, hard: 1, good: 4, easy: 10 }[grade];
  storedWord.dueAt = Date.now() + days * 86400000;
  saveState();

  cardIndex += 1;
  const collection = getActiveCollection();
  if (collection) {
    renderTopbar(collection);
    renderWords(collection);
    renderCard(collection);
  }
}

function renderQuiz(collection) {
  const words = collection.words;
  if (!words.length) {
    els.quizCard.innerHTML = `<div class="empty-list">Для теста нужно хотя бы одно слово.</div>`;
    return;
  }

  currentQuizWord = pickQuizWord(words);
  const promptMap = {
    "en-ru": ["Переведи на русский", currentQuizWord.en, currentQuizWord.ru],
    "ru-en": ["Переведи на английский", currentQuizWord.ru, currentQuizWord.en],
    spell: ["Напиши слово по буквам", currentQuizWord.ru, currentQuizWord.en],
    listen: ["Определи слово на слух", "Нажми кнопку и слушай", currentQuizWord.en]
  };
  const [label, question, answer] = promptMap[quizMode];

  if (quizMode === "listen") setTimeout(() => speak(currentQuizWord.en), 200);

  const choices = quizMode === "en-ru" || quizMode === "ru-en" ? buildChoices(words, answer) : "";
  els.quizCard.innerHTML = `
    <p class="prompt">${label}</p>
    <h3>${escapeHtml(question)}</h3>
    ${
      choices
        ? `<div class="choice-grid">${choices.map((choice) => `<button type="button" data-answer="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`).join("")}</div>`
        : `<div class="answer-row"><input id="quizAnswer" type="text" autocomplete="off" placeholder="Ответ" /><button class="primary" id="checkAnswer" type="button">Проверить</button></div>`
    }
    <div id="feedback" class="feedback"></div>
    <button class="ghost-button" id="skipQuiz" type="button">Следующее слово</button>
  `;

  els.quizCard.querySelectorAll("[data-answer]").forEach((button) => {
    button.addEventListener("click", () => checkAnswer(button.dataset.answer, answer));
  });

  els.quizCard.querySelector("#checkAnswer")?.addEventListener("click", () => {
    checkAnswer(els.quizCard.querySelector("#quizAnswer").value, answer);
  });
  els.quizCard.querySelector("#quizAnswer")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      checkAnswer(event.currentTarget.value, answer);
    }
  });
  els.quizCard.querySelector("#skipQuiz").addEventListener("click", () => renderQuiz(collection));
  focusQuizInput();
}

function focusQuizInput() {
  const input = els.quizCard.querySelector("#quizAnswer");
  if (!input) return;

  requestAnimationFrame(() => {
    input.focus({ preventScroll: true });
    input.select();
  });
}

function pickQuizWord(words) {
  const completedForMode = dailyGoal.modes[quizMode] || [];
  const remainingForMode = words.filter((word) => !completedForMode.includes(word.id));
  const available = getModeProgress(quizMode) < DAILY_GOAL && remainingForMode.length ? remainingForMode : words;
  const due = available.filter((word) => word.dueAt <= Date.now());
  const source = due.length ? due : available;
  return source[Math.floor(Math.random() * source.length)];
}

function buildChoices(words, answer) {
  const pool = words
    .map((word) => (quizMode === "en-ru" ? word.ru : word.en))
    .filter((value) => value !== answer);
  const shuffled = [...new Set(pool)].sort(() => Math.random() - 0.5).slice(0, 3);
  return [answer, ...shuffled].sort(() => Math.random() - 0.5);
}

function getAnswerFeedback(isCorrect, answer, progressResult) {
  if (!isCorrect) return `Почти. Правильный ответ: ${answer}`;
  if (progressResult.completed) return "Верно. Цель дня закрыта";
  if (progressResult.counted) return "Верно. Прогресс засчитан";
  return "Верно. Это слово уже засчитано в этом упражнении";
}

function checkAnswer(value, answer) {
  const feedback = els.quizCard.querySelector("#feedback");
  const isCorrect = normalize(value) === normalize(answer);
  playAnswerSound(isCorrect);
  const progressResult = recordLessonProgress(currentQuizWord.id, quizMode, isCorrect);
  feedback.textContent = getAnswerFeedback(isCorrect, answer, progressResult);
  feedback.className = `feedback ${isCorrect ? "good" : "bad"}`;
  scheduleWord(currentQuizWord, isCorrect, false);
  setTimeout(() => {
    const collection = getActiveCollection();
    if (collection && activeTab === "quiz") {
      renderTopbar(collection);
      renderWords(collection);
      renderCard(collection);
      renderDailyGoal();
      renderQuiz(collection);
    }
  }, 900);
}

function deleteWord(collection, wordId) {
  collection.words = collection.words.filter((word) => word.id !== wordId);
  saveState();
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildBackupPayload() {
  const backup = {
    app: "BookWords",
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
    dailyGoal,
    streak,
    imageCache
  };
  return JSON.stringify(backup, null, 2);
}

function downloadBackupFile(fileText) {
  const blob = new Blob([fileText], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bookwords-backup-${getTodayKey()}.json`;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportBackup() {
  const fileText = buildBackupPayload();
  const fileName = `bookwords-backup-${getTodayKey()}.json`;

  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "BookWords backup",
            accept: { "application/json": [".json"] }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(fileText);
      await writable.close();
      return;
    }

    downloadBackupFile(fileText);
  } catch (error) {
    if (error?.name === "AbortError") return;
    downloadBackupFile(fileText);
  }
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const backup = JSON.parse(reader.result);
      const nextState = backup.state || backup;
      if (!nextState.collections || !Array.isArray(nextState.collections)) {
        throw new Error("Invalid backup");
      }

      state = nextState;
      dailyGoal = normalizeDailyGoal(backup.dailyGoal);
      streak = backup.streak ? {
        stars: Math.max(0, Math.min(MAX_STARS, Number(backup.streak.stars) || 0)),
        lastStudyDate: backup.streak.lastStudyDate || "",
        lastAwardDate: backup.streak.lastAwardDate || ""
      } : loadStreak();
      imageCache = backup.imageCache && typeof backup.imageCache === "object" ? backup.imageCache : {};
      activeCollectionId = state.collections[0]?.id || null;
      cardIndex = 0;

      saveState();
      saveDailyGoal();
      saveStreak();
      saveImageCache();
      refreshGeneratedImages();
      render();
    } catch {
      alert("Не удалось импортировать файл. Проверь, что это backup BookWords.");
    } finally {
      els.importFile.value = "";
    }
  });
  reader.readAsText(file);
}

function render() {
  const collection = getActiveCollection();
  renderCollections();
  renderTopbar(collection);
  renderDailyGoal();
  renderStars();

  if (!collection) return;
  renderToday(collection);
  renderWords(collection);
  renderCard(collection);
  renderQuiz(collection);
}

function setActiveTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelector(`#${tabName}View`).classList.add("active");
}

function setQuizMode(modeName) {
  quizMode = modeName;
  document.querySelectorAll(".mode-button").forEach((mode) => {
    mode.classList.toggle("active", mode.dataset.mode === modeName);
  });
  const collection = getActiveCollection();
  if (collection) renderQuiz(collection);
}

els.collectionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.collectionName.value.trim();
  if (!name) return;

  const collection = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    words: []
  };
  state.collections.unshift(collection);
  activeCollectionId = collection.id;
  els.collectionName.value = "";
  saveState();
  render();
});

["pointerdown", "touchstart", "keydown"].forEach((eventName) => {
  window.addEventListener(eventName, unlockAudio, { once: true, passive: true });
});

els.wordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const collection = getActiveCollection();
  if (!collection) return;

  const en = els.wordEnglish.value.trim();
  const ru = els.wordRussian.value.trim();
  const image = generateWordImage(en, ru);

  const newWord = {
    id: crypto.randomUUID(),
    en,
    ru,
    example: els.wordExample.value.trim(),
    image,
    score: 0,
    dueAt: Date.now()
  };

  collection.words.unshift(newWord);
  lastAddedWordId = newWord.id;

  els.wordForm.reset();
  autoTranslationActive = true;
  lastTranslationQuery = "";
  hideTranslationSuggestions();
  renderGeneratedPreview();
  saveState();
  render();
});

els.sampleButton.addEventListener("click", () => {
  els.wordEnglish.value = "glimpse";
  els.wordRussian.value = "мимолетный взгляд";
  els.wordExample.value = "She caught a glimpse of the old house through the trees.";
  renderGeneratedPreview();
});

els.wordEnglish.addEventListener("input", () => {
  autoTranslationActive = true;
  requestTranslationsForCurrentWord();
});

els.wordRussian.addEventListener("input", () => {
  autoTranslationActive = false;
  renderGeneratedPreview();
});

els.wordRussian.addEventListener("focus", () => {
  requestTranslationsForCurrentWord();
});

els.wordSearch.addEventListener("input", () => {
  wordSearch = els.wordSearch.value.trim();
  const collection = getActiveCollection();
  if (collection) renderWords(collection);
});

els.exportButton.addEventListener("click", exportBackup);
els.importButton.addEventListener("click", () => els.importFile.click());
els.importFile.addEventListener("change", () => importBackup(els.importFile.files[0]));
els.installButton?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  updateInstallButton();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButton();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updateInstallButton();
});

document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    wordFilter = button.dataset.filter;
    document.querySelectorAll(".filter-button").forEach((filter) => {
      filter.classList.toggle("active", filter === button);
    });
    const collection = getActiveCollection();
    if (collection) renderWords(collection);
  });
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveTab(button.dataset.tab);
  });
});

document.querySelectorAll(".mode-button").forEach((button) => {
  button.addEventListener("click", () => {
    setQuizMode(button.dataset.mode);
  });
});

els.prevCard.addEventListener("click", () => {
  cardIndex -= 1;
  const collection = getActiveCollection();
  if (collection) renderCard(collection);
});

els.nextCard.addEventListener("click", () => {
  cardIndex += 1;
  const collection = getActiveCollection();
  if (collection) renderCard(collection);
});

render();
renderGeneratedPreview();
registerPwa();
