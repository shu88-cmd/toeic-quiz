// 初回起動時も、指定された新しい500点単語を基準に開始します
const DEFAULT_VOCABULARY = Array.isArray(window.TOEIC_VOCABULARY_500_V3)
  ? window.TOEIC_VOCABULARY_500_V3.map(({ word, meaning }) => ({ word, meaning }))
  : [];

// localStorageで使う保存名です。ブラウザを閉じてもデータが残ります
const WORD_STORAGE_KEY = "toeicQuizVocabulary";
const REVIEW_STORAGE_KEY = "toeicQuizReviewWords";
const LEARNING_STORAGE_KEY = "toeicQuizLearningRecords";
const DELETED_STORAGE_KEY = "toeicQuizDeletedWords";
const VOCABULARY_MIGRATION_KEY = "toeicQuizVocabularyMigrationVersion";
const VOCABULARY_MIGRATION_VERSION = 4;
const EXPANSION_MIGRATION_VERSION = 2;
const REPLACEMENT_500_MIGRATION_VERSION = 3;
const WORD_GROUPS = ["500", "730", "860", "990"];

// レベルがない古いデータや不正な値は、安全に500点レベルとして扱います
function normalizeGroup(group) {
  return WORD_GROUPS.includes(String(group)) ? String(group) : "500";
}

function getGroupLabel(group) {
  return group === "all" ? "全単語ランダム" : `${normalizeGroup(group)}点レベル`;
}

// 単語名を編集しても変わらないIDを作ります
function createWordId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `word-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// 初回は標準の30語を保存し、2回目以降は保存済みの単語を読み込みます
function loadVocabulary() {
  try {
    const savedData = localStorage.getItem(WORD_STORAGE_KEY);
    if (savedData === null) {
      const initialWords = DEFAULT_VOCABULARY.map((item) => ({ ...item, id: createWordId(), group: "500" }));
      localStorage.setItem(WORD_STORAGE_KEY, JSON.stringify(initialWords));
      return initialWords;
    }

    const savedWords = JSON.parse(savedData);
    if (!Array.isArray(savedWords)) throw new Error("単語データの形式が正しくありません");

    // 空欄や重複したデータを除き、アプリで安全に使える形にします
    const validWords = [];
    savedWords.forEach((item) => {
      if (!item || typeof item.word !== "string" || typeof item.meaning !== "string") return;
      const word = item.word.trim();
      const meaning = item.meaning.trim();
      if (!word || !meaning || validWords.some((saved) => saved.word.toLowerCase() === word.toLowerCase())) return;
      const id = typeof item.id === "string" && item.id && !validWords.some((saved) => saved.id === item.id)
        ? item.id
        : createWordId();
      validWords.push({ word, meaning, id, group: normalizeGroup(item.group) });
    });
    // IDがなかった既存データも、ここでID付きとして保存し直します
    localStorage.setItem(WORD_STORAGE_KEY, JSON.stringify(validWords));
    return validWords;
  } catch (error) {
    // 保存データが壊れている場合は、標準の単語で安全に開始します
    const initialWords = DEFAULT_VOCABULARY.map((item) => ({ ...item, id: createWordId(), group: "500" }));
    localStorage.setItem(WORD_STORAGE_KEY, JSON.stringify(initialWords));
    return initialWords;
  }
}

// 保存済みの利用者にも、バージョンごとの追加単語を一度だけ安全に反映します
function migrateExpandedVocabulary(savedVocabulary) {
  const currentVersion = Number(localStorage.getItem(VOCABULARY_MIGRATION_KEY) || 0);
  if (currentVersion >= EXPANSION_MIGRATION_VERSION) return savedVocabulary;

  const migrations = [
    // commissionはバージョン3で500点へ移したため、旧追加データは299語です
    { version: 1, expectedCount: 299, items: window.TOEIC_VOCABULARY_EXPANSION_V1 },
    { version: 2, expectedCount: 97, items: window.TOEIC_VOCABULARY_EXPANSION_V2 }
  ];
  const pendingMigrations = migrations.filter((migration) => migration.version > currentVersion);
  // データファイルが途中までしか読めなかった場合は、移行済みにせず次回再試行します
  if (pendingMigrations.some((migration) =>
    !Array.isArray(migration.items) || migration.items.length !== migration.expectedCount
  )) return savedVocabulary;
  const source = pendingMigrations.flatMap((migration) => migration.items);
  try {
    // 通常一覧だけでなく、削除済み一覧の単語も自動復活させないよう確認します
    const deletedWords = loadDeletedWords();
    const usedWords = new Set([
      ...savedVocabulary.map((item) => item.word.toLowerCase()),
      ...deletedWords.map((item) => item.word.toLowerCase())
    ]);
    const usedIds = new Set([
      ...savedVocabulary.map((item) => item.id),
      ...deletedWords.map((item) => item.id)
    ]);
    const additions = [];

    source.forEach((item) => {
      if (!item || typeof item.id !== "string" || typeof item.word !== "string" || typeof item.meaning !== "string") return;
      const id = item.id.trim();
      const word = item.word.trim();
      const meaning = item.meaning.trim();
      const group = String(item.group);
      const lowerWord = word.toLowerCase();
      if (!id || !word || !meaning || !WORD_GROUPS.includes(group) || usedIds.has(id) || usedWords.has(lowerWord)) return;
      additions.push({ id, word, meaning, group });
      usedIds.add(id);
      usedWords.add(lowerWord);
    });

    const migratedVocabulary = [...savedVocabulary, ...additions];
    // 単語保存後にバージョンを記録します。途中で失敗しても次回は重複せず再試行できます
    localStorage.setItem(WORD_STORAGE_KEY, JSON.stringify(migratedVocabulary));
    localStorage.setItem(VOCABULARY_MIGRATION_KEY, String(EXPANSION_MIGRATION_VERSION));
    return migratedVocabulary;
  } catch (error) {
    // 容量不足などで保存できなくても、既存データはそのまま利用します
    return savedVocabulary;
  }
}

// バージョン3では、古い500点単語と関連データを新しい67語へ完全に入れ替えます
function migrate500Vocabulary(savedVocabulary) {
  const currentVersion = Number(localStorage.getItem(VOCABULARY_MIGRATION_KEY) || 0);
  if (currentVersion >= REPLACEMENT_500_MIGRATION_VERSION) return savedVocabulary;
  const replacements = Array.isArray(window.TOEIC_VOCABULARY_500_V3)
    ? window.TOEIC_VOCABULARY_500_V3
    : [];
  if (replacements.length !== 67) return savedVocabulary;

  const storageKeys = [WORD_STORAGE_KEY, REVIEW_STORAGE_KEY, LEARNING_STORAGE_KEY, DELETED_STORAGE_KEY, VOCABULARY_MIGRATION_KEY];
  const previousValues = Object.fromEntries(storageKeys.map((key) => [key, localStorage.getItem(key)]));
  try {
    const rawRecords = JSON.parse(localStorage.getItem(LEARNING_STORAGE_KEY) || "{}");
    const records = rawRecords && typeof rawRecords === "object" && !Array.isArray(rawRecords) ? { ...rawRecords } : {};
    const rawReviews = JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY) || "[]");
    const reviews = Array.isArray(rawReviews) ? rawReviews.filter((word) => typeof word === "string") : [];
    const deletedWords = loadDeletedWords();
    const replacementNames = new Set(replacements.map((item) => item.word.toLowerCase()));

    // commissionは利用者の指定に従い、730点の旧データも削除して500点へ登録し直します
    const isRemovalTarget = (item) => normalizeGroup(item.group) === "500" || item.word.toLowerCase() === "commission";
    const removedNormal = savedVocabulary.filter(isRemovalTarget);
    const removedDeleted = deletedWords.filter(isRemovalTarget);
    const retainedVocabulary = savedVocabulary.filter((item) => !isRemovalTarget(item));
    const retainedDeleted = deletedWords.filter((item) => !isRemovalTarget(item));

    // 他レベルに同名語がある場合は、他レベルを変更せず移行全体を中止します
    const conflictingWord = retainedVocabulary.find((item) => replacementNames.has(item.word.toLowerCase()))
      || retainedDeleted.find((item) => replacementNames.has(item.word.toLowerCase()));
    if (conflictingWord) throw new Error(`他レベルに同じ英単語があります：${conflictingWord.word}`);
    const retainedIds = new Set([...retainedVocabulary, ...retainedDeleted].map((item) => item.id));

    const replacementIds = new Set();
    const validatedReplacements = replacements.map((item) => {
      if (!item || typeof item.id !== "string" || typeof item.word !== "string" || typeof item.meaning !== "string"
        || item.group !== "500" || !item.id.trim() || !item.word.trim() || !item.meaning.trim()
        || replacementIds.has(item.id) || retainedIds.has(item.id)) throw new Error("500点の置換データが不正です");
      replacementIds.add(item.id);
      return { id: item.id, word: item.word, meaning: item.meaning, group: "500" };
    });
    if (new Set(validatedReplacements.map((item) => item.word.toLowerCase())).size !== 67) {
      throw new Error("500点の置換データに重複があります");
    }

    const removedIds = new Set([...removedNormal, ...removedDeleted].map((item) => item.id));
    Object.keys(records).forEach((id) => {
      if (removedIds.has(id) || replacementIds.has(id)) delete records[id];
    });
    const removedNames = new Set([
      ...removedNormal.map((item) => item.word.toLowerCase()),
      ...removedDeleted.map((item) => item.word.toLowerCase()),
      ...replacementNames
    ]);
    const nextReviews = reviews.filter((word) => !removedNames.has(word.toLowerCase()));
    const nextVocabulary = [...retainedVocabulary, ...validatedReplacements];

    // すべての新しい状態を作ってから保存し、移行番号は最後に記録します
    localStorage.setItem(WORD_STORAGE_KEY, JSON.stringify(nextVocabulary));
    localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(records));
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(nextReviews));
    localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(retainedDeleted));
    localStorage.setItem(VOCABULARY_MIGRATION_KEY, String(REPLACEMENT_500_MIGRATION_VERSION));
    return nextVocabulary;
  } catch (error) {
    // 途中で失敗した場合は、関連するLocalStorageをすべて移行前へ戻します
    storageKeys.forEach((key) => {
      try {
        const previousValue = previousValues[key];
        if (previousValue === null) localStorage.removeItem(key);
        else localStorage.setItem(key, previousValue);
      } catch (restoreError) {
        // ブラウザの保存領域自体が使えない場合も、アプリの起動は継続します
      }
    });
    return savedVocabulary;
  }
}

// バージョン4では、旧730点単語を指定された90語へ完全に入れ替えます
function migrate730Vocabulary(savedVocabulary) {
  const currentVersion = Number(localStorage.getItem(VOCABULARY_MIGRATION_KEY) || 0);
  if (currentVersion >= VOCABULARY_MIGRATION_VERSION) return savedVocabulary;
  const replacements = Array.isArray(window.TOEIC_VOCABULARY_730_V4)
    ? window.TOEIC_VOCABULARY_730_V4
    : [];
  if (replacements.length !== 90) return savedVocabulary;

  const storageKeys = [WORD_STORAGE_KEY, REVIEW_STORAGE_KEY, LEARNING_STORAGE_KEY, DELETED_STORAGE_KEY, VOCABULARY_MIGRATION_KEY];
  const previousValues = Object.fromEntries(storageKeys.map((key) => [key, localStorage.getItem(key)]));
  try {
    const rawRecords = JSON.parse(localStorage.getItem(LEARNING_STORAGE_KEY) || "{}");
    const records = rawRecords && typeof rawRecords === "object" && !Array.isArray(rawRecords) ? { ...rawRecords } : {};
    const rawReviews = JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY) || "[]");
    const reviews = Array.isArray(rawReviews) ? rawReviews.filter((word) => typeof word === "string") : [];
    const deletedWords = loadDeletedWords();
    const replacementNames = new Set(replacements.map((item) => item.word.toLowerCase()));
    // 利用者の指定に従い、この3語は860点の旧データも削除して730点へ登録し直します
    const transferredNames = new Set(["asset", "endeavor", "patent"]);
    const isRemovalTarget = (item) => normalizeGroup(item.group) === "730"
      || transferredNames.has(item.word.toLowerCase());
    const removedNormal = savedVocabulary.filter(isRemovalTarget);
    const removedDeleted = deletedWords.filter(isRemovalTarget);
    const retainedVocabulary = savedVocabulary.filter((item) => !isRemovalTarget(item));
    const retainedDeleted = deletedWords.filter((item) => !isRemovalTarget(item));

    // 許可された3語以外に他レベルとの重複があれば、安全のため移行を中止します
    const conflictingWord = retainedVocabulary.find((item) => replacementNames.has(item.word.toLowerCase()))
      || retainedDeleted.find((item) => replacementNames.has(item.word.toLowerCase()));
    if (conflictingWord) throw new Error(`他レベルに同じ英単語があります：${conflictingWord.word}`);
    const retainedIds = new Set([...retainedVocabulary, ...retainedDeleted].map((item) => item.id));
    const replacementIds = new Set();
    const validatedReplacements = replacements.map((item) => {
      if (!item || typeof item.id !== "string" || typeof item.word !== "string" || typeof item.meaning !== "string"
        || item.group !== "730" || !item.id.trim() || !item.word.trim() || !item.meaning.trim()
        || item.word !== item.word.toLowerCase()
        || replacementIds.has(item.id) || retainedIds.has(item.id)) throw new Error("730点の置換データが不正です");
      replacementIds.add(item.id);
      return { id: item.id, word: item.word, meaning: item.meaning, group: "730" };
    });
    if (new Set(validatedReplacements.map((item) => item.word.toLowerCase())).size !== 90
      || validatedReplacements.some((item) => item.word === "slater")) {
      throw new Error("730点の置換データに重複または対象外の単語があります");
    }

    const removedIds = new Set([...removedNormal, ...removedDeleted].map((item) => item.id));
    Object.keys(records).forEach((id) => {
      if (removedIds.has(id) || replacementIds.has(id)) delete records[id];
    });
    const removedNames = new Set([
      ...removedNormal.map((item) => item.word.toLowerCase()),
      ...removedDeleted.map((item) => item.word.toLowerCase()),
      ...replacementNames
    ]);
    const nextReviews = reviews.filter((word) => !removedNames.has(word.toLowerCase()));
    const nextVocabulary = [...retainedVocabulary, ...validatedReplacements];

    // 内容を検証してから保存し、移行番号はすべての保存が成功した最後に記録します
    if (nextVocabulary.filter((item) => normalizeGroup(item.group) === "730").length !== 90) {
      throw new Error("730点単語の件数が正しくありません");
    }
    localStorage.setItem(WORD_STORAGE_KEY, JSON.stringify(nextVocabulary));
    localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(records));
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(nextReviews));
    localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(retainedDeleted));
    localStorage.setItem(VOCABULARY_MIGRATION_KEY, String(VOCABULARY_MIGRATION_VERSION));
    return nextVocabulary;
  } catch (error) {
    // 保存途中で失敗した場合は、他レベルを含むすべての値を移行前へ戻します
    storageKeys.forEach((key) => {
      try {
        const previousValue = previousValues[key];
        if (previousValue === null) localStorage.removeItem(key);
        else localStorage.setItem(key, previousValue);
      } catch (restoreError) {
        // 保存領域そのものが使えない場合も、アプリの起動は継続します
      }
    });
    return savedVocabulary;
  }
}

let vocabulary = migrate730Vocabulary(migrate500Vocabulary(migrateExpandedVocabulary(loadVocabulary())));

// HTMLの各要素をJavaScriptから使えるように取得します
const wordElement = document.getElementById("word");
const choicesElement = document.getElementById("choices");
const feedbackElement = document.getElementById("feedback");
const explanationArea = document.getElementById("explanation-area");
const explanationList = document.getElementById("explanation-list");
const nextButton = document.getElementById("next-button");
const currentNumberElement = document.getElementById("current-number");
const totalNumberElement = document.getElementById("total-number");
const scoreElement = document.getElementById("score");
const progressBar = document.getElementById("progress-bar");
const quizArea = document.getElementById("quiz-area");
const resultArea = document.getElementById("result-area");
const finalScoreElement = document.getElementById("final-score");
const finalTotalElement = document.getElementById("final-total");
const resultMessageElement = document.getElementById("result-message");
const resultLabelElement = document.getElementById("result-label");
const correctCountElement = document.getElementById("correct-count");
const incorrectCountElement = document.getElementById("incorrect-count");
const accuracyRateElement = document.getElementById("accuracy-rate");
const resultSummaryElement = document.getElementById("result-summary");
const attemptWordsList = document.getElementById("attempt-words-list");
const attemptWordsEmpty = document.getElementById("attempt-words-empty");
const attemptFilterButtons = document.querySelectorAll(".attempt-filter-button");
const retryButton = document.getElementById("retry-button");
const backToSelectionButton = document.getElementById("back-to-selection-button");
const normalButton = document.getElementById("normal-button");
const weakButton = document.getElementById("weak-button");
const startArea = document.getElementById("start-area");
const startModeLabel = document.getElementById("start-mode-label");
const startDescription = document.getElementById("start-description");
const quizStatus = document.getElementById("quiz-status");
const countButtons = document.querySelectorAll(".count-button");
const directionButtons = document.querySelectorAll(".direction-button");
const groupButtons = document.querySelectorAll(".group-button");
const groupCountElements = document.querySelectorAll("[data-group-count]");
const groupSelection = document.getElementById("group-selection");
const directionSelection = document.getElementById("direction-selection");
const countSelection = document.getElementById("count-selection");
const selectedDirectionLabel = document.getElementById("selected-direction-label");
const changeDirectionButton = document.getElementById("change-direction-button");
const changeGroupButton = document.getElementById("change-group-button");
const resultDirectionElement = document.getElementById("result-direction");
const resultGroupElement = document.getElementById("result-group");
const quizGroupLabel = document.getElementById("quiz-group-label");
const reviewButton = document.getElementById("review-button");
const reviewCountElement = document.getElementById("review-count");
const reviewMessageElement = document.getElementById("review-message");
const modeLabelElement = document.getElementById("mode-label");
const timerArea = document.getElementById("timer-area");
const timerSecondsElement = document.getElementById("timer-seconds");
const timerBar = document.getElementById("timer-bar");
const timeLimitButtons = document.querySelectorAll(".time-limit-button");
const resultTimeSetting = document.getElementById("result-time-setting");
const timeoutSummary = document.getElementById("timeout-summary");
const timeoutCountElement = document.getElementById("timeout-count");
const quizView = document.getElementById("quiz-view");
const managementView = document.getElementById("management-view");
const manageButton = document.getElementById("manage-button");
const backButton = document.getElementById("back-button");
const wordForm = document.getElementById("word-form");
const englishInput = document.getElementById("english-input");
const japaneseInput = document.getElementById("japanese-input");
const groupInput = document.getElementById("group-input");
const wordListElement = document.getElementById("word-list");
const wordCountElement = document.getElementById("word-count");
const formMessageElement = document.getElementById("form-message");
const searchInput = document.getElementById("search-input");
const wordSortSelect = document.getElementById("word-sort-select");
const groupFilterSelect = document.getElementById("group-filter-select");
const selectVisibleCheckbox = document.getElementById("select-visible-checkbox");
const clearWordSelectionButton = document.getElementById("clear-word-selection-button");
const selectedWordCountElement = document.getElementById("selected-word-count");
const deleteSelectedWordsButton = document.getElementById("delete-selected-words-button");
const bulkGroupSelect = document.getElementById("bulk-group-select");
const changeSelectedGroupButton = document.getElementById("change-selected-group-button");
const submitWordButton = document.getElementById("submit-word-button");
const cancelEditButton = document.getElementById("cancel-edit-button");
const showDeletedButton = document.getElementById("show-deleted-button");
const deletedCountElement = document.getElementById("deleted-count");
const deletedView = document.getElementById("deleted-view");
const deletedBackButton = document.getElementById("deleted-back-button");
const deletedList = document.getElementById("deleted-list");
const deletedMessage = document.getElementById("deleted-message");
const restoreAllButton = document.getElementById("restore-all-button");
const deleteAllForeverButton = document.getElementById("delete-all-forever-button");
const recordsView = document.getElementById("records-view");
const recordsButton = document.getElementById("records-button");
const recordsBackButton = document.getElementById("records-back-button");
const recordsBody = document.getElementById("records-body");
const recordsMessage = document.getElementById("records-message");
const recordsEmpty = document.getElementById("records-empty");
const levelRecordCards = document.getElementById("level-record-cards");
const recordLevelFilterButtons = document.querySelectorAll(".record-level-filter");
const resetAllRecordsButton = document.getElementById("reset-all-records-button");
const sortButtons = document.querySelectorAll(".sort-button");
const exportButton = document.getElementById("export-button");
const importInput = document.getElementById("import-input");
const backupMessage = document.getElementById("backup-message");
const bulkInput = document.getElementById("bulk-input");
const translateButton = document.getElementById("translate-button");
const translationProgress = document.getElementById("translation-progress");
const translationReview = document.getElementById("translation-review");
const translationBody = document.getElementById("translation-body");
const registerTranslationsButton = document.getElementById("register-translations-button");
const cancelTranslationButton = document.getElementById("cancel-translation-button");
const translationSelectionCount = document.getElementById("translation-selection-count");
const bulkLevelButtons = document.querySelectorAll(".bulk-level-button");

let questions = [];
let currentIndex = 0;
let score = 0;
let answered = false;
let isReviewMode = false;
let isWeakMode = false;
let editingWord = null;
let selectedQuestionCount = 10;
let selectedDirection = "english-to-japanese";
// ランダムモードでも、表示中の1問ではこの方向を最後まで使います
let currentQuestionDirection = "english-to-japanese";
let currentAttemptHistory = [];
let currentAttemptFilter = "all";
let selectedWordGroup = "all";
let currentRecordSort = "weak";
let currentRecordGroup = "all";
let currentWordSort = "az";
let currentGroupFilter = "all";
const selectedWordIds = new Set();
let currentVisibleWordIds = [];
let translationResults = [];
let currentChoiceItems = [];
let selectedTimeLimit = 0;
let timedOutCount = 0;
let timerIntervalId = null;
let timerDeadline = 0;

// 配列をランダムな順番に並べ替える関数です
function shuffle(array) {
  const copiedArray = [...array];
  for (let i = copiedArray.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [copiedArray[i], copiedArray[randomIndex]] = [copiedArray[randomIndex], copiedArray[i]];
  }
  return copiedArray;
}

// 保存された単語を読み込みます。データに問題があれば空の配列を返します
function loadReviewWords() {
  try {
    const savedWords = JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY)) || [];
    if (!Array.isArray(savedWords)) return [];
    return savedWords.filter((word, index) =>
      typeof word === "string" &&
      vocabulary.some((item) => item.word === word) &&
      savedWords.indexOf(word) === index
    );
  } catch (error) {
    return [];
  }
}

// 復習リストをブラウザに保存し、ボタンの件数も更新します
function saveReviewWords(words) {
  localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(words));
  updateReviewCount();
}

function updateReviewCount() {
  reviewCountElement.textContent = loadReviewWords().length;
}

// 現在の単語一覧をブラウザへ保存します
function saveVocabulary() {
  // sensitivity: "base"で大文字・小文字を区別せずA〜Z順にします
  vocabulary.sort((a, b) => a.word.localeCompare(b.word, "en", { sensitivity: "base" }));
  localStorage.setItem(WORD_STORAGE_KEY, JSON.stringify(vocabulary));
}

// IDをキーにして学習記録を読み込みます
function loadLearningRecords() {
  try {
    const records = JSON.parse(localStorage.getItem(LEARNING_STORAGE_KEY)) || {};
    return records && typeof records === "object" && !Array.isArray(records) ? records : {};
  } catch (error) {
    return {};
  }
}

function saveLearningRecords(records) {
  localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(records));
}

// 壊れた保存データや不完全な行は無視し、アプリ全体が止まらないようにします
function loadDeletedWords() {
  try {
    const saved = JSON.parse(localStorage.getItem(DELETED_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    const seenIds = new Set();
    const seenWords = new Set();
    return saved.filter((item) => {
      const valid = item
        && typeof item.id === "string" && item.id.trim()
        && typeof item.word === "string" && item.word.trim()
        && typeof item.meaning === "string" && item.meaning.trim()
        && Number.isInteger(item.correct) && item.correct >= 0
        && Number.isInteger(item.incorrect) && item.incorrect >= 0
        && typeof item.wasInReview === "boolean"
        && typeof item.deletedAt === "string" && !Number.isNaN(Date.parse(item.deletedAt))
        && !seenIds.has(item.id) && !seenWords.has(item.word.toLowerCase());
      if (valid) {
        seenIds.add(item.id);
        seenWords.add(item.word.toLowerCase());
      }
      return valid;
    }).map((item) => ({ ...item, group: normalizeGroup(item.group) }));
  } catch (error) {
    return [];
  }
}

function saveDeletedWords(words) {
  localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(words));
}

function updateDeletedCount() {
  const count = loadDeletedWords().length;
  deletedCountElement.textContent = count;
  deletedCountElement.setAttribute("aria-label", `削除済み${count}件`);
}

// 関連する4種類のデータをまとめて保存し、途中で失敗した場合はすべて元へ戻します
function saveWordState(nextVocabulary, nextRecords, nextReviews, nextDeletedWords) {
  const keys = [WORD_STORAGE_KEY, LEARNING_STORAGE_KEY, REVIEW_STORAGE_KEY, DELETED_STORAGE_KEY];
  const previous = Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)]));
  const sortedVocabulary = [...nextVocabulary].sort((a, b) =>
    a.word.localeCompare(b.word, "en", { sensitivity: "base" })
  );
  try {
    localStorage.setItem(WORD_STORAGE_KEY, JSON.stringify(sortedVocabulary));
    localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(nextRecords));
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(nextReviews));
    localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(nextDeletedWords));
  } catch (error) {
    keys.forEach((key) => {
      if (previous[key] === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previous[key]);
    });
    throw error;
  }
  vocabulary = sortedVocabulary;
  updateReviewCount();
  updateDeletedCount();
}

// 1回の回答につき、現在の単語の正解数または不正解数を1増やします
function updateLearningRecord(wordId, isCorrect) {
  const records = loadLearningRecords();
  const current = records[wordId] || { correct: 0, incorrect: 0 };
  if (isCorrect) current.correct++;
  else current.incorrect++;
  records[wordId] = current;
  saveLearningRecords(records);
}

function getRecordValues(item, records) {
  const record = records[item.id] || { correct: 0, incorrect: 0 };
  // 壊れた値があっても、0以上の整数だけを集計へ使用します
  const correct = Number.isInteger(record.correct) && record.correct >= 0 ? record.correct : 0;
  const incorrect = Number.isInteger(record.incorrect) && record.incorrect >= 0 ? record.incorrect : 0;
  const total = correct + incorrect;
  const rate = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, incorrect, total, rate };
}

// 回答済みの単語を、正答率が低い順・不正解数が多い順に並べます
function getWeakWords() {
  const records = loadLearningRecords();
  return shuffle(vocabulary.filter((item) => getRecordValues(item, records).total > 0))
    .sort((a, b) => {
      const aRecord = getRecordValues(a, records);
      const bRecord = getRecordValues(b, records);
      if (aRecord.rate !== bRecord.rate) return aRecord.rate - bRecord.rate;
      return bRecord.incorrect - aRecord.incorrect;
    });
}

// 通常一覧にある単語だけを、現在の所属レベルごとに合計します
function renderLevelRecordCards(records) {
  levelRecordCards.innerHTML = "";
  WORD_GROUPS.forEach((group) => {
    const groupWords = vocabulary.filter((item) => normalizeGroup(item.group) === group);
    const totals = groupWords.reduce((summary, item) => {
      const values = getRecordValues(item, records);
      summary.correct += values.correct;
      summary.incorrect += values.incorrect;
      if (values.total > 0) summary.studied++;
      return summary;
    }, { correct: 0, incorrect: 0, studied: 0 });
    const answerCount = totals.correct + totals.incorrect;
    const rateText = answerCount === 0 ? "未回答" : `${Math.round((totals.correct / answerCount) * 100)}%`;

    const card = document.createElement("article");
    card.className = `level-record-card level-record-${group}`;
    const title = document.createElement("h3");
    title.textContent = getGroupLabel(group);
    const details = document.createElement("dl");
    [
      ["登録単語", `${groupWords.length}語`],
      ["学習済み", `${totals.studied}語`],
      ["正解", `${totals.correct}回`],
      ["不正解", `${totals.incorrect}回`],
      ["回答回数", `${answerCount}回`],
      ["正答率", rateText]
    ].forEach(([label, value]) => {
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      wrapper.append(term, description);
      details.appendChild(wrapper);
    });
    card.append(title, details);
    levelRecordCards.appendChild(card);
  });
}

// レベルで絞り込んだあと、選択された順番で学習記録の表を描画します
function renderLearningRecords() {
  const records = loadLearningRecords();
  renderLevelRecordCards(records);
  const filteredWords = currentRecordGroup === "all"
    ? [...vocabulary]
    : vocabulary.filter((item) => normalizeGroup(item.group) === currentRecordGroup);
  const sortedWords = filteredWords.sort((a, b) => {
    const aRecord = getRecordValues(a, records);
    const bRecord = getRecordValues(b, records);
    if (currentRecordSort === "az") return a.word.localeCompare(b.word, "en", { sensitivity: "base" });
    if (aRecord.total === 0 && bRecord.total > 0) return 1;
    if (aRecord.total > 0 && bRecord.total === 0) return -1;
    if (currentRecordSort === "high" && bRecord.rate !== aRecord.rate) return bRecord.rate - aRecord.rate;
    if (currentRecordSort === "weak" && aRecord.rate !== bRecord.rate) return aRecord.rate - bRecord.rate;
    if (bRecord.incorrect !== aRecord.incorrect) return bRecord.incorrect - aRecord.incorrect;
    return a.word.localeCompare(b.word, "en", { sensitivity: "base" });
  });

  recordsBody.innerHTML = "";
  recordsEmpty.hidden = sortedWords.length > 0;
  recordsEmpty.textContent = "このレベルには表示できる単語がありません。";
  sortedWords.forEach((item) => {
    const values = getRecordValues(item, records);
    const row = document.createElement("tr");
    [item.word, item.meaning].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    const groupCell = document.createElement("td");
    groupCell.appendChild(createGroupBadge(item.group));
    row.appendChild(groupCell);
    [values.correct, values.incorrect, values.total].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    const rateCell = document.createElement("td");
    const rateBadge = document.createElement("span");
    rateBadge.className = `rate-badge ${values.total === 0 ? "rate-unanswered" : values.rate < 50 ? "rate-low" : values.rate < 80 ? "rate-mid" : "rate-high"}`;
    rateBadge.textContent = values.total === 0 ? "未回答" : `${values.rate}%`;
    rateCell.appendChild(rateBadge);
    row.appendChild(rateCell);

    const actionCell = document.createElement("td");
    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "record-reset-button";
    resetButton.textContent = "記録をリセット";
    resetButton.addEventListener("click", () => resetWordRecord(item));
    actionCell.appendChild(resetButton);
    row.appendChild(actionCell);
    recordsBody.appendChild(row);
  });
}

function openRecords() {
  stopQuestionTimer();
  quizView.hidden = true;
  managementView.hidden = true;
  deletedView.hidden = true;
  recordsView.hidden = false;
  recordsMessage.textContent = "";
  currentRecordGroup = "all";
  recordLevelFilterButtons.forEach((button) => {
    const isSelected = button.dataset.recordGroup === "all";
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  renderLearningRecords();
}

function closeRecords() {
  recordsView.hidden = true;
  quizView.hidden = false;
  showQuestionCountSelection("normal");
}

function resetWordRecord(item) {
  if (!window.confirm(`「${item.word}」の学習記録をリセットしますか？`)) return;
  const records = loadLearningRecords();
  delete records[item.id];
  saveLearningRecords(records);
  renderLearningRecords();
  // 単語管理画面の並び順にも、リセット後の最新記録を反映します
  renderWordList();
  recordsMessage.textContent = `「${item.word}」の記録をリセットしました。`;
}

function resetAllRecords() {
  if (!window.confirm("すべての学習記録をリセットしますか？単語は削除されません。")) return;
  saveLearningRecords({});
  renderLearningRecords();
  renderWordList();
  recordsMessage.textContent = "すべての学習記録をリセットしました。";
}

// 単語・復習・学習記録・削除済み単語を1つのJSONにまとめてダウンロードします
function exportBackup() {
  const backup = {
    format: "toeic-word-quiz-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    vocabulary,
    reviewWords: loadReviewWords(),
    learningRecords: loadLearningRecords(),
    deletedWords: loadDeletedWords()
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `toeic-quiz-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  backupMessage.textContent = "バックアップを書き出しました。";
  backupMessage.className = "form-message success";
}

// 読み込んだJSONが、このアプリの安全なバックアップ形式か検証します
function validateBackup(data) {
  if (!data || data.format !== "toeic-word-quiz-backup" || data.version !== 1) throw new Error("このアプリのバックアップ形式ではありません。");
  if (!Array.isArray(data.vocabulary) || !Array.isArray(data.reviewWords)) throw new Error("単語または復習リストの形式が正しくありません。");
  if (!data.learningRecords || typeof data.learningRecords !== "object" || Array.isArray(data.learningRecords)) throw new Error("学習記録の形式が正しくありません。");

  const ids = new Set();
  const lowerWords = new Set();
  const restoredWords = data.vocabulary.map((item) => {
    if (!item || typeof item.id !== "string" || typeof item.word !== "string" || typeof item.meaning !== "string") throw new Error("単語データに必要な項目がありません。");
    const id = item.id.trim();
    const word = item.word.trim();
    const meaning = item.meaning.trim();
    if (!id || !word || !meaning || ids.has(id) || lowerWords.has(word.toLowerCase())) throw new Error("空欄または重複した単語データがあります。");
    ids.add(id);
    lowerWords.add(word.toLowerCase());
    return { id, word, meaning, group: normalizeGroup(item.group) };
  });

  const restoredReviews = [];
  data.reviewWords.forEach((word) => {
    if (typeof word !== "string" || !restoredWords.some((item) => item.word === word) || restoredReviews.includes(word)) throw new Error("復習リストに存在しない、または重複した単語があります。");
    restoredReviews.push(word);
  });

  const restoredRecords = {};
  Object.entries(data.learningRecords).forEach(([id, record]) => {
    if (!ids.has(id) || !record || !Number.isInteger(record.correct) || !Number.isInteger(record.incorrect) || record.correct < 0 || record.incorrect < 0) throw new Error("学習記録に不正な回数または単語IDがあります。");
    restoredRecords[id] = { correct: record.correct, incorrect: record.incorrect };
  });

  // 古いバックアップにはdeletedWordsがないため、その場合は空のごみ箱として読み込みます
  const deletedSource = data.deletedWords === undefined ? [] : data.deletedWords;
  if (!Array.isArray(deletedSource)) throw new Error("削除済み単語の形式が正しくありません。");
  const deletedIds = new Set();
  const deletedWordNames = new Set();
  const restoredDeletedWords = deletedSource.map((item) => {
    if (!item || typeof item.id !== "string" || typeof item.word !== "string" || typeof item.meaning !== "string") throw new Error("削除済み単語に必要な項目がありません。");
    const id = item.id.trim();
    const word = item.word.trim();
    const meaning = item.meaning.trim();
    const validCounts = Number.isInteger(item.correct) && item.correct >= 0 && Number.isInteger(item.incorrect) && item.incorrect >= 0;
    const validDate = typeof item.deletedAt === "string" && !Number.isNaN(Date.parse(item.deletedAt));
    if (!id || !word || !meaning || !validCounts || typeof item.wasInReview !== "boolean" || !validDate
      || ids.has(id) || lowerWords.has(word.toLowerCase()) || deletedIds.has(id) || deletedWordNames.has(word.toLowerCase())) {
      throw new Error("削除済み単語に空欄・重複・不正なデータがあります。");
    }
    deletedIds.add(id);
    deletedWordNames.add(word.toLowerCase());
    return { id, word, meaning, group: normalizeGroup(item.group), correct: item.correct, incorrect: item.incorrect, wasInReview: item.wasInReview, deletedAt: item.deletedAt };
  });
  return { vocabulary: restoredWords, reviewWords: restoredReviews, learningRecords: restoredRecords, deletedWords: restoredDeletedWords };
}

// ファイル全体の検証が終わってから、確認を表示して現在データを置き換えます
async function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error("ファイルサイズが大きすぎます。");
    const restored = validateBackup(JSON.parse(await file.text()));
    if (!window.confirm("現在の単語・復習リスト・学習記録・削除済み単語を、読み込んだバックアップで上書きしますか？")) return;

    // 保存途中で失敗した場合に戻せるよう、現在値を一時的に保持します
    const previous = {
      words: localStorage.getItem(WORD_STORAGE_KEY),
      reviews: localStorage.getItem(REVIEW_STORAGE_KEY),
      records: localStorage.getItem(LEARNING_STORAGE_KEY),
      deletedWords: localStorage.getItem(DELETED_STORAGE_KEY)
    };
    try {
      localStorage.setItem(WORD_STORAGE_KEY, JSON.stringify(restored.vocabulary));
      localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(restored.reviewWords));
      localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(restored.learningRecords));
      localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(restored.deletedWords));
    } catch (saveError) {
      if (previous.words === null) localStorage.removeItem(WORD_STORAGE_KEY); else localStorage.setItem(WORD_STORAGE_KEY, previous.words);
      if (previous.reviews === null) localStorage.removeItem(REVIEW_STORAGE_KEY); else localStorage.setItem(REVIEW_STORAGE_KEY, previous.reviews);
      if (previous.records === null) localStorage.removeItem(LEARNING_STORAGE_KEY); else localStorage.setItem(LEARNING_STORAGE_KEY, previous.records);
      if (previous.deletedWords === null) localStorage.removeItem(DELETED_STORAGE_KEY); else localStorage.setItem(DELETED_STORAGE_KEY, previous.deletedWords);
      throw new Error("データを保存できませんでした。");
    }

    // 古いバックアップを読み込んだ場合も、削除済み単語を除いて追加語を再適用します
    localStorage.removeItem(VOCABULARY_MIGRATION_KEY);
    vocabulary = migrate730Vocabulary(migrate500Vocabulary(migrateExpandedVocabulary(restored.vocabulary)));
    updateReviewCount();
    updateDeletedCount();
    renderWordList();
    renderDeletedWords();
    backupMessage.textContent = "バックアップを復元しました。";
    backupMessage.className = "form-message success";
  } catch (error) {
    // 検証に失敗した場合はlocalStorageへ一切書き込みません
    backupMessage.textContent = `読み込めませんでした：${error.message}`;
    backupMessage.className = "form-message error";
  } finally {
    importInput.value = "";
  }
}

// 入力結果やエラーを管理画面に表示します
function showFormMessage(message, type = "error") {
  formMessageElement.textContent = message;
  formMessageElement.className = `form-message ${type}`;
}

// 一覧と削除済み画面で共通利用する目標スコアのバッジです
function createGroupBadge(group) {
  const normalizedGroup = normalizeGroup(group);
  const badge = document.createElement("span");
  badge.className = `word-group-badge group-${normalizedGroup}-badge`;
  badge.textContent = getGroupLabel(normalizedGroup);
  badge.setAttribute("aria-label", `${normalizedGroup}点レベル`);
  return badge;
}

// 選択件数と「表示中をすべて選択」のチェック状態をそろえます
function updateWordSelectionControls() {
  const selectedCount = selectedWordIds.size;
  const selectedVisibleCount = currentVisibleWordIds.filter((id) => selectedWordIds.has(id)).length;
  selectedWordCountElement.textContent = `${selectedCount}件選択中`;
  deleteSelectedWordsButton.textContent = `選択した${selectedCount}件を削除`;
  deleteSelectedWordsButton.disabled = selectedCount === 0;
  changeSelectedGroupButton.disabled = selectedCount === 0;
  clearWordSelectionButton.disabled = selectedCount === 0;
  selectVisibleCheckbox.disabled = currentVisibleWordIds.length === 0;
  selectVisibleCheckbox.checked = currentVisibleWordIds.length > 0
    && selectedVisibleCount === currentVisibleWordIds.length;
  // 一部だけ選択されている場合は、チェックボックスを横線の状態にします
  selectVisibleCheckbox.indeterminate = selectedVisibleCount > 0
    && selectedVisibleCount < currentVisibleWordIds.length;
}

// 登録中の単語を1行ずつ一覧表示します
function renderWordList() {
  wordListElement.innerHTML = "";
  wordCountElement.textContent = vocabulary.length;
  const keyword = searchInput.value.trim().toLowerCase();
  // 学習記録は単語IDをキーにして保存されているため、一覧を開くたびに最新値を読み込みます
  const records = loadLearningRecords();

  // 数値が同じ場合に必ず使う、英単語のA→Z順の比較です
  const compareWordsAZ = (first, second) =>
    first.word.localeCompare(second.word, "en", { sensitivity: "base" });

  // 選択された学習結果の条件で比較します
  const compareWordListItems = (first, second) => {
    if (currentWordSort === "az") return compareWordsAZ(first, second);
    const firstRecord = getRecordValues(first, records);
    const secondRecord = getRecordValues(second, records);

    if (currentWordSort === "rate-low" || currentWordSort === "rate-high") {
      // 正答率順では、まだ回答していない単語を必ず回答済み単語の後ろへ送ります
      if (firstRecord.total === 0 && secondRecord.total > 0) return 1;
      if (firstRecord.total > 0 && secondRecord.total === 0) return -1;
      const rateDifference = currentWordSort === "rate-low"
        ? firstRecord.rate - secondRecord.rate
        : secondRecord.rate - firstRecord.rate;
      if (rateDifference !== 0) return rateDifference;
    } else if (currentWordSort === "incorrect") {
      const incorrectDifference = secondRecord.incorrect - firstRecord.incorrect;
      if (incorrectDifference !== 0) return incorrectDifference;
    } else if (currentWordSort === "answers") {
      const answerDifference = secondRecord.total - firstRecord.total;
      if (answerDifference !== 0) return answerDifference;
    }

    // 同じ数値の単語は、最後にA→Z順で比較して表示順を安定させます
    return compareWordsAZ(first, second);
  };

  // 検索で絞り込んでから並べ替えるため、検索中にも選択中の順番が適用されます
  const visibleWords = [...vocabulary]
    .filter((item) =>
      (item.word.toLowerCase().includes(keyword) || item.meaning.toLowerCase().includes(keyword))
      && (currentGroupFilter === "all" || normalizeGroup(item.group) === currentGroupFilter)
    )
    .sort(compareWordListItems);

  // 削除やバックアップ復元で存在しなくなったIDは選択状態から除きます
  const activeIds = new Set(vocabulary.map((item) => item.id));
  selectedWordIds.forEach((id) => {
    if (!activeIds.has(id)) selectedWordIds.delete(id);
  });
  currentVisibleWordIds = visibleWords.map((item) => item.id);
  updateWordSelectionControls();

  if (visibleWords.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-list";
    emptyItem.textContent = vocabulary.length === 0
      ? "単語が登録されていません。上のフォームから追加してください。"
      : "検索条件に一致する単語はありません。";
    wordListElement.appendChild(emptyItem);
    return;
  }

  visibleWords.forEach((item, index) => {
    const listItem = document.createElement("li");
    listItem.className = "word-item";
    listItem.classList.toggle("selected", selectedWordIds.has(item.id));

    // チェックボックスだけを押したときに選択し、行全体にはクリック処理を付けません
    const selectArea = document.createElement("div");
    selectArea.className = "word-select-control";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `word-select-${index}`;
    checkbox.checked = selectedWordIds.has(item.id);
    const checkboxLabel = document.createElement("label");
    checkboxLabel.htmlFor = checkbox.id;
    checkboxLabel.className = "visually-hidden";
    checkboxLabel.textContent = `${item.word}を選択`;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedWordIds.add(item.id);
      else selectedWordIds.delete(item.id);
      listItem.classList.toggle("selected", checkbox.checked);
      updateWordSelectionControls();
    });
    selectArea.append(checkbox, checkboxLabel);

    const english = document.createElement("span");
    english.className = "word-english";
    english.textContent = item.word;

    const japanese = document.createElement("span");
    japanese.className = "word-japanese";
    japanese.textContent = item.meaning;
    const groupBadge = createGroupBadge(item.group);

    // 正解数 ÷ 回答回数 × 100を整数に丸め、成績に合った色のバッジを作ります
    const recordValues = getRecordValues(item, records);
    const accuracyBadge = document.createElement("span");
    const rateClass = recordValues.total === 0
      ? "rate-unanswered"
      : recordValues.rate < 50
        ? "rate-low"
        : recordValues.rate < 80
          ? "rate-mid"
          : "rate-high";
    accuracyBadge.className = `word-rate-badge ${rateClass}`;
    accuracyBadge.textContent = recordValues.total === 0
      ? "未回答"
      : `正答率 ${recordValues.rate}%`;
    accuracyBadge.title = recordValues.total === 0
      ? "まだ回答していません"
      : `正解${recordValues.correct}回・不正解${recordValues.incorrect}回`;

    const actionArea = document.createElement("div");
    actionArea.className = "word-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "edit-button";
    editButton.textContent = "編集";
    editButton.setAttribute("aria-label", `${item.word}を編集`);
    editButton.addEventListener("click", () => startEditing(item.word));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "削除";
    deleteButton.setAttribute("aria-label", `${item.word}を削除`);
    deleteButton.addEventListener("click", () => deleteWord(item.word));

    actionArea.append(editButton, deleteButton);
    listItem.append(selectArea, english, japanese, groupBadge, accuracyBadge, actionArea);
    wordListElement.appendChild(listItem);
  });
}

// 編集ボタンを押した単語をフォームへ読み込みます
function startEditing(word) {
  const item = vocabulary.find((saved) => saved.word.toLowerCase() === word.toLowerCase());
  if (!item) return;

  editingWord = item.word;
  englishInput.value = item.word;
  japaneseInput.value = item.meaning;
  groupInput.value = normalizeGroup(item.group);
  submitWordButton.textContent = "変更を保存";
  cancelEditButton.hidden = false;
  showFormMessage(`「${item.word}」を編集中です。`, "success");
  englishInput.focus();
}

// 編集状態を解除して、追加用のフォームへ戻します
function cancelEditing() {
  editingWord = null;
  wordForm.reset();
  groupInput.value = "500";
  submitWordButton.textContent = "単語を追加";
  cancelEditButton.hidden = true;
  formMessageElement.textContent = "";
}

// 削除日時が新しい順に、ごみ箱の内容を安全なDOM操作で表示します
function renderDeletedWords() {
  const deletedWords = loadDeletedWords()
    .sort((first, second) => Date.parse(second.deletedAt) - Date.parse(first.deletedAt));
  deletedList.innerHTML = "";
  restoreAllButton.disabled = deletedWords.length === 0;
  deleteAllForeverButton.disabled = deletedWords.length === 0;

  if (deletedWords.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-list";
    emptyItem.textContent = "削除済みの単語はありません";
    deletedList.appendChild(emptyItem);
    return;
  }

  deletedWords.forEach((item) => {
    const row = document.createElement("li");
    row.className = "deleted-item";
    const wordArea = document.createElement("div");
    wordArea.className = "deleted-word-text";
    const english = document.createElement("strong");
    english.textContent = item.word;
    const japanese = document.createElement("span");
    japanese.textContent = item.meaning;
    const groupBadge = createGroupBadge(item.group);
    const deletedDate = document.createElement("time");
    deletedDate.dateTime = item.deletedAt;
    deletedDate.textContent = `削除：${new Date(item.deletedAt).toLocaleString("ja-JP")}`;
    wordArea.append(english, japanese, groupBadge, deletedDate);

    const actions = document.createElement("div");
    actions.className = "deleted-actions";
    const restoreButton = document.createElement("button");
    restoreButton.type = "button";
    restoreButton.className = "restore-button";
    restoreButton.textContent = "復元";
    restoreButton.setAttribute("aria-label", `${item.word}を復元`);
    restoreButton.addEventListener("click", () => restoreDeletedWord(item.id));
    const permanentButton = document.createElement("button");
    permanentButton.type = "button";
    permanentButton.className = "delete-forever-button";
    permanentButton.textContent = "完全に削除";
    permanentButton.setAttribute("aria-label", `${item.word}を完全に削除`);
    permanentButton.addEventListener("click", () => permanentlyDeleteWord(item.id));
    actions.append(restoreButton, permanentButton);
    row.append(wordArea, actions);
    deletedList.appendChild(row);
  });
}

function openDeletedWords() {
  managementView.hidden = true;
  recordsView.hidden = true;
  deletedView.hidden = false;
  deletedMessage.textContent = "";
  renderDeletedWords();
}

function closeDeletedWords() {
  deletedView.hidden = true;
  managementView.hidden = false;
  renderWordList();
  updateDeletedCount();
  showDeletedButton.focus();
}

// 1件を元のID・学習記録・復習状態と一緒に通常一覧へ戻します
function restoreDeletedWord(id) {
  const deletedWords = loadDeletedWords();
  const item = deletedWords.find((deletedItem) => deletedItem.id === id);
  if (!item) return;
  if (vocabulary.some((wordItem) => wordItem.word.toLowerCase() === item.word.toLowerCase())) {
    deletedMessage.textContent = "同じ英単語がすでに登録されています";
    deletedMessage.className = "form-message error";
    return;
  }
  if (vocabulary.some((wordItem) => wordItem.id === item.id)) {
    deletedMessage.textContent = "同じ単語IDが使われているため復元できません";
    deletedMessage.className = "form-message error";
    return;
  }

  const records = loadLearningRecords();
  records[item.id] = { correct: item.correct, incorrect: item.incorrect };
  const reviews = loadReviewWords();
  if (item.wasInReview && !reviews.some((word) => word.toLowerCase() === item.word.toLowerCase())) reviews.push(item.word);
  try {
    saveWordState(
      [...vocabulary, { id: item.id, word: item.word, meaning: item.meaning, group: normalizeGroup(item.group) }],
      records,
      reviews,
      deletedWords.filter((deletedItem) => deletedItem.id !== id)
    );
    renderDeletedWords();
    renderWordList();
    deletedMessage.textContent = `「${item.word}」を復元しました。`;
    deletedMessage.className = "form-message success";
  } catch (error) {
    deletedMessage.textContent = "復元データを保存できませんでした。";
    deletedMessage.className = "form-message error";
  }
}

function restoreAllDeletedWords() {
  const deletedWords = loadDeletedWords();
  if (deletedWords.length === 0) return;
  const duplicate = deletedWords.find((item) =>
    vocabulary.some((wordItem) => wordItem.word.toLowerCase() === item.word.toLowerCase())
  );
  if (duplicate) {
    deletedMessage.textContent = `「${duplicate.word}」と同じ英単語がすでに登録されています。重複を解消してから復元してください。`;
    deletedMessage.className = "form-message error";
    return;
  }
  const activeIds = new Set(vocabulary.map((item) => item.id));
  if (deletedWords.some((item) => activeIds.has(item.id))) {
    deletedMessage.textContent = "同じ単語IDが使われているため復元できません";
    deletedMessage.className = "form-message error";
    return;
  }

  const records = loadLearningRecords();
  const reviews = loadReviewWords();
  deletedWords.forEach((item) => {
    records[item.id] = { correct: item.correct, incorrect: item.incorrect };
    if (item.wasInReview && !reviews.some((word) => word.toLowerCase() === item.word.toLowerCase())) reviews.push(item.word);
  });
  try {
    saveWordState(
      [...vocabulary, ...deletedWords.map(({ id, word, meaning, group }) => ({ id, word, meaning, group: normalizeGroup(group) }))],
      records,
      reviews,
      []
    );
    renderDeletedWords();
    renderWordList();
    deletedMessage.textContent = `${deletedWords.length}件の単語をすべて復元しました。`;
    deletedMessage.className = "form-message success";
  } catch (error) {
    deletedMessage.textContent = "復元データを保存できませんでした。";
    deletedMessage.className = "form-message error";
  }
}

function permanentlyDeleteWord(id) {
  const deletedWords = loadDeletedWords();
  const item = deletedWords.find((deletedItem) => deletedItem.id === id);
  if (!item || !window.confirm(`「${item.word}」を完全に削除しますか？この操作は取り消せず、復元できません。`)) return;
  try {
    saveDeletedWords(deletedWords.filter((deletedItem) => deletedItem.id !== id));
    updateDeletedCount();
    renderDeletedWords();
    deletedMessage.textContent = `「${item.word}」を完全に削除しました。復元はできません。`;
    deletedMessage.className = "form-message success";
  } catch (error) {
    deletedMessage.textContent = "完全削除の結果を保存できませんでした。";
    deletedMessage.className = "form-message error";
  }
}

function permanentlyDeleteAllWords() {
  const deletedWords = loadDeletedWords();
  if (deletedWords.length === 0 || !window.confirm(`削除済み単語${deletedWords.length}件をすべて完全に削除しますか？この操作は取り消せず、復元できません。`)) return;
  try {
    saveDeletedWords([]);
    updateDeletedCount();
    renderDeletedWords();
    deletedMessage.textContent = "削除済み単語をすべて完全に削除しました。復元はできません。";
    deletedMessage.className = "form-message success";
  } catch (error) {
    deletedMessage.textContent = "完全削除の結果を保存できませんでした。";
    deletedMessage.className = "form-message error";
  }
}

// 管理画面を開き、最新の一覧を表示します
function openManagement() {
  stopQuestionTimer();
  quizView.hidden = true;
  recordsView.hidden = true;
  managementView.hidden = false;
  deletedView.hidden = true;
  formMessageElement.textContent = "";
  searchInput.value = "";
  // 管理画面を新しく開いたときは、前回の選択を持ち越しません
  selectedWordIds.clear();
  cancelEditing();
  renderWordList();
  updateDeletedCount();
  englishInput.focus();
}

// 選択した複数単語を、学習記録と復習状態ごと1回の保存でごみ箱へ移します
function deleteSelectedWords() {
  const targets = vocabulary.filter((item) => selectedWordIds.has(item.id));
  const count = targets.length;
  if (count === 0) {
    selectedWordIds.clear();
    updateWordSelectionControls();
    return;
  }
  if (!window.confirm(`選択した${count}件を削除済み単語へ移動しますか？`)) return;

  const targetIds = new Set(targets.map((item) => item.id));
  const targetWords = new Set(targets.map((item) => item.word.toLowerCase()));
  const records = loadLearningRecords();
  const reviewWords = loadReviewWords();
  const deletedAt = new Date().toISOString();
  // 同じ操作が重なっても、IDまたは英単語が同じ行を二重に追加しません
  const deletedWords = loadDeletedWords().filter((item) =>
    !targetIds.has(item.id) && !targetWords.has(item.word.toLowerCase())
  );

  targets.forEach((item) => {
    const savedRecord = records[item.id] || {};
    deletedWords.push({
      id: item.id,
      word: item.word,
      meaning: item.meaning,
      group: normalizeGroup(item.group),
      correct: Number.isInteger(savedRecord.correct) && savedRecord.correct >= 0 ? savedRecord.correct : 0,
      incorrect: Number.isInteger(savedRecord.incorrect) && savedRecord.incorrect >= 0 ? savedRecord.incorrect : 0,
      wasInReview: reviewWords.some((word) => word.toLowerCase() === item.word.toLowerCase()),
      deletedAt
    });
    delete records[item.id];
  });

  try {
    saveWordState(
      vocabulary.filter((item) => !targetIds.has(item.id)),
      records,
      reviewWords.filter((word) => !targetWords.has(word.toLowerCase())),
      deletedWords
    );
    selectedWordIds.clear();
    renderWordList();
    showFormMessage(`${count}件を削除済み単語へ移動しました。`, "success");
  } catch (error) {
    showFormMessage("選択した単語の削除データを保存できませんでした。");
  }
}

// 選択状態を残したまま、複数単語のグループだけをまとめて変更します
function changeSelectedWordsGroup() {
  const targets = vocabulary.filter((item) => selectedWordIds.has(item.id));
  if (targets.length === 0) return;
  const group = normalizeGroup(bulkGroupSelect.value);
  const nextVocabulary = vocabulary.map((item) =>
    selectedWordIds.has(item.id) ? { ...item, group } : item
  );
  try {
    saveWordState(nextVocabulary, loadLearningRecords(), loadReviewWords(), loadDeletedWords());
    renderWordList();
    showFormMessage(`選択した${targets.length}件を${getGroupLabel(group)}へ変更しました。`, "success");
  } catch (error) {
    showFormMessage("レベル変更を保存できませんでした。");
  }
}

// 管理画面を閉じて、更新後の単語で通常クイズを始めます
function closeManagement() {
  managementView.hidden = true;
  quizView.hidden = false;
  showQuestionCountSelection("normal");
}

// 一覧から指定された単語を削除します
function deleteWord(word) {
  const shouldDelete = window.confirm(`「${word}」を削除しますか？`);
  if (!shouldDelete) return;

  const deletedItem = vocabulary.find((item) => item.word.toLowerCase() === word.toLowerCase());
  if (!deletedItem) return;
  const records = loadLearningRecords();
  const savedRecord = records[deletedItem.id] || {};
  // 学習記録の一部が壊れていても、安全な0以上の整数へ直して退避します
  const record = {
    correct: Number.isInteger(savedRecord.correct) && savedRecord.correct >= 0 ? savedRecord.correct : 0,
    incorrect: Number.isInteger(savedRecord.incorrect) && savedRecord.incorrect >= 0 ? savedRecord.incorrect : 0
  };
  const reviewWords = loadReviewWords();
  const wasInReview = reviewWords.some((savedWord) => savedWord.toLowerCase() === word.toLowerCase());
  const deletedWords = loadDeletedWords().filter((item) => item.word.toLowerCase() !== word.toLowerCase());
  deletedWords.push({
    id: deletedItem.id,
    word: deletedItem.word,
    meaning: deletedItem.meaning,
    group: normalizeGroup(deletedItem.group),
    correct: record.correct,
    incorrect: record.incorrect,
    wasInReview,
    deletedAt: new Date().toISOString()
  });
  delete records[deletedItem.id];

  try {
    saveWordState(
      vocabulary.filter((item) => item.id !== deletedItem.id),
      records,
      reviewWords.filter((savedWord) => savedWord.toLowerCase() !== word.toLowerCase()),
      deletedWords
    );
    if (editingWord && editingWord.toLowerCase() === word.toLowerCase()) cancelEditing();
    renderWordList();
    showFormMessage(`「${word}」を削除済み単語へ移動しました。`, "success");
  } catch (error) {
    showFormMessage("削除データを保存できませんでした。");
  }
}

// 入力された新しい単語をチェックして登録します
function addWord(event) {
  event.preventDefault();
  const word = englishInput.value.trim();
  const meaning = japaneseInput.value.trim();
  const group = groupInput.value;

  if (!word || !meaning || !WORD_GROUPS.includes(group)) {
    showFormMessage("英単語、日本語訳、レベルを正しく入力してください。");
    return;
  }

  // 編集中の元の単語だけは重複チェックから除外します
  const isDuplicate = vocabulary.some((item) =>
    item.word.toLowerCase() === word.toLowerCase() &&
    (!editingWord || item.word.toLowerCase() !== editingWord.toLowerCase())
  );
  if (isDuplicate) {
    showFormMessage(`「${word}」はすでに登録されています。`);
    return;
  }

  if (editingWord) {
    const oldWord = editingWord;
    // 単語名を変更したときも復習対象を引き継ぎます
    const reviewWordsBeforeEdit = loadReviewWords();
    const target = vocabulary.find((item) => item.word.toLowerCase() === oldWord.toLowerCase());
    if (!target) return;
    target.word = word;
    target.meaning = meaning;
    target.group = group;
    saveVocabulary();
    const updatedReviewWords = reviewWordsBeforeEdit.map((savedWord) =>
      savedWord.toLowerCase() === oldWord.toLowerCase() ? word : savedWord
    );
    saveReviewWords([...new Set(updatedReviewWords)]);
    cancelEditing();
    renderWordList();
    showFormMessage(`「${word}」の変更を保存しました。`, "success");
    return;
  }

  vocabulary.push({ word, meaning, group, id: createWordId() });
  saveVocabulary();
  renderWordList();
  wordForm.reset();
  showFormMessage(`「${word}」を追加しました。`, "success");
  englishInput.focus();
}

// 翻訳結果を安全なDOM操作だけで確認表へ表示します
function renderTranslationReview() {
  translationBody.innerHTML = "";
  translationResults.forEach((result, index) => {
    const row = document.createElement("tr");
    const checkCell = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = result.selected;
    checkbox.disabled = Boolean(result.error || result.duplicate);
    checkbox.addEventListener("change", () => {
      translationResults[index].selected = checkbox.checked;
      updateTranslationRegistrationCount();
    });
    checkCell.appendChild(checkbox);

    const wordCell = document.createElement("td");
    wordCell.textContent = result.word;

    const meaningCell = document.createElement("td");
    const meaningInput = document.createElement("input");
    meaningInput.type = "text";
    meaningInput.value = result.translation;
    meaningInput.disabled = Boolean(result.error || result.duplicate);
    meaningInput.addEventListener("input", () => {
      translationResults[index].translation = meaningInput.value;
      updateTranslationRegistrationCount();
    });
    meaningCell.appendChild(meaningInput);

    // 一括登録でも、単語ごとに異なるレベルを選べるようにします
    const levelCell = document.createElement("td");
    const levelSelect = document.createElement("select");
    levelSelect.className = "translation-level-select";
    levelSelect.setAttribute("aria-label", `${result.word}のレベル`);
    WORD_GROUPS.forEach((level) => {
      const option = document.createElement("option");
      option.value = level;
      option.textContent = getGroupLabel(level);
      levelSelect.appendChild(option);
    });
    levelSelect.value = normalizeGroup(result.group);
    levelSelect.disabled = Boolean(result.error || result.duplicate);
    levelSelect.addEventListener("change", () => {
      translationResults[index].group = levelSelect.value;
      updateTranslationRegistrationCount();
    });
    levelCell.appendChild(levelSelect);

    const statusCell = document.createElement("td");
    const updateStatus = () => {
      const invalidMeaning = !translationResults[index].translation.trim();
      const invalidLevel = !WORD_GROUPS.includes(String(translationResults[index].group));
      statusCell.className = `bulk-status ${result.error ? "error" : result.warning || result.duplicate || invalidMeaning || invalidLevel ? "warning" : ""}`;
      statusCell.textContent = result.error
        || result.duplicate
        || (invalidMeaning ? "日本語訳が空欄です" : "")
        || (invalidLevel ? "レベルが不正です" : "")
        || result.warning
        || "登録できます";
    };
    updateStatus();
    meaningInput.addEventListener("input", updateStatus);
    levelSelect.addEventListener("change", updateStatus);
    row.append(checkCell, wordCell, meaningCell, levelCell, statusCell);
    translationBody.appendChild(row);
  });
  translationReview.hidden = false;
  updateTranslationRegistrationCount();
}

// チェック済みで、入力内容が正しい単語の件数を登録前に表示します
function updateTranslationRegistrationCount() {
  const count = translationResults.filter((result) =>
    result.selected
    && result.translation.trim()
    && !result.error
    && !result.duplicate
    && WORD_GROUPS.includes(String(result.group))
  ).length;
  translationSelectionCount.textContent = `${count}件を登録します`;
  registerTranslationsButton.disabled = count === 0;
}

// 確認一覧を閉じても、元の一括入力文は消さずに残します
function cancelTranslationReview() {
  translationResults = [];
  translationBody.innerHTML = "";
  translationReview.hidden = true;
  translationProgress.textContent = "確認を取り消しました。入力内容は保存されていません。";
  bulkInput.focus();
}

// MyMemory APIへ1件ずつリクエストし、英語から日本語へ翻訳します
async function translateWords() {
  const words = bulkInput.value.split(/\r?\n/).map((word) => word.trim()).filter(Boolean);
  if (words.length === 0) {
    translationProgress.textContent = "英単語を1行に1件ずつ入力してください。";
    return;
  }

  translationResults = [];
  translationReview.hidden = true;
  translateButton.disabled = true;
  const seenWords = new Set();

  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    const lowerWord = word.toLowerCase();
    translationProgress.textContent = `翻訳中 ${index + 1} / ${words.length}：${word}`;

    const duplicate = vocabulary.some((item) => item.word.toLowerCase() === lowerWord)
      ? "登録済みのため除外"
      : seenWords.has(lowerWord)
        ? "入力内で重複しているため除外"
        : "";
    seenWords.add(lowerWord);
    if (duplicate) {
      translationResults.push({ word, translation: "", group: "500", selected: false, duplicate, error: "", warning: "" });
      continue;
    }

    try {
      // 入力文字列だけをencodeURIComponentで安全にURLへ埋め込みます
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en%7Cja`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const translatedText = data?.responseData?.translatedText;
      if (typeof translatedText !== "string" || !translatedText.trim()) throw new Error("翻訳結果がありません");
      const translation = translatedText.trim();
      const warning = translation.toLowerCase() === lowerWord ? "原文と同じ翻訳です。修正してください" : "";
      translationResults.push({ word, translation, group: "500", selected: true, duplicate: "", error: "", warning });
    } catch (error) {
      // 1件が失敗してもループを止めず、残りの単語を翻訳します
      translationResults.push({ word, translation: "", group: "500", selected: false, duplicate: "", error: `翻訳失敗：${error.message}`, warning: "" });
    }
  }

  translateButton.disabled = false;
  translationProgress.textContent = `翻訳完了：${words.length}件を確認してください。まだ保存されていません。`;
  renderTranslationReview();
}

// チェック済みで日本語訳のある結果だけをまとめて登録します
function registerTranslatedWords() {
  let addedCount = 0;
  translationResults.forEach((result) => {
    const meaning = result.translation.trim();
    const hasValidLevel = WORD_GROUPS.includes(String(result.group));
    const duplicateNow = vocabulary.some((item) => item.word.toLowerCase() === result.word.toLowerCase());
    if (!result.selected || !meaning || !hasValidLevel || result.error || result.duplicate || duplicateNow) {
      result.registered = false;
      return;
    }
    vocabulary.push({ id: createWordId(), word: result.word, meaning, group: result.group });
    result.registered = true;
    addedCount++;
  });

  if (addedCount > 0) saveVocabulary();

  // 登録できなかった行だけを、修正・再試行できるよう入力欄へ戻します
  const remainingWords = translationResults
    .filter((result) => !result.registered)
    .map((result) => result.word);
  bulkInput.value = remainingWords.join("\n");

  // 登録処理後は古い確認結果を画面とメモリの両方から消します
  translationResults = [];
  translationBody.innerHTML = "";
  translationReview.hidden = true;
  renderWordList();
  translationProgress.textContent = `${addedCount}件の単語を登録しました。${remainingWords.length ? `${remainingWords.length}件は未登録のため入力欄に残しています。` : ""}`;
  bulkInput.focus();
}

// 間違えた単語を、重複しないように復習リストへ追加します
function addReviewWord(word) {
  const reviewWords = loadReviewWords();
  if (!reviewWords.includes(word)) {
    reviewWords.push(word);
    saveReviewWords(reviewWords);
  }
}

// 復習モードで正解した単語を保存リストから削除します
function removeReviewWord(word) {
  saveReviewWords(loadReviewWords().filter((savedWord) => savedWord !== word));
}

function getDirectionLabel(direction) {
  if (direction === "random") return "日英ランダム";
  return direction === "english-to-japanese" ? "英語 → 日本語" : "日本語 → 英語";
}

// ランダムモードでは、問題を表示する直前にだけ実際の方向を決めます
function determineQuestionDirection(directionMode) {
  if (directionMode !== "random") return directionMode;
  return Math.random() < 0.5 ? "english-to-japanese" : "japanese-to-english";
}

// 表示中の1問に確定した方向で、問題文と正解を返します
function getQuestionContent(item, direction = currentQuestionDirection) {
  const isEnglishFirst = direction === "english-to-japanese";
  return {
    prompt: isEnglishFirst ? item.word : item.meaning,
    answer: isEnglishFirst ? item.meaning : item.word
  };
}

// 登録単語に品詞がない場合、日本語訳や語尾からおおよその品詞を判断します
function inferPartOfSpeech(item) {
  if (item.partOfSpeech) return item.partOfSpeech;
  if (item.meaning.endsWith("する") || item.meaning.endsWith("させる") || item.meaning.endsWith("る")) return "verb";
  if (item.meaning.endsWith("の") || item.meaning.endsWith("的な") || item.meaning.endsWith("できる")) return "adjective";
  if (item.meaning.endsWith("に") || item.word.endsWith("ly")) return "adverb";
  return "noun";
}

// 2つの英単語の綴りがどれくらい近いか調べるための編集距離です
function getEditDistance(first, second) {
  const a = first.toLowerCase();
  const b = second.toLowerCase();
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const oldValue = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = oldValue;
    }
  }
  return row[b.length];
}

// TOEICで特に混同しやすい語を同じグループとして扱います
const CONFUSABLE_GROUPS = [
  ["apply", "approve", "confirm", "submit", "verify"],
  ["personnel", "personal"], ["principal", "principle"],
  ["stationery", "stationary"], ["affect", "effect"],
  ["assure", "ensure", "insure"], ["economic", "economical"],
  ["complimentary", "complementary"], ["attend", "participate"],
  ["hire", "recruit"], ["resign", "retire"], ["invoice", "receipt"],
  ["shipment", "delivery"], ["salary", "wage"], ["fee", "charge"],
  ["request", "inquiry", "response"]
];

function areConfusable(firstWord, secondWord) {
  const first = firstWord.toLowerCase();
  const second = secondWord.toLowerCase();
  return CONFUSABLE_GROUPS.some((group) => group.includes(first) && group.includes(second));
}

// 正解に近く、ただし正解とはならない誤答を3つ選びます
function getDistractors(currentQuestion, direction, registeredWords = vocabulary) {
  const choicePool = Array.isArray(window.CHOICE_POOL) ? window.CHOICE_POOL : [];
  const correctWord = currentQuestion.word.toLowerCase();
  const correctMeaning = currentQuestion.meaning.trim();
  const correctPart = inferPartOfSpeech(currentQuestion);
  const outputKey = direction === "english-to-japanese" ? "meaning" : "word";
  const seenWords = new Set();
  const seenMeanings = new Set();

  // 選択肢専用語を中心にしつつ、登録単語も候補へ加えて不足時に補います
  const candidates = [...choicePool, ...registeredWords]
    .filter((item) => item && typeof item.word === "string" && typeof item.meaning === "string")
    .filter((item) => {
      const word = item.word.toLowerCase();
      const meaning = item.meaning.trim();
      if (word === correctWord || meaning === correctMeaning || seenWords.has(word) || seenMeanings.has(meaning)) return false;
      seenWords.add(word);
      seenMeanings.add(meaning);
      return true;
    })
    .map((item) => {
      let score = Math.random() * 8;
      const candidatePart = inferPartOfSpeech(item);
      if (candidatePart === correctPart) score += 70;
      if (areConfusable(currentQuestion.word, item.word)) score += 160;

      if (direction === "japanese-to-english") {
        const distance = getEditDistance(currentQuestion.word, item.word);
        score += Math.max(0, 65 - distance * 10);
        score += Math.max(0, 25 - Math.abs(currentQuestion.word.length - item.word.length) * 5);
        if (currentQuestion.word[0]?.toLowerCase() === item.word[0]?.toLowerCase()) score += 18;
      } else if (correctPart === "verb" && item.meaning.endsWith("する")) {
        score += 20;
      }
      return { item, answer: item[outputKey], score };
    })
    .sort((a, b) => b.score - a.score);

  const answers = [];
  const distractors = [];
  candidates.forEach((candidate) => {
    if (answers.length < 3 && !answers.includes(candidate.answer)) {
      answers.push(candidate.answer);
      distractors.push(candidate.item);
    }
  });
  return distractors;
}

// 正解1つと似た誤答3つを作り、正解位置を毎回ランダムにします
function createChoices(currentQuestion, direction = currentQuestionDirection) {
  return shuffle([currentQuestion, ...getDistractors(currentQuestion, direction)]);
}

// 選択肢専用データの単語を、重複しないよう登録単語へ追加します
function registerChoiceWord(item, button) {
  const alreadyRegistered = vocabulary.some(
    (registeredItem) => registeredItem.word.toLowerCase() === item.word.toLowerCase()
  );

  if (!alreadyRegistered) {
    vocabulary.push({ id: createWordId(), word: item.word, meaning: item.meaning, group: "500" });
    saveVocabulary();
    renderWordList();
  }

  // 連打しても登録されないよう、表示を変えてボタンを無効にします
  button.textContent = "登録済み";
  button.disabled = true;
}

// 回答後、4つすべての選択肢を英単語と日本語訳の組で解説します
function showChoiceExplanations(currentQuestion, selectedItem) {
  explanationList.innerHTML = "";

  currentChoiceItems.forEach((item) => {
    const isCorrect = item.word === currentQuestion.word && item.meaning === currentQuestion.meaning;
    const isSelectedWrong = !isCorrect
      && selectedItem
      && item.word === selectedItem.word
      && item.meaning === selectedItem.meaning;
    const isRegistered = vocabulary.some(
      (registeredItem) => registeredItem.word.toLowerCase() === item.word.toLowerCase()
    );
    const row = document.createElement("article");
    row.className = "explanation-item";
    if (isCorrect) row.classList.add("correct");
    if (isSelectedWrong) row.classList.add("selected-wrong");

    const text = document.createElement("div");
    text.className = "explanation-text";
    const word = document.createElement("strong");
    word.className = "explanation-word";
    word.textContent = item.word;
    const meaning = document.createElement("span");
    meaning.className = "explanation-meaning";
    meaning.textContent = item.meaning;
    text.append(word, meaning);
    row.appendChild(text);

    if (isCorrect || isSelectedWrong) {
      const status = document.createElement("span");
      status.className = "explanation-status";
      status.textContent = isCorrect ? "正解" : "あなたの回答";
      row.appendChild(status);
    }

    // 登録されていない選択肢専用語だけ、登録ボタンを表示します
    if (!isRegistered) {
      const registerButton = document.createElement("button");
      registerButton.type = "button";
      registerButton.className = "choice-register-button";
      registerButton.textContent = "この単語を登録";
      registerButton.addEventListener("click", () => registerChoiceWord(item, registerButton));
      row.appendChild(registerButton);
    }

    explanationList.appendChild(row);
  });

  explanationArea.hidden = false;
}

// 前の問題のタイマーを確実に停止します
function stopQuestionTimer() {
  if (timerIntervalId !== null) window.clearInterval(timerIntervalId);
  timerIntervalId = null;
}

// 終了予定時刻との差から表示を更新するため、タブを離れても時間がずれません
function updateTimerDisplay() {
  if (answered || selectedTimeLimit === 0) return;
  const remainingMilliseconds = Math.max(0, timerDeadline - Date.now());
  const remainingSeconds = Math.ceil(remainingMilliseconds / 1000);
  timerSecondsElement.textContent = `${remainingSeconds}秒`;
  timerBar.style.width = `${(remainingMilliseconds / (selectedTimeLimit * 1000)) * 100}%`;
  timerArea.classList.toggle("urgent", remainingMilliseconds <= 3000);

  if (remainingMilliseconds <= 0) handleTimeOut();
}

// 新しい問題が表示された時点からタイマーを開始します
function startQuestionTimer() {
  stopQuestionTimer();
  if (selectedTimeLimit === 0) {
    timerArea.hidden = true;
    return;
  }
  timerArea.hidden = false;
  timerArea.classList.remove("urgent");
  timerSecondsElement.textContent = `${selectedTimeLimit}秒`;
  timerBar.style.width = "100%";
  timerDeadline = Date.now() + selectedTimeLimit * 1000;
  timerIntervalId = window.setInterval(updateTimerDisplay, 100);
}

// 回答が確定した問題を、結果画面用の一時配列へ1回だけ記録します
function recordAttemptResult(result) {
  const questionNumber = currentIndex + 1;
  if (currentAttemptHistory.some((item) => item.questionNumber === questionNumber)) return;
  const currentQuestion = questions[currentIndex];
  currentAttemptHistory.push({
    questionNumber,
    wordId: currentQuestion.id,
    word: currentQuestion.word,
    meaning: currentQuestion.meaning,
    direction: currentQuestionDirection,
    result
  });
}

function getAttemptResultLabel(result) {
  if (result === "correct") return "正解";
  if (result === "timeout") return "時間切れ";
  return "不正解";
}

// HTML文字列を使わず、回答履歴から安全に一覧を作ります
function renderAttemptWords() {
  attemptWordsList.innerHTML = "";
  const visibleHistory = currentAttemptFilter === "mistakes"
    ? currentAttemptHistory.filter((item) => item.result === "incorrect" || item.result === "timeout")
    : currentAttemptHistory;

  attemptWordsEmpty.hidden = visibleHistory.length > 0;
  attemptWordsEmpty.textContent = currentAttemptFilter === "mistakes" && visibleHistory.length === 0
    ? "間違えた単語はありません。全問正解です！"
    : "今回の回答履歴はありません。";

  visibleHistory.forEach((item) => {
    const row = document.createElement("li");
    row.className = "attempt-word-item";
    row.setAttribute("aria-label", `${item.questionNumber}問目、${item.word}、${item.meaning}、${getAttemptResultLabel(item.result)}`);

    const number = document.createElement("span");
    number.className = "attempt-word-number";
    number.textContent = `${item.questionNumber}`;
    const text = document.createElement("div");
    text.className = "attempt-word-text";
    const word = document.createElement("strong");
    word.textContent = item.word;
    const meaning = document.createElement("span");
    meaning.textContent = item.meaning;
    text.append(word, meaning);
    const resultBadge = document.createElement("span");
    resultBadge.className = `attempt-result-badge attempt-result-${item.result}`;
    resultBadge.textContent = getAttemptResultLabel(item.result);
    row.append(number, text, resultBadge);
    attemptWordsList.appendChild(row);
  });
}

// 回答後と時間切れ後に共通して、選択肢・解説・次ボタンを表示します
function finishQuestion(selectedItem = null) {
  const currentQuestion = questions[currentIndex];
  const correctAnswer = getQuestionContent(currentQuestion, currentQuestionDirection).answer;
  document.querySelectorAll(".choice-button").forEach((button) => {
    button.disabled = true;
    if (button.dataset.answer === correctAnswer) button.classList.add("correct");
  });
  showChoiceExplanations(currentQuestion, selectedItem);
  scoreElement.textContent = score;
  nextButton.textContent = currentIndex === questions.length - 1 ? "結果を見る →" : "次の問題 →";
  nextButton.disabled = false;
  nextButton.hidden = false;
  nextButton.focus();
}

// 時間切れも通常の誤答と同じく、学習記録と復習リストへ1回だけ反映します
function handleTimeOut() {
  if (answered) return;
  answered = true;
  stopQuestionTimer();
  timedOutCount++;
  const currentQuestion = questions[currentIndex];
  const correctAnswer = getQuestionContent(currentQuestion, currentQuestionDirection).answer;
  recordAttemptResult("timeout");
  updateLearningRecord(currentQuestion.id, false);
  addReviewWord(currentQuestion.word);
  feedbackElement.textContent = `時間切れ。正解は「${correctAnswer}」です。`;
  feedbackElement.className = "feedback wrong-text";
  finishQuestion();
}

// 現在の問題を画面に表示します
function showQuestion() {
  stopQuestionTimer();
  answered = false;
  const currentQuestion = questions[currentIndex];
  // 方向は問題表示前に1回だけ決め、回答や時間切れまで再抽選しません
  currentQuestionDirection = determineQuestionDirection(selectedDirection);
  const questionContent = getQuestionContent(currentQuestion, currentQuestionDirection);
  const directionLabel = getDirectionLabel(currentQuestionDirection);
  wordElement.textContent = questionContent.prompt;
  currentNumberElement.textContent = currentIndex + 1;
  totalNumberElement.textContent = questions.length;
  scoreElement.textContent = score;
  progressBar.style.width = `${((currentIndex + 1) / questions.length) * 100}%`;
  const quizTypeLabel = isReviewMode ? "復習モード" : isWeakMode ? "苦手単語モード" : "通常クイズ";
  modeLabelElement.textContent = selectedDirection === "random"
    ? `${quizTypeLabel}｜日英ランダム｜今回：${directionLabel}`
    : `${quizTypeLabel}｜${directionLabel}`;
  quizGroupLabel.textContent = getGroupLabel(selectedWordGroup);
  choicesElement.setAttribute("aria-label", currentQuestionDirection === "english-to-japanese" ? "日本語の選択肢" : "英単語の選択肢");
  feedbackElement.textContent = "";
  feedbackElement.className = "feedback";
  explanationArea.hidden = true;
  explanationList.innerHTML = "";
  // ボタン領域は残し、回答するまではボタンだけを操作できない状態にします
  nextButton.disabled = true;
  nextButton.hidden = true;
  choicesElement.innerHTML = "";

  currentChoiceItems = createChoices(currentQuestion, currentQuestionDirection);
  currentChoiceItems.forEach((choiceItem, index) => {
    const choice = getQuestionContent(choiceItem, currentQuestionDirection).answer;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.dataset.answer = choice;
    const number = document.createElement("span");
    number.className = "choice-number";
    number.textContent = index + 1;
    const label = document.createElement("span");
    label.textContent = choice;
    button.append(number, label);
    button.addEventListener("click", () => checkAnswer(button, choiceItem));
    choicesElement.appendChild(button);
  });
  startQuestionTimer();
}

// 選んだ答えを確認し、正解・不正解を表示します
function checkAnswer(selectedButton, selectedItem) {
  if (answered) return;
  answered = true;
  stopQuestionTimer();
  const currentQuestion = questions[currentIndex];
  const correctAnswer = getQuestionContent(currentQuestion, currentQuestionDirection).answer;
  const selectedAnswer = getQuestionContent(selectedItem, currentQuestionDirection).answer;
  const isCorrect = selectedAnswer === correctAnswer;

  // answeredの確認後なので、連打されてもこの問題は1回だけ記録されます
  recordAttemptResult(isCorrect ? "correct" : "incorrect");
  updateLearningRecord(currentQuestion.id, isCorrect);

  if (isCorrect) {
    score++;
    feedbackElement.textContent = isReviewMode ? "正解！この単語を復習リストから削除しました。" : "正解！ Great job!";
    feedbackElement.classList.add("correct-text");
    if (isReviewMode) removeReviewWord(currentQuestion.word);
  } else {
    selectedButton.classList.add("wrong");
    feedbackElement.textContent = `不正解。正解は「${correctAnswer}」です。`;
    feedbackElement.classList.add("wrong-text");
    addReviewWord(currentQuestion.word);
  }

  finishQuestion(selectedItem);
}

// 全問終了後に成績を表示します
function showResult() {
  stopQuestionTimer();
  quizStatus.hidden = true;
  startArea.hidden = true;
  quizArea.hidden = true;
  resultArea.hidden = false;
  const incorrectCount = questions.length - score;
  const accuracyRate = questions.length === 0 ? 0 : Math.round((score / questions.length) * 100);
  finalScoreElement.textContent = score;
  finalTotalElement.textContent = ` / ${questions.length} 問正解`;
  correctCountElement.textContent = score;
  incorrectCountElement.textContent = incorrectCount;
  accuracyRateElement.textContent = `${accuracyRate}%`;
  renderAttemptWords();
  resultDirectionElement.textContent = getDirectionLabel(selectedDirection);
  resultGroupElement.textContent = getGroupLabel(selectedWordGroup);
  const usesTimer = selectedTimeLimit > 0;
  resultTimeSetting.hidden = !usesTimer;
  timeoutSummary.hidden = !usesTimer;

  // 時間切れ欄の有無に合わせて、結果カードの列数をCSSで切り替えます。
  resultSummaryElement.classList.toggle("has-timeout", usesTimer);
  resultSummaryElement.classList.toggle("no-timeout", !usesTimer);
  if (usesTimer) {
    resultTimeSetting.textContent = `制限時間：1問 ${selectedTimeLimit}秒`;
    timeoutCountElement.textContent = timedOutCount;
  }
  resultLabelElement.textContent = isReviewMode ? "REVIEW COMPLETE" : isWeakMode ? "WEAK WORDS COMPLETE" : "QUIZ COMPLETE";

  if (isReviewMode) {
    const remainingCount = loadReviewWords().length;
    resultMessageElement.textContent = remainingCount === 0
      ? "復習完了！間違えた単語はすべて覚えました。"
      : `あと${remainingCount}語が復習リストに残っています。`;
  } else if (isWeakMode) {
    resultMessageElement.textContent = "苦手単語の学習記録を更新しました。繰り返し挑戦して定着させましょう。";
  } else if (score === questions.length) {
    resultMessageElement.textContent = "パーフェクト！すべての単語をマスターしています。";
  } else if (score >= 7) {
    resultMessageElement.textContent = "いい調子です！間違えた単語を復習しましょう。";
  } else {
    resultMessageElement.textContent = "ここから伸びます。繰り返し挑戦して覚えましょう。";
  }
}

// 現在の通常・復習・苦手モードで候補になる単語を取得します
function getCurrentModeWords() {
  if (isReviewMode) {
    const reviewWords = loadReviewWords().map((word) => word.toLowerCase());
    return vocabulary.filter((item) => reviewWords.includes(item.word.toLowerCase()));
  }
  if (isWeakMode) return getWeakWords();
  return [...vocabulary];
}

function filterWordsBySelectedGroup(words) {
  return selectedWordGroup === "all"
    ? words
    : words.filter((item) => normalizeGroup(item.group) === selectedWordGroup);
}

// 通常・復習・苦手モードのグループ選択画面を表示します
function showQuestionCountSelection(mode = "normal") {
  stopQuestionTimer();
  isReviewMode = mode === "review";
  isWeakMode = mode === "weak";
  selectedWordGroup = "all";
  const modeWords = getCurrentModeWords();
  startModeLabel.textContent = isReviewMode ? "REVIEW MODE" : isWeakMode ? "WEAK WORDS" : "NORMAL QUIZ";
  startDescription.textContent = isReviewMode
    ? "復習する単語の目標スコアを選択してください。"
    : isWeakMode
      ? "苦手単語を目標スコアで絞り込めます。"
      : "出題する目標スコアを選択してください。";
  startArea.hidden = false;
  groupSelection.hidden = false;
  directionSelection.hidden = true;
  countSelection.hidden = true;
  quizStatus.hidden = true;
  quizArea.hidden = true;
  resultArea.hidden = true;
  groupButtons.forEach((button) => {
    const group = button.dataset.group;
    const count = group === "all"
      ? modeWords.length
      : modeWords.filter((item) => normalizeGroup(item.group) === group).length;
    button.disabled = count === 0;
    button.title = count === 0 ? "このグループには単語がありません" : "";
    button.setAttribute("aria-label", count === 0
      ? `${getGroupLabel(group)}、このグループには単語がありません`
      : `${getGroupLabel(group)}、${count}語`);
    button.classList.toggle("active", group === "all");
    button.setAttribute("aria-pressed", String(group === "all"));
  });
  groupCountElements.forEach((element) => {
    const group = element.dataset.groupCount;
    element.textContent = group === "all"
      ? modeWords.length
      : modeWords.filter((item) => normalizeGroup(item.group) === group).length;
  });
  reviewMessageElement.textContent = isReviewMode && modeWords.length === 0
    ? "復習する単語はありません。まずは通常クイズに挑戦しましょう。"
    : isWeakMode && modeWords.length === 0
      ? "学習記録のある単語がありません。まずは通常クイズに挑戦しましょう。"
      : "";
}

// 目標スコアを決定して、出題方向の選択へ進みます
function selectWordGroup(group) {
  selectedWordGroup = group === "all" ? "all" : normalizeGroup(group);
  const targetWords = filterWordsBySelectedGroup(getCurrentModeWords());
  if (targetWords.length === 0) {
    reviewMessageElement.textContent = "このグループには単語がありません。";
    return;
  }
  groupButtons.forEach((button) => {
    const isSelected = button.dataset.group === selectedWordGroup;
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  reviewMessageElement.textContent = "";
  groupSelection.hidden = true;
  directionSelection.hidden = false;
}

// 出題方向を決定し、次の出題数選択へ進みます
function selectDirection(direction) {
  if (!["english-to-japanese", "japanese-to-english", "random"].includes(direction)) return;
  selectedDirection = direction;
  const directionLabel = getDirectionLabel(direction);
  directionButtons.forEach((button) => {
    const isSelected = button.dataset.direction === direction;
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  selectedDirectionLabel.textContent = `${getGroupLabel(selectedWordGroup)}｜${directionLabel}`;
  directionSelection.hidden = true;
  countSelection.hidden = false;
}

// 選択した問題数でクイズを開始します
function startQuiz(questionCount = selectedQuestionCount) {
  selectedQuestionCount = questionCount;
  const groupedWords = filterWordsBySelectedGroup(getCurrentModeWords());
  // 苦手モードは正答率順を保ち、それ以外は対象グループ内をランダムにします
  const sourceWords = isWeakMode ? groupedWords : shuffle(groupedWords);

  if (isReviewMode && sourceWords.length === 0) {
    showQuestionCountSelection("review");
    return;
  }

  if (isWeakMode && sourceWords.length === 0) {
    showQuestionCountSelection("weak");
    return;
  }

  // 必要数だけ切り出すため、同じ単語は重複しません
  questions = sourceWords.slice(0, Math.min(selectedQuestionCount, sourceWords.length));
  currentIndex = 0;
  score = 0;
  timedOutCount = 0;
  answered = false;
  // 新しい挑戦では、前回の結果一覧を引き継ぎません
  currentAttemptHistory = [];
  currentAttemptFilter = "all";
  attemptFilterButtons.forEach((button) => {
    const isSelected = button.dataset.attemptFilter === "all";
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  attemptWordsList.innerHTML = "";
  attemptWordsEmpty.hidden = true;
  resultTimeSetting.hidden = true;
  timeoutSummary.hidden = true;
  // 開始直後や開始できなかった結果では、非表示の時間切れ欄が空白を作らないようにします。
  resultSummaryElement.classList.remove("has-timeout");
  resultSummaryElement.classList.add("no-timeout");
  startArea.hidden = true;
  quizStatus.hidden = false;
  quizArea.hidden = false;
  resultArea.hidden = true;
  reviewMessageElement.textContent = "";

  // 誤答は全グループと選択肢専用データから補うため、対象グループが少数でも開始できます
  const directionsToValidate = selectedDirection === "random"
    ? ["english-to-japanese", "japanese-to-english"]
    : [selectedDirection];
  if (questions.length === 0 || directionsToValidate.some((direction) => getDistractors(questions[0], direction).length < 3)) {
    quizStatus.hidden = true;
    quizArea.hidden = true;
    resultArea.hidden = false;
    resultLabelElement.textContent = "VOCABULARY NEEDED";
    finalScoreElement.textContent = "0";
    finalTotalElement.textContent = " / 0 問";
    correctCountElement.textContent = "0";
    incorrectCountElement.textContent = "0";
    accuracyRateElement.textContent = "0%";
    resultDirectionElement.textContent = getDirectionLabel(selectedDirection);
    resultGroupElement.textContent = getGroupLabel(selectedWordGroup);
    resultMessageElement.textContent = questions.length === 0
      ? "このグループには出題できる単語がありません。"
      : "重複しない4択候補を作れません。単語または選択肢専用データを確認してください。";
    return;
  }
  showQuestion();
}

// 復習ボタンから復習用の出題数選択画面を開きます
function startReview() {
  showQuestionCountSelection("review");
}

nextButton.addEventListener("click", () => {
  stopQuestionTimer();
  currentIndex++;
  if (currentIndex < questions.length) showQuestion();
  else showResult();
});

reviewButton.addEventListener("click", startReview);
normalButton.addEventListener("click", () => showQuestionCountSelection("normal"));
weakButton.addEventListener("click", () => showQuestionCountSelection("weak"));
countButtons.forEach((button) => {
  button.addEventListener("click", () => startQuiz(Number(button.dataset.count)));
});
timeLimitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedTimeLimit = Number(button.dataset.seconds);
    timeLimitButtons.forEach((item) => {
      const isSelected = item === button;
      item.classList.toggle("active", isSelected);
      item.setAttribute("aria-pressed", String(isSelected));
    });
  });
});
groupButtons.forEach((button) => {
  button.addEventListener("click", () => selectWordGroup(button.dataset.group));
});
directionButtons.forEach((button) => {
  button.addEventListener("click", () => selectDirection(button.dataset.direction));
});
attemptFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentAttemptFilter = button.dataset.attemptFilter === "mistakes" ? "mistakes" : "all";
    attemptFilterButtons.forEach((item) => {
      const isSelected = item === button;
      item.classList.toggle("active", isSelected);
      item.setAttribute("aria-pressed", String(isSelected));
    });
    renderAttemptWords();
  });
});
changeGroupButton.addEventListener("click", () => {
  groupSelection.hidden = false;
  directionSelection.hidden = true;
});
changeDirectionButton.addEventListener("click", () => {
  directionSelection.hidden = false;
  countSelection.hidden = true;
});
retryButton.addEventListener("click", () => startQuiz(selectedQuestionCount));
backToSelectionButton.addEventListener("click", () => {
  showQuestionCountSelection(isReviewMode ? "review" : isWeakMode ? "weak" : "normal");
});
manageButton.addEventListener("click", openManagement);
showDeletedButton.addEventListener("click", openDeletedWords);
deletedBackButton.addEventListener("click", closeDeletedWords);
restoreAllButton.addEventListener("click", restoreAllDeletedWords);
deleteAllForeverButton.addEventListener("click", permanentlyDeleteAllWords);
recordsButton.addEventListener("click", openRecords);
recordsBackButton.addEventListener("click", closeRecords);
resetAllRecordsButton.addEventListener("click", resetAllRecords);
exportButton.addEventListener("click", exportBackup);
importInput.addEventListener("change", importBackup);
translateButton.addEventListener("click", translateWords);
registerTranslationsButton.addEventListener("click", registerTranslatedWords);
cancelTranslationButton.addEventListener("click", cancelTranslationReview);
bulkLevelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const level = button.dataset.bulkLevel;
    if (!WORD_GROUPS.includes(level)) return;
    // 一括変更後も、各行の選択欄から個別に変更できます
    translationResults.forEach((result) => { result.group = level; });
    renderTranslationReview();
  });
});
sortButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentRecordSort = button.dataset.sort;
    sortButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderLearningRecords();
  });
});
recordLevelFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentRecordGroup = WORD_GROUPS.includes(button.dataset.recordGroup) ? button.dataset.recordGroup : "all";
    recordLevelFilterButtons.forEach((item) => {
      const isSelected = item === button;
      item.classList.toggle("active", isSelected);
      item.setAttribute("aria-pressed", String(isSelected));
    });
    renderLearningRecords();
  });
});
backButton.addEventListener("click", closeManagement);
wordForm.addEventListener("submit", addWord);
searchInput.addEventListener("input", renderWordList);
selectVisibleCheckbox.addEventListener("change", () => {
  if (selectVisibleCheckbox.checked) {
    currentVisibleWordIds.forEach((id) => selectedWordIds.add(id));
  } else {
    currentVisibleWordIds.forEach((id) => selectedWordIds.delete(id));
  }
  renderWordList();
});
clearWordSelectionButton.addEventListener("click", () => {
  selectedWordIds.clear();
  renderWordList();
});
deleteSelectedWordsButton.addEventListener("click", deleteSelectedWords);
changeSelectedGroupButton.addEventListener("click", changeSelectedWordsGroup);
groupFilterSelect.addEventListener("change", () => {
  currentGroupFilter = groupFilterSelect.value;
  renderWordList();
});
wordSortSelect.addEventListener("change", () => {
  currentWordSort = wordSortSelect.value;
  renderWordList();
});
cancelEditButton.addEventListener("click", cancelEditing);
window.addEventListener("pagehide", stopQuestionTimer);

// キーボードの1〜4でも選択できるようにします
document.addEventListener("keydown", (event) => {
  if (answered || quizArea.hidden || event.key < "1" || event.key > "4") return;
  const buttons = choicesElement.querySelectorAll(".choice-button");
  buttons[Number(event.key) - 1]?.click();
});

// ページを開いたら件数を表示し、通常クイズの出題数選択を表示します
updateReviewCount();
updateDeletedCount();
showQuestionCountSelection("normal");
