// ============================================================
// script.js — YouTube Summarizer Frontend Logic
// Handles: form submission, API calls, UI updates,
//          copy to clipboard, download as TXT, toast notifications
// ============================================================

// ── DOM ELEMENT REFERENCES ───────────────────────────────
const urlInput       = document.getElementById("youtubeUrl");
const summarizeBtn   = document.getElementById("summarizeBtn");
const clearBtn       = document.getElementById("clearBtn");
const loadingSection = document.getElementById("loadingSection");
const resultsSection = document.getElementById("resultsSection");
const loaderStep     = document.getElementById("loaderStep");
const loaderBar      = document.getElementById("loaderBar");
const toast          = document.getElementById("toast");

// Result elements
const videoThumbnail    = document.getElementById("videoThumbnail");
const videoTitle        = document.getElementById("videoTitle");
const videoMeta         = document.getElementById("videoMeta");
const shortSummaryText  = document.getElementById("shortSummaryText");
const detailedSummaryText = document.getElementById("detailedSummaryText");
const bulletPointsList  = document.getElementById("bulletPointsList");
const actionableList    = document.getElementById("actionableList");

// Action buttons
const downloadBtn = document.getElementById("downloadBtn");
const copyAllBtn  = document.getElementById("copyAllBtn");
const resetBtn    = document.getElementById("resetBtn");

// ── LOADING STEPS (shown sequentially during fetch) ──────
const LOADING_STEPS = [
  { text: "Validating YouTube URL…",    progress: 15 },
  { text: "Fetching video transcript…", progress: 40 },
  { text: "Processing with Gemini AI…", progress: 70 },
  { text: "Formatting summary…",        progress: 90 },
];

let loadingInterval = null;   // Reference to setInterval for cleanup
let stepIndex = 0;            // Tracks which loading step we're on
let summaryData = null;       // Stores last successful API response


// ── TOAST NOTIFICATION ───────────────────────────────────
/**
 * Shows a brief notification at the bottom of the screen.
 * @param {string} message - Text to display
 * @param {"success"|"error"|"info"} type - Controls styling
 * @param {number} duration - Milliseconds before auto-hide (default 3000)
 */
function showToast(message, type = "info", duration = 3000) {
  toast.textContent = message;
  toast.className = `toast toast--${type} show`;

  // Auto-hide after duration
  setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}


// ── LOADING PROGRESS ANIMATION ───────────────────────────
/**
 * Starts cycling through loading steps with a progress bar.
 * Call stopLoading() when done.
 */
function startLoading() {
  stepIndex = 0;
  loaderBar.style.width = "0%";
  updateLoadingStep();

  // Advance steps every 2 seconds
  loadingInterval = setInterval(() => {
    stepIndex++;
    if (stepIndex < LOADING_STEPS.length) {
      updateLoadingStep();
    }
    // Stop at last step — don't loop
    if (stepIndex >= LOADING_STEPS.length - 1) {
      clearInterval(loadingInterval);
    }
  }, 2000);
}

function updateLoadingStep() {
  const step = LOADING_STEPS[stepIndex];
  if (step) {
    loaderStep.textContent = step.text;
    loaderBar.style.width = step.progress + "%";
  }
}

function stopLoading() {
  clearInterval(loadingInterval);
  // Briefly show 100% before hiding
  loaderBar.style.width = "100%";
}


// ── UI STATE MANAGEMENT ──────────────────────────────────
function showSection(section) {
  // Hide all sections first
  document.querySelector(".input-section").classList.remove("hidden");
  loadingSection.classList.add("hidden");
  resultsSection.classList.add("hidden");

  if (section === "loading") {
    loadingSection.classList.remove("hidden");
  } else if (section === "results") {
    resultsSection.classList.remove("hidden");
  }
}

function setButtonLoading(isLoading) {
  summarizeBtn.disabled = isLoading;
  const btnText = summarizeBtn.querySelector(".btn-text");
  const btnIcon = summarizeBtn.querySelector(".btn-icon");

  if (isLoading) {
    btnText.textContent = "Analyzing…";
    btnIcon.textContent = "⟳";
  } else {
    btnText.textContent = "Generate Summary";
    btnIcon.textContent = "→";
  }
}


// ── MAIN: SUBMIT YOUTUBE URL ─────────────────────────────
/**
 * Core function: takes the URL input, calls /summarize,
 * and renders the results. Handles all errors.
 */
async function handleSummarize() {
  const url = urlInput.value.trim();

  // Basic client-side validation before sending to server
  if (!url) {
    showToast("Please enter a YouTube URL", "error");
    urlInput.focus();
    return;
  }

  if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
    showToast("That doesn't look like a YouTube URL", "error");
    urlInput.focus();
    return;
  }

  // Update UI: show loading state
  setButtonLoading(true);
  showSection("loading");
  startLoading();

  try {
    // Call the Flask backend
    const response = await fetch("/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    stopLoading();

    // Handle API errors returned with non-200 status
    if (!response.ok || data.error) {
      throw new Error(data.error || "Something went wrong. Please try again.");
    }

    // Store data globally for download/copy-all
    summaryData = data;

    // Render the results
    renderResults(data);
    showSection("results");
    showToast("Summary generated!", "success");

  } catch (error) {
    stopLoading();
    showSection("input");
    showToast(error.message || "Request failed", "error", 5000);
    console.error("Summarize error:", error);
  } finally {
    setButtonLoading(false);
  }
}


// ── RENDER RESULTS ───────────────────────────────────────
/**
 * Populates all result elements with data from the API response.
 * @param {Object} data - Response from /summarize endpoint
 */
function renderResults(data) {
  // Video thumbnail and title
  videoThumbnail.src = data.thumbnail || "";
  videoThumbnail.alt = data.title || "Video thumbnail";
  videoTitle.textContent = data.title || "YouTube Video";
  videoMeta.textContent = `Video ID: ${data.video_id} · Transcript: ~${(data.transcript_length || 0).toLocaleString()} words`;

  // ── Language badge (shown when transcript is non-English) ──
  const langBadge = document.getElementById("langBadge");
  if (data.was_translated && data.transcript_language) {
    langBadge.textContent = `🌐 Transcript in ${data.transcript_language} — summarized in English`;
    langBadge.classList.remove("hidden");
  } else {
    langBadge.classList.add("hidden");
  }

  // ── Translation notice above summary cards ─────────────────
  const existingNotice = document.getElementById("translationNotice");
  if (existingNotice) existingNotice.remove();
  if (data.was_translated && data.transcript_language) {
    const notice = document.createElement("div");
    notice.id = "translationNotice";
    notice.className = "translation-notice";
    notice.innerHTML = `🌐 Original transcript language: <strong>${data.transcript_language}</strong>. Summary generated in English by AI.`;
    const grid = document.querySelector(".summary-grid");
    grid.parentNode.insertBefore(notice, grid);
  }

  // ── Short summary ──────────────────────────────────────────
  shortSummaryText.textContent = data.short_summary || "No short summary available.";

  // ── Detailed summary — convert newlines to <p> tags ────────
  const detailedHtml = (data.detailed_summary || "No detailed summary available.")
    .split(/\n{2,}/)
    .filter(p => p.trim())
    .map(p => `<p>${escapeHtml(p.trim())}</p>`)
    .join("");
  detailedSummaryText.innerHTML = detailedHtml || `<p>${escapeHtml(data.detailed_summary)}</p>`;

  // ── Bullet points ──────────────────────────────────────────
  bulletPointsList.innerHTML = "";
  const bullets = data.bullet_points || [];
  if (bullets.length > 0) {
    bullets.forEach(point => {
      const li = document.createElement("li");
      li.textContent = point;
      bulletPointsList.appendChild(li);
    });
  } else {
    bulletPointsList.innerHTML = "<li>No key points available.</li>";
  }

  // ── Actionable insights ────────────────────────────────────
  actionableList.innerHTML = "";
  const insights = data.actionable_insights || [];
  if (insights.length > 0) {
    insights.forEach(insight => {
      const li = document.createElement("li");
      li.textContent = insight;
      actionableList.appendChild(li);
    });
  } else {
    actionableList.innerHTML = "<li>No actionable insights available.</li>";
  }

  // ── Original transcript section (non-English only) ─────────
  const originalCard = document.getElementById("originalTranscriptCard");
  const originalText = document.getElementById("originalTranscriptText");
  const originalLangBadge = document.getElementById("originalLangBadge");

  if (data.original_transcript && data.original_transcript.trim()) {
    originalText.textContent = data.original_transcript;
    originalLangBadge.textContent = `(${data.transcript_language || ""})`;
    originalCard.classList.remove("hidden");
  } else {
    originalCard.classList.add("hidden");
  }
}

/**
 * Escapes HTML special characters to prevent XSS.
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}


// ── COPY TO CLIPBOARD ────────────────────────────────────
/**
 * Copies text content from a target element to clipboard.
 * Shows a brief "Copied!" state on the button.
 * @param {HTMLElement} btn - The copy button that was clicked
 * @param {string} targetId - ID of the element to copy from
 */
async function copyElement(btn, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  // Extract text — handle both plain text and list items
  let text = "";
  if (el.tagName === "UL" || el.tagName === "OL") {
    const items = el.querySelectorAll("li");
    text = Array.from(items).map((li, i) => `${i + 1}. ${li.textContent}`).join("\n");
  } else {
    text = el.textContent || el.innerText;
  }

  try {
    await navigator.clipboard.writeText(text.trim());

    // Visual feedback: briefly show "✓"
    btn.textContent = "✓";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "⎘";
      btn.classList.remove("copied");
    }, 1800);

    showToast("Copied to clipboard!", "success", 2000);
  } catch (e) {
    showToast("Could not copy to clipboard", "error");
  }
}


// ── COPY ALL ─────────────────────────────────────────────
/**
 * Copies the entire summary (all sections) to clipboard.
 */
async function copyAll() {
  if (!summaryData) return;

  const bullets = (summaryData.bullet_points || [])
    .map((b, i) => `  ${i + 1}. ${b}`)
    .join("\n");

  const insights = (summaryData.actionable_insights || [])
    .map((a, i) => `  ${i + 1}. ${a}`)
    .join("\n");

  const fullText = [
    `VIDEO: ${summaryData.title}`,
    `URL: ${urlInput.value}`,
    "",
    "── SHORT SUMMARY ──",
    summaryData.short_summary,
    "",
    "── DETAILED SUMMARY ──",
    summaryData.detailed_summary,
    "",
    "── KEY BULLET POINTS ──",
    bullets,
    "",
    "── ACTIONABLE INSIGHTS ──",
    insights,
    "",
    `Generated by YT Summarizer · ${new Date().toLocaleDateString()}`,
  ].join("\n");

  try {
    await navigator.clipboard.writeText(fullText);
    showToast("Full summary copied!", "success");
  } catch (e) {
    showToast("Could not copy to clipboard", "error");
  }
}


// ── DOWNLOAD AS TXT ──────────────────────────────────────
/**
 * Creates and downloads a .txt file containing the full summary.
 */
function downloadSummary() {
  if (!summaryData) return;

  const bullets = (summaryData.bullet_points || [])
    .map((b, i) => `  ${i + 1}. ${b}`)
    .join("\n");

  const insights = (summaryData.actionable_insights || [])
    .map((a, i) => `  ${i + 1}. ${a}`)
    .join("\n");

  const content = [
    "╔══════════════════════════════════════════╗",
    "║      YouTube Video Summary               ║",
    "╚══════════════════════════════════════════╝",
    "",
    `VIDEO TITLE : ${summaryData.title}`,
    `VIDEO URL   : ${urlInput.value}`,
    `GENERATED   : ${new Date().toLocaleString()}`,
    `WORD COUNT  : ~${(summaryData.transcript_length || 0).toLocaleString()} words`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "  SHORT SUMMARY",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    summaryData.short_summary,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "  DETAILED SUMMARY",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    summaryData.detailed_summary,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "  KEY BULLET POINTS",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    bullets,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "  ACTIONABLE INSIGHTS",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    insights,
    "",
    "Generated by YT Summarizer (Flask + Gemini 1.5 Flash)",
  ].join("\n");

  // Create a temporary <a> element and trigger download
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);

  // Sanitize title for use as filename
  const safeTitle = (summaryData.title || "summary")
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()
    .substring(0, 50);
  a.download = `summary_${safeTitle}.txt`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);

  showToast("Summary downloaded!", "success");
}


// ── RESET / BACK ─────────────────────────────────────────
function resetApp() {
  summaryData = null;
  showSection("input");
  urlInput.value = "";
  urlInput.focus();
  // Scroll back to top
  window.scrollTo({ top: 0, behavior: "smooth" });
}


// ── EVENT LISTENERS ──────────────────────────────────────

// Main submit button
summarizeBtn.addEventListener("click", handleSummarize);

// Allow pressing Enter in the input field
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSummarize();
});

// Clear button
clearBtn.addEventListener("click", () => {
  urlInput.value = "";
  urlInput.focus();
});

// Sample URL pills — fill input on click
document.querySelectorAll(".sample-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    urlInput.value = pill.dataset.url;
    urlInput.focus();
    showToast("Sample URL loaded! Click Generate →", "info", 2500);
  });
});

// Individual copy buttons (delegated from summary grid)
document.querySelectorAll(".copy-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.target;
    if (targetId) copyElement(btn, targetId);
  });
});

// Copy All button
copyAllBtn.addEventListener("click", copyAll);

// Download button
downloadBtn.addEventListener("click", downloadSummary);

// Reset / Back button
resetBtn.addEventListener("click", resetApp);

// Paste detection — auto-submit if URL is pasted
urlInput.addEventListener("paste", (e) => {
  // Small delay to let paste complete before reading value
  setTimeout(() => {
    const pasted = urlInput.value.trim();
    if (pasted.includes("youtube.com") || pasted.includes("youtu.be")) {
      showToast("YouTube URL detected! Press Enter or click Generate →", "info", 3000);
    }
  }, 50);
});