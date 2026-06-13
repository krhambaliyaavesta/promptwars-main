// MindCompanion frontend logic.
// Talks to POST /api/analyze-journal and renders a WellnessAnalysisResponse.
// All model/user content is inserted as text (never innerHTML) to prevent XSS.

document.addEventListener("DOMContentLoaded", () => {
  // Single source of truth for crisis helplines, shared by the footer and the banner.
  const HELPLINES = [
    { name: "Sneha India", contact: "+91-44-24640050" },
    { name: "Vandrevala Foundation (24x7)", contact: "+91-9999666555" },
    { name: "Emergency services (India)", contact: "112" },
  ];

  const form = document.getElementById("journal-form");
  const submitBtn = document.getElementById("submit-btn");
  const journalText = document.getElementById("journal-text");
  const charCount = document.getElementById("char-count");
  const formError = document.getElementById("form-error");

  const emptyState = document.getElementById("empty-state");
  const loadingState = document.getElementById("loading-state");
  const results = document.getElementById("results");

  const crisisBanner = document.getElementById("crisis-banner");
  const crisisMessage = document.getElementById("crisis-message");
  const crisisHelplines = document.getElementById("crisis-helplines");
  const empatheticMessage = document.getElementById("empathetic-message");
  const emotions = document.getElementById("emotions");
  const triggers = document.getElementById("triggers");
  const copingTitle = document.getElementById("coping-title");
  const copingSteps = document.getElementById("coping-steps");
  const mindfulness = document.getElementById("mindfulness");

  // Render the standing helpline list in the footer on load.
  const footerHelplines = document.getElementById("footer-helplines");
  HELPLINES.forEach((line) =>
    footerHelplines.appendChild(buildHelplineItem(line)),
  );

  // Live character counter for the journal textarea, with a warning near the limit.
  const MAX_JOURNAL_CHARS = 2000;
  const updateCount = () => {
    const len = journalText.value.length;
    charCount.textContent = `${len} / ${MAX_JOURNAL_CHARS}`;
    charCount.classList.toggle("char-warn", len >= MAX_JOURNAL_CHARS - 100);
  };
  journalText.addEventListener("input", updateCount);
  updateCount();

  // "Start a new entry" — reset the form and return to the empty state.
  const resetBtn = document.getElementById("reset-btn");
  resetBtn.addEventListener("click", () => {
    form.reset();
    updateCount();
    hideError();
    crisisBanner.hidden = true;
    results.classList.add("hidden");
    results.classList.remove("flex");
    emptyState.classList.remove("hidden");
    journalText.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError();

    const targetExam = document.getElementById("target-exam").value.trim();
    const text = journalText.value.trim();
    const moodInput = form.querySelector('input[name="mood"]:checked');
    const moodScore = moodInput ? parseInt(moodInput.value, 10) : NaN;

    // Client-side validation mirrors the backend contract.
    if (!text) {
      return showError(
        "Please write a little about what's on your mind first.",
      );
    }
    if (!targetExam) {
      return showError("Let us know what you're preparing for.");
    }
    if (!Number.isInteger(moodScore) || moodScore < 1 || moodScore > 10) {
      return showError("Please pick how you're feeling.");
    }

    setLoading(true);

    try {
      const response = await fetch("/api/analyze-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalText: text, moodScore, targetExam }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data && data.message ? data.message : "Something went wrong.",
        );
      }

      renderResults(data);
    } catch (error) {
      showError(
        error.message || "We couldn't reach the companion. Please try again.",
      );
      emptyState.classList.remove("hidden");
    } finally {
      setLoading(false);
    }
  });

  function renderResults(data) {
    renderCrisis(data);
    empatheticMessage.textContent = data.empatheticMessage || "";
    renderChips(emotions, data.detectedEmotions, "secondary");
    renderChips(triggers, data.hiddenTriggers, "tertiary");
    copingTitle.textContent =
      (data.copingStrategy && data.copingStrategy.title) || "";
    renderSteps(
      copingSteps,
      (data.copingStrategy && data.copingStrategy.actionableSteps) || [],
    );
    mindfulness.textContent = data.mindfulnessExercise || "";

    emptyState.classList.add("hidden");
    results.classList.remove("hidden");
    results.classList.add("flex");

    // Subtle entrance + move focus for orientation / screen-reader users.
    results.classList.remove("reveal");
    void results.offsetWidth; // restart the animation on each render
    results.classList.add("reveal");
    const focusTarget = data.crisisAlert
      ? document.getElementById("crisis-banner")
      : document.getElementById("insights-heading");
    if (focusTarget) focusTarget.focus();
  }

  function renderCrisis(data) {
    if (data.crisisAlert) {
      crisisMessage.textContent = data.empatheticMessage || "";
      crisisHelplines.replaceChildren();
      HELPLINES.forEach((line) =>
        crisisHelplines.appendChild(buildHelplineItem(line)),
      );
      crisisBanner.hidden = false;
      crisisBanner.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      crisisBanner.hidden = true;
    }
  }

  // --- Safe rendering helpers (build DOM nodes, use textContent) ---

  function renderChips(container, items, tone) {
    container.replaceChildren();
    const list = Array.isArray(items) ? items : [];
    if (list.length === 0) {
      const none = document.createElement("span");
      none.className = "font-label text-sm text-outline";
      none.textContent = "—";
      container.appendChild(none);
      return;
    }
    const toneClass =
      tone === "tertiary"
        ? "bg-tertiary-fixed/50 text-on-tertiary-fixed"
        : "bg-secondary-container/60 text-on-secondary-container";
    list.forEach((item) => {
      const chip = document.createElement("span");
      chip.className = `rounded-full px-3 py-1 font-label text-sm ${toneClass}`;
      chip.textContent = String(item);
      container.appendChild(chip);
    });
  }

  function renderSteps(container, steps) {
    container.replaceChildren();
    (Array.isArray(steps) ? steps : []).forEach((step) => {
      const li = document.createElement("li");
      li.textContent = String(step);
      container.appendChild(li);
    });
  }

  function buildHelplineItem({ name, contact }) {
    const li = document.createElement("li");
    li.className = "flex flex-col";
    const label = document.createElement("span");
    label.textContent = name;
    const value = document.createElement("span");
    value.className = "font-semibold text-on-surface";
    value.textContent = contact;
    li.append(label, value);
    return li;
  }

  // --- UI state helpers ---

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    if (isLoading) {
      loadingState.classList.remove("hidden");
      results.classList.add("hidden");
      results.classList.remove("flex");
      emptyState.classList.add("hidden");
    } else {
      loadingState.classList.add("hidden");
    }
  }

  function showError(message) {
    formError.textContent = message;
    formError.classList.remove("hidden");
  }

  function hideError() {
    formError.classList.add("hidden");
    formError.textContent = "";
  }
});
