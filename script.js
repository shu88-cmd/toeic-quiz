// TOEIC頻出単語と、日本語の意味を登録します
const DEFAULT_VOCABULARY = [
  { word: "candidate", meaning: "候補者" },
  { word: "purchase", meaning: "購入する" },
  { word: "available", meaning: "利用できる" },
  { word: "conference", meaning: "会議" },
  { word: "require", meaning: "必要とする" },
  { word: "approximately", meaning: "およそ" },
  { word: "department", meaning: "部署" },
  { word: "submit", meaning: "提出する" },
  { word: "maintain", meaning: "維持する" },
  { word: "annual", meaning: "年に一度の" },
  { word: "firm", meaning: "会社" },
  { word: "confirm", meaning: "確認する" },
  { word: "agency", meaning: "代理店" },
  { word: "upcoming", meaning: "近日中の" },
  { word: "arrange", meaning: "手配する" },
  { word: "corporate", meaning: "企業の" },
  { word: "procedure", meaning: "手順" },
  { word: "personnel", meaning: "職員" },
  { word: "representative", meaning: "代表者" },
  { word: "documents", meaning: "書類" },
  { word: "extension", meaning: "内線" },
  { word: "inquire", meaning: "問い合わせる" },
  { word: "merchandise", meaning: "商品" },
  { word: "headquarters", meaning: "本社" },
  { word: "admission", meaning: "入場" },
  { word: "district", meaning: "地区" },
  { word: "former", meaning: "以前の" },
  { word: "complaints", meaning: "苦情" },
  { word: "concerning", meaning: "〜に関して" },
  { word: "reputation", meaning: "評判" }
];

// localStorageで使う保存名です。ブラウザを閉じてもデータが残ります
const WORD_STORAGE_KEY = "toeicQuizVocabulary";
const REVIEW_STORAGE_KEY = "toeicQuizReviewWords";
const LEARNING_STORAGE_KEY = "toeicQuizLearningRecords";

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
      const initialWords = DEFAULT_VOCABULARY.map((item) => ({ ...item, id: createWordId() }));
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
      validWords.push({ word, meaning, id });
    });
    // IDがなかった既存データも、ここでID付きとして保存し直します
    localStorage.setItem(WORD_STORAGE_KEY, JSON.stringify(validWords));
    return validWords;
  } catch (error) {
    // 保存データが壊れている場合は、標準の単語で安全に開始します
    const initialWords = DEFAULT_VOCABULARY.map((item) => ({ ...item, id: createWordId() }));
    localStorage.setItem(WORD_STORAGE_KEY, JSON.stringify(initialWords));
    return initialWords;
  }
}

let vocabulary = loadVocabulary();

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
const directionSelection = document.getElementById("direction-selection");
const countSelection = document.getElementById("count-selection");
const selectedDirectionLabel = document.getElementById("selected-direction-label");
const changeDirectionButton = document.getElementById("change-direction-button");
const resultDirectionElement = document.getElementById("result-direction");
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
const wordListElement = document.getElementById("word-list");
const wordCountElement = document.getElementById("word-count");
const formMessageElement = document.getElementById("form-message");
const searchInput = document.getElementById("search-input");
const submitWordButton = document.getElementById("submit-word-button");
const cancelEditButton = document.getElementById("cancel-edit-button");
const recordsView = document.getElementById("records-view");
const recordsButton = document.getElementById("records-button");
const recordsBackButton = document.getElementById("records-back-button");
const recordsBody = document.getElementById("records-body");
const recordsMessage = document.getElementById("records-message");
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

let questions = [];
let currentIndex = 0;
let score = 0;
let answered = false;
let isReviewMode = false;
let isWeakMode = false;
let editingWord = null;
let selectedQuestionCount = 10;
let selectedDirection = "english-to-japanese";
let currentRecordSort = "weak";
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
  const total = record.correct + record.incorrect;
  const rate = total === 0 ? 0 : Math.round((record.correct / total) * 100);
  return { correct: record.correct, incorrect: record.incorrect, total, rate };
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

// 選択された順番で学習記録の表を描画します
function renderLearningRecords() {
  const records = loadLearningRecords();
  const sortedWords = [...vocabulary].sort((a, b) => {
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
  sortedWords.forEach((item) => {
    const values = getRecordValues(item, records);
    const row = document.createElement("tr");
    [item.word, item.meaning, values.correct, values.incorrect, values.total].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    const rateCell = document.createElement("td");
    const rateBadge = document.createElement("span");
    rateBadge.className = `rate-badge ${values.rate < 50 ? "rate-low" : values.rate < 80 ? "rate-mid" : "rate-high"}`;
    rateBadge.textContent = `${values.rate}%`;
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
  recordsView.hidden = false;
  recordsMessage.textContent = "";
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
  recordsMessage.textContent = `「${item.word}」の記録をリセットしました。`;
}

function resetAllRecords() {
  if (!window.confirm("すべての学習記録をリセットしますか？単語は削除されません。")) return;
  saveLearningRecords({});
  renderLearningRecords();
  recordsMessage.textContent = "すべての学習記録をリセットしました。";
}

// 単語・復習リスト・学習記録を1つのJSONにまとめてダウンロードします
function exportBackup() {
  const backup = {
    format: "toeic-word-quiz-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    vocabulary,
    reviewWords: loadReviewWords(),
    learningRecords: loadLearningRecords()
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
    return { id, word, meaning };
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
  return { vocabulary: restoredWords, reviewWords: restoredReviews, learningRecords: restoredRecords };
}

// ファイル全体の検証が終わってから、確認を表示して現在データを置き換えます
async function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error("ファイルサイズが大きすぎます。");
    const restored = validateBackup(JSON.parse(await file.text()));
    if (!window.confirm("現在の単語・復習リスト・学習記録を、読み込んだバックアップで上書きしますか？")) return;

    // 保存途中で失敗した場合に戻せるよう、現在値を一時的に保持します
    const previous = {
      words: localStorage.getItem(WORD_STORAGE_KEY),
      reviews: localStorage.getItem(REVIEW_STORAGE_KEY),
      records: localStorage.getItem(LEARNING_STORAGE_KEY)
    };
    try {
      localStorage.setItem(WORD_STORAGE_KEY, JSON.stringify(restored.vocabulary));
      localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(restored.reviewWords));
      localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(restored.learningRecords));
    } catch (saveError) {
      if (previous.words === null) localStorage.removeItem(WORD_STORAGE_KEY); else localStorage.setItem(WORD_STORAGE_KEY, previous.words);
      if (previous.reviews === null) localStorage.removeItem(REVIEW_STORAGE_KEY); else localStorage.setItem(REVIEW_STORAGE_KEY, previous.reviews);
      if (previous.records === null) localStorage.removeItem(LEARNING_STORAGE_KEY); else localStorage.setItem(LEARNING_STORAGE_KEY, previous.records);
      throw new Error("データを保存できませんでした。");
    }

    vocabulary = restored.vocabulary;
    updateReviewCount();
    renderWordList();
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

// 登録中の単語を1行ずつ一覧表示します
function renderWordList() {
  wordListElement.innerHTML = "";
  wordCountElement.textContent = vocabulary.length;
  const keyword = searchInput.value.trim().toLowerCase();

  // 元の配列を変更しないようコピーしてから、大小文字を無視して並べ替えます
  const visibleWords = [...vocabulary]
    .sort((a, b) => a.word.localeCompare(b.word, "en", { sensitivity: "base" }))
    .filter((item) =>
      item.word.toLowerCase().includes(keyword) || item.meaning.toLowerCase().includes(keyword)
    );

  if (visibleWords.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-list";
    emptyItem.textContent = vocabulary.length === 0
      ? "単語が登録されていません。上のフォームから追加してください。"
      : "検索条件に一致する単語はありません。";
    wordListElement.appendChild(emptyItem);
    return;
  }

  visibleWords.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.className = "word-item";

    const english = document.createElement("span");
    english.className = "word-english";
    english.textContent = item.word;

    const japanese = document.createElement("span");
    japanese.className = "word-japanese";
    japanese.textContent = item.meaning;

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
    listItem.append(english, japanese, actionArea);
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
  submitWordButton.textContent = "変更を保存";
  cancelEditButton.hidden = false;
  showFormMessage(`「${item.word}」を編集中です。`, "success");
  englishInput.focus();
}

// 編集状態を解除して、追加用のフォームへ戻します
function cancelEditing() {
  editingWord = null;
  wordForm.reset();
  submitWordButton.textContent = "単語を追加";
  cancelEditButton.hidden = true;
  formMessageElement.textContent = "";
}

// 管理画面を開き、最新の一覧を表示します
function openManagement() {
  stopQuestionTimer();
  quizView.hidden = true;
  recordsView.hidden = true;
  managementView.hidden = false;
  formMessageElement.textContent = "";
  searchInput.value = "";
  cancelEditing();
  renderWordList();
  englishInput.focus();
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
  vocabulary = vocabulary.filter((item) => item.word.toLowerCase() !== word.toLowerCase());
  saveVocabulary();

  // 単語を削除したときは、その固定IDの学習記録も削除します
  if (deletedItem) {
    const records = loadLearningRecords();
    delete records[deletedItem.id];
    saveLearningRecords(records);
  }

  // 削除した単語が復習リストに残らないようにします
  const updatedReviewWords = loadReviewWords().filter((savedWord) => savedWord.toLowerCase() !== word.toLowerCase());
  saveReviewWords(updatedReviewWords);
  if (editingWord && editingWord.toLowerCase() === word.toLowerCase()) cancelEditing();
  renderWordList();
  showFormMessage(`「${word}」を削除しました。`, "success");
}

// 入力された新しい単語をチェックして登録します
function addWord(event) {
  event.preventDefault();
  const word = englishInput.value.trim();
  const meaning = japaneseInput.value.trim();

  if (!word || !meaning) {
    showFormMessage("英単語と日本語訳の両方を入力してください。");
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

  vocabulary.push({ word, meaning, id: createWordId() });
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
    checkbox.addEventListener("change", () => { translationResults[index].selected = checkbox.checked; });
    checkCell.appendChild(checkbox);

    const wordCell = document.createElement("td");
    wordCell.textContent = result.word;

    const meaningCell = document.createElement("td");
    const meaningInput = document.createElement("input");
    meaningInput.type = "text";
    meaningInput.value = result.translation;
    meaningInput.disabled = Boolean(result.error || result.duplicate);
    meaningInput.addEventListener("input", () => { translationResults[index].translation = meaningInput.value; });
    meaningCell.appendChild(meaningInput);

    const statusCell = document.createElement("td");
    statusCell.className = `bulk-status ${result.error ? "error" : result.warning || result.duplicate ? "warning" : ""}`;
    statusCell.textContent = result.error || result.duplicate || result.warning || "翻訳済み";
    row.append(checkCell, wordCell, meaningCell, statusCell);
    translationBody.appendChild(row);
  });
  translationReview.hidden = false;
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
      translationResults.push({ word, translation: "", selected: false, duplicate, error: "", warning: "" });
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
      translationResults.push({ word, translation, selected: true, duplicate: "", error: "", warning });
    } catch (error) {
      // 1件が失敗してもループを止めず、残りの単語を翻訳します
      translationResults.push({ word, translation: "", selected: false, duplicate: "", error: `翻訳失敗：${error.message}`, warning: "" });
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
    const duplicateNow = vocabulary.some((item) => item.word.toLowerCase() === result.word.toLowerCase());
    if (!result.selected || !meaning || result.error || result.duplicate || duplicateNow) {
      result.registered = false;
      return;
    }
    vocabulary.push({ id: createWordId(), word: result.word, meaning });
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

// 現在の出題方向で表示する文字と正解を返します
function getQuestionContent(item) {
  const isEnglishFirst = selectedDirection === "english-to-japanese";
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
function createChoices(currentQuestion) {
  return shuffle([currentQuestion, ...getDistractors(currentQuestion, selectedDirection)]);
}

// 選択肢専用データの単語を、重複しないよう登録単語へ追加します
function registerChoiceWord(item, button) {
  const alreadyRegistered = vocabulary.some(
    (registeredItem) => registeredItem.word.toLowerCase() === item.word.toLowerCase()
  );

  if (!alreadyRegistered) {
    vocabulary.push({ id: createWordId(), word: item.word, meaning: item.meaning });
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

// 回答後と時間切れ後に共通して、選択肢・解説・次ボタンを表示します
function finishQuestion(selectedItem = null) {
  const currentQuestion = questions[currentIndex];
  const correctAnswer = getQuestionContent(currentQuestion).answer;
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
  const correctAnswer = getQuestionContent(currentQuestion).answer;
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
  const questionContent = getQuestionContent(currentQuestion);
  const directionLabel = selectedDirection === "english-to-japanese" ? "英語 → 日本語" : "日本語 → 英語";
  wordElement.textContent = questionContent.prompt;
  currentNumberElement.textContent = currentIndex + 1;
  totalNumberElement.textContent = questions.length;
  scoreElement.textContent = score;
  progressBar.style.width = `${((currentIndex + 1) / questions.length) * 100}%`;
  const quizTypeLabel = isReviewMode ? "復習モード" : isWeakMode ? "苦手単語モード" : "通常クイズ";
  modeLabelElement.textContent = `${quizTypeLabel}｜${directionLabel}`;
  choicesElement.setAttribute("aria-label", selectedDirection === "english-to-japanese" ? "日本語の選択肢" : "英単語の選択肢");
  feedbackElement.textContent = "";
  feedbackElement.className = "feedback";
  explanationArea.hidden = true;
  explanationList.innerHTML = "";
  // ボタン領域は残し、回答するまではボタンだけを操作できない状態にします
  nextButton.disabled = true;
  nextButton.hidden = true;
  choicesElement.innerHTML = "";

  currentChoiceItems = createChoices(currentQuestion);
  currentChoiceItems.forEach((choiceItem, index) => {
    const choice = getQuestionContent(choiceItem).answer;
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
  const correctAnswer = getQuestionContent(currentQuestion).answer;
  const selectedAnswer = getQuestionContent(selectedItem).answer;
  const isCorrect = selectedAnswer === correctAnswer;

  // answeredの確認後なので、連打されてもこの問題は1回だけ記録されます
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
  resultDirectionElement.textContent = selectedDirection === "english-to-japanese" ? "英語 → 日本語" : "日本語 → 英語";
  const usesTimer = selectedTimeLimit > 0;
  resultTimeSetting.hidden = !usesTimer;
  timeoutSummary.hidden = !usesTimer;
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

// 通常・復習モードの出題数選択画面を表示します
function showQuestionCountSelection(mode = "normal") {
  stopQuestionTimer();
  isReviewMode = mode === "review";
  isWeakMode = mode === "weak";
  const hasReviewWords = loadReviewWords().length > 0;
  const hasWeakWords = getWeakWords().length > 0;
  startModeLabel.textContent = isReviewMode ? "REVIEW MODE" : isWeakMode ? "WEAK WORDS" : "NORMAL QUIZ";
  startDescription.textContent = isReviewMode
    ? "復習する問題と答えの方向を選択してください。"
    : isWeakMode
      ? "正答率の低い単語から優先して出題します。"
      : "問題と答えの方向を選択してください。";
  startArea.hidden = false;
  directionSelection.hidden = false;
  countSelection.hidden = true;
  quizStatus.hidden = true;
  quizArea.hidden = true;
  resultArea.hidden = true;
  countButtons.forEach((button) => {
    button.disabled = (isReviewMode && !hasReviewWords) || (isWeakMode && !hasWeakWords);
  });
  directionButtons.forEach((button) => {
    button.disabled = (isReviewMode && !hasReviewWords) || (isWeakMode && !hasWeakWords);
  });
  reviewMessageElement.textContent = isReviewMode && !hasReviewWords
    ? "復習する単語はありません。まずは通常クイズに挑戦しましょう。"
    : isWeakMode && !hasWeakWords
      ? "学習記録のある単語がありません。まずは通常クイズに挑戦しましょう。"
      : "";
}

// 出題方向を決定し、次の出題数選択へ進みます
function selectDirection(direction) {
  selectedDirection = direction;
  selectedDirectionLabel.textContent = direction === "english-to-japanese"
    ? "英語 → 日本語"
    : "日本語 → 英語";
  directionSelection.hidden = true;
  countSelection.hidden = false;
}

// 選択した問題数でクイズを開始します
function startQuiz(questionCount = selectedQuestionCount) {
  selectedQuestionCount = questionCount;
  const sourceWords = isReviewMode
    ? shuffle(vocabulary.filter((item) => loadReviewWords().includes(item.word)))
    : isWeakMode
      ? getWeakWords()
      : shuffle(vocabulary);

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
  resultTimeSetting.hidden = true;
  timeoutSummary.hidden = true;
  startArea.hidden = true;
  quizStatus.hidden = false;
  quizArea.hidden = false;
  resultArea.hidden = true;
  reviewMessageElement.textContent = "";

  const answerCandidates = selectedDirection === "english-to-japanese"
    ? vocabulary.map((item) => item.meaning)
    : vocabulary.map((item) => item.word);

  // 4択を作れない場合は、管理画面から単語を追加するよう案内します
  if (questions.length === 0 || vocabulary.length < 4 || new Set(answerCandidates).size < 4) {
    quizStatus.hidden = true;
    quizArea.hidden = true;
    resultArea.hidden = false;
    resultLabelElement.textContent = "VOCABULARY NEEDED";
    finalScoreElement.textContent = "0";
    finalTotalElement.textContent = " / 0 問";
    correctCountElement.textContent = "0";
    incorrectCountElement.textContent = "0";
    accuracyRateElement.textContent = "0%";
    resultDirectionElement.textContent = selectedDirection === "english-to-japanese" ? "英語 → 日本語" : "日本語 → 英語";
    resultMessageElement.textContent = "4択クイズには、重複しない選択肢を作れる単語が4語以上必要です。単語管理から追加してください。";
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
directionButtons.forEach((button) => {
  button.addEventListener("click", () => selectDirection(button.dataset.direction));
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
recordsButton.addEventListener("click", openRecords);
recordsBackButton.addEventListener("click", closeRecords);
resetAllRecordsButton.addEventListener("click", resetAllRecords);
exportButton.addEventListener("click", exportBackup);
importInput.addEventListener("change", importBackup);
translateButton.addEventListener("click", translateWords);
registerTranslationsButton.addEventListener("click", registerTranslatedWords);
sortButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentRecordSort = button.dataset.sort;
    sortButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderLearningRecords();
  });
});
backButton.addEventListener("click", closeManagement);
wordForm.addEventListener("submit", addWord);
searchInput.addEventListener("input", renderWordList);
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
showQuestionCountSelection("normal");
