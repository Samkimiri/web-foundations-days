// Starting data
let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

// 1. Search notes by word
function searchNotes(word) {
  const searchWord = word.toLowerCase();

  return notes.filter((note) =>
    note.text.toLowerCase().includes(searchWord)
  );
}

// Test searchNotes
console.log(searchNotes("day"));
// Expected: [{ id: 2, text: "Finish the Day 3 assignment", category: "study" }]

console.log(searchNotes("pizza"));
// Expected: []

// 2. Find the longest note
function longestNote() {
  if (notes.length === 0) {
    return null;
  }

  let longest = notes[0];

  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }

  return longest;
}

// Test longestNote
console.log(longestNote());
// Expected: note with text "Email the project report to Grace"

const savedNotesForLongestTest = notes;
notes = [];
console.log(longestNote());
// Expected: null
notes = savedNotesForLongestTest;

// 3. Count notes by category
function countByCategory() {
  const counts = {};

  for (const note of notes) {
    if (!counts[note.category]) {
      counts[note.category] = 0;
    }

    counts[note.category]++;
  }

  return counts;
}

// Test countByCategory
console.log(countByCategory());
// Expected: { personal: 2, study: 2, work: 1 }

const savedNotesForCountTest = notes;
notes = [];
console.log(countByCategory());
// Expected: {}
notes = savedNotesForCountTest;

// 4. Get a summary
function getSummary() {
  const counts = countByCategory();
  const total = notes.length;
  const noteWord = total === 1 ? "note" : "notes";

  return `${total} ${noteWord}: ${counts.personal || 0} personal, ${counts.work || 0} work, ${counts.study || 0} study.`;
}

// Test getSummary
console.log(getSummary());
// Expected: "5 notes: 2 personal, 1 work, 2 study."

const savedNotesForSummaryTest = notes;
notes = [];
console.log(getSummary());
// Expected: "0 notes: 0 personal, 0 work, 0 study."
notes = savedNotesForSummaryTest;

// 5. Check for duplicate notes
function isDuplicate(text) {
  const cleanedText = text.trim().toLowerCase();

  return notes.some(
    (note) => note.text.trim().toLowerCase() === cleanedText
  );
}

// Test isDuplicate
console.log(isDuplicate("  BUY MILK AND BREAD  "));
// Expected: true

console.log(isDuplicate("Buy eggs"));
// Expected: false

// 6. Add a new note
function addNote(text, category) {
  const cleanedText = text.trim();
  const validCategories = ["personal", "work", "study"];

  if (cleanedText.length < 1 || cleanedText.length > 200) {
    console.log("❌ Note rejected: text must be 1-200 characters.");
    return false;
  }

  if (isDuplicate(cleanedText)) {
    console.log("❌ Note rejected: duplicate note.");
    return false;
  }

  if (!validCategories.includes(category)) {
    console.log("❌ Note rejected: invalid category.");
    return false;
  }

  const newNote = {
    id: Date.now(),
    text: cleanedText,
    category: category,
  };

  notes.push(newNote);

  console.log(`✅ Note added: "${newNote.text}"`);
  return true;
}

// Test addNote - normal case
console.log(addNote("Prepare for tomorrow's lesson", "study"));
// Expected: true

// Test addNote - duplicate
console.log(addNote("  Buy milk and bread  ", "personal"));
// Expected: false

// Test addNote - invalid category
console.log(addNote("Plan weekend activities", "shopping"));
// Expected: false

// Test addNote - empty text
console.log(addNote("   ", "personal"));
// Expected: false