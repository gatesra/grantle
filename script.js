// --- CONFIG ---
const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

// Words + dictionary will be loaded from JSON
let WORDS = [];
let DICTIONARY = new Set();
let solution = "";

let currentRow = 0;
let currentCol = 0;
let isGameOver = false;

const board = document.getElementById("board");
const messageEl = document.getElementById("message");
const keyboard = document.getElementById("keyboard");
const dayLabel = document.getElementById("day-label");

const KEY_ROWS = [
  "qwertyuiop".split(""),
  "asdfghjkl".split(""),
  ["Enter", ..."zxcvbnm".split(""), "Backspace"]
];

const tileGrid = [];
const keyButtons = {};

// --- LOAD WORDS THEN START GAME ---
async function loadWords() {
  try {
    const res = await fetch("words-gaming.json");
    if (!res.ok) throw new Error("Failed to load word list");

    const data = await res.json();

    if (!Array.isArray(data.solutions) || !Array.isArray(data.allowed)) {
      throw new Error("Invalid word file structure");
    }

    WORDS = data.solutions.map(w => w.toLowerCase());
    DICTIONARY = new Set(
      [...data.solutions, ...data.allowed].map(w => w.toLowerCase())
    );

    if (WORDS.length === 0) {
      throw new Error("No solution words found");
    }

    startGame();
  } catch (err) {
    console.error(err);
    showMessage("Error loading words. Check console.", 5000);
  }
}

// --- DAILY WORD PICKER ---
function getTodayIndex() {
  // Epoch: you can change this to your launch date
  const epoch = new Date(2025, 0, 1); // Jan 1, 2025
  const today = new Date();

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSinceEpoch = Math.floor(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(epoch.getFullYear(), epoch.getMonth(), epoch.getDate())) /
      msPerDay
  );

  return daysSinceEpoch;
}

function getTodaySolution(words) {
  const dayIndex = getTodayIndex();
  const index = ((dayIndex % words.length) + words.length) % words.length;
  return { word: words[index], dayIndex };
}

// --- START GAME ---
function startGame() {
  const { word, dayIndex } = getTodaySolution(WORDS);
  solution = word;
  console.log("Today's solution (for debugging):", solution);

  if (dayLabel) {
    dayLabel.textContent = `Day #${dayIndex}`;
  }

  initBoard();
  initKeyboard();
  attachKeyboardListeners();
}

// --- UI INIT ---
function initBoard() {
  for (let r = 0; r < MAX_GUESSES; r++) {
    const rowEl = document.createElement("div");
    rowEl.classList.add("row");
    const rowTiles = [];

    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement("div");
      tile.classList.add("tile");
      rowEl.appendChild(tile);
      rowTiles.push(tile);
    }

    board.appendChild(rowEl);
    tileGrid.push(rowTiles);
  }
}

function initKeyboard() {
  KEY_ROWS.forEach(row => {
    const rowEl = document.createElement("div");
    rowEl.classList.add("keyboard-row");

    row.forEach(key => {
      const button = document.createElement("button");
      button.classList.add("key");

      if (key === "Enter" || key === "Backspace") {
        button.classList.add("wide");
      }

      button.dataset.key = key.toLowerCase();
      button.textContent = key === "Backspace" ? "⌫" : key;
      button.addEventListener("click", () => handleKey(key.toLowerCase()));
      rowEl.appendChild(button);
      keyButtons[key.toLowerCase()] = button;
    });

    keyboard.appendChild(rowEl);
  });
}

function attachKeyboardListeners() {
  document.addEventListener("keydown", e => {
    const key = e.key.toLowerCase();
    if (key === "enter" || key === "backspace" || /^[a-z]$/.test(key)) {
      e.preventDefault();
      handleKey(key);
    }
  });
}

// --- HELPERS ---
function showMessage(text, duration = 1200) {
  messageEl.textContent = text;
  messageEl.classList.add("visible");
  if (duration) {
    setTimeout(() => {
      messageEl.classList.remove("visible");
    }, duration);
  }
}

function getCurrentGuess() {
  const letters = tileGrid[currentRow].map(tile => tile.textContent || "");
  return letters.join("").toLowerCase();
}

function setTileLetter(row, col, letter) {
  tileGrid[row][col].textContent = letter.toUpperCase();
}

function clearTile(row, col) {
  tileGrid[row][col].textContent = "";
}

// --- INPUT HANDLING ---
function handleKey(key) {
  if (isGameOver) return;

  if (key === "enter") {
    submitGuess();
  } else if (key === "backspace" || key === "delete") {
    if (currentCol > 0) {
      currentCol--;
      clearTile(currentRow, currentCol);
    }
  } else if (/^[a-z]$/.test(key)) {
    if (currentCol < WORD_LENGTH) {
      setTileLetter(currentRow, currentCol, key);
      currentCol++;
    }
  }
}

// --- GUESS LOGIC ---
function submitGuess() {
  if (currentCol < WORD_LENGTH) {
    showMessage("Not enough letters");
    return;
  }

  const guess = getCurrentGuess();

  // Your request: even if the word isn't in the list,
  // still evaluate it and move to the next row.
  // If you ever want to enforce the list, uncomment this:
  //
  // if (!DICTIONARY.has(guess)) {
  //   showMessage("Not in word list");
  //   return;
  // }

  revealGuess(guess);
}

function revealGuess(guess) {
  const statuses = evaluateGuess(guess, solution);

  statuses.forEach((status, i) => {
    const tile = tileGrid[currentRow][i];
    setTimeout(() => {
      // Clear previous state before applying new one
      tile.classList.remove("correct", "present", "absent", "win");
      tile.classList.add("flip");
      tile.classList.add(status); // correct / present / absent
    }, i * 220);

    updateKeyState(guess[i], status);
  });

  setTimeout(() => {
    if (guess === solution) {
      isGameOver = true;
      showMessage("You got it!", 2000);

      // Bounce animation on winning row
      tileGrid[currentRow].forEach((tile, index) => {
        setTimeout(() => {
          tile.classList.add("win");
        }, index * 100);
      });

      return;
    }

    currentRow++;
    currentCol = 0;

    if (currentRow === MAX_GUESSES) {
      isGameOver = true;
      showMessage(`The word was: ${solution.toUpperCase()}`, 3000);
    }
  }, WORD_LENGTH * 220 + 50);
}

// --- WORDLE-STYLE EVALUATION ---
function evaluateGuess(guess, solutionWord) {
  const result = new Array(WORD_LENGTH).fill("absent");
  const guessChars = guess.split("");
  const solutionChars = solutionWord.split("");

  if (guessChars.length !== solutionChars.length) {
    console.error("Guess/solution length mismatch", guess, solutionWord);
    return result;
  }

  // 1) Count letters in solution
  const counts = {};
  for (let i = 0; i < WORD_LENGTH; i++) {
    const ch = solutionChars[i];
    counts[ch] = (counts[ch] || 0) + 1;
  }

  // 2) First pass: exact matches (green)
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessChars[i] === solutionChars[i]) {
      result[i] = "correct";
      counts[guessChars[i]] -= 1;
    }
  }

  // 3) Second pass: present but wrong spot (yellow)
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "correct") continue;

    const ch = guessChars[i];
    if (counts[ch] > 0) {
      result[i] = "present";
      counts[ch] -= 1;
    }
  }

  return result;
}

// --- KEYBOARD COLORING ---
function updateKeyState(letter, newState) {
  const btn = keyButtons[letter];
  if (!btn) return;

  const currentState = btn.dataset.state;
  if (!currentState) {
    btn.dataset.state = newState;
    return;
  }

  // Never downgrade: correct > present > absent
  const priority = { correct: 3, present: 2, absent: 1 };
  if (priority[newState] > priority[currentState]) {
    btn.dataset.state = newState;
  }
}

// --- STARTUP ---
loadWords();