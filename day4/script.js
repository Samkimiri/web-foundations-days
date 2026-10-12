// ---------- 1. Select the elements ----------
const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");

// ---------- 2. Storage keys ----------
const DRAFT_KEY = "notes-toolkit-draft";
const THEME_KEY = "notes-toolkit-theme";

// ---------- 3. Update character and word counts ----------
function updateCounts() {
  const text = noteText.value;
  const characters = text.length;

  const words = text.trim() === ""
    ? 0
    : text.trim().split(/\s+/).length;

  charCount.textContent = `${characters} / 200 characters`;
  wordCount.textContent = `${words} words`;

  charCount.classList.remove("warning", "over");

  if (characters > 200) {
    charCount.classList.add("over");
  } else if (characters > 180) {
    charCount.classList.add("warning");
  }
}

// ---------- 4. Save draft whenever the user types ----------
noteText.addEventListener("input", () => {
  updateCounts();
  localStorage.setItem(DRAFT_KEY, noteText.value);
});

// ---------- 5. Clear button ----------
function clearEverything() {
  noteText.value = "";
  updateCounts();
  localStorage.removeItem(DRAFT_KEY);
  noteText.focus();
}

clearBtn.addEventListener("click", clearEverything);

// ---------- 6. Escape key clears everything ----------
noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearEverything();
  }
});

// ---------- 7. Theme handling ----------
function updateThemeButton() {
  if (document.body.classList.contains("dark")) {
    themeToggle.textContent = "Light mode";
  } else {
    themeToggle.textContent = "Dark mode";
  }
}

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  const isDark = document.body.classList.contains("dark");

  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");

  updateThemeButton();
});

// ---------- 8. Restore saved draft ----------
const savedDraft = localStorage.getItem(DRAFT_KEY);

if (savedDraft) {
  noteText.value = savedDraft;
}

// ---------- 9. Restore saved theme ----------
const savedTheme = localStorage.getItem(THEME_KEY);

if (savedTheme === "dark") {
  document.body.classList.add("dark");
}

// ---------- 10. Initial setup ----------
updateCounts();
updateThemeButton();