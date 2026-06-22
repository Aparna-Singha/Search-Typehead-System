const searchInput = document.getElementById("searchInput");
const submitButton = document.getElementById("submitButton");
const clearButton = document.getElementById("clearButton");
const refreshTrendingButton = document.getElementById("refreshTrendingButton");
const suggestionList = document.getElementById("suggestionList");
const trendingList = document.getElementById("trendingList");
const statusMessage = document.getElementById("statusMessage");
const sourceBadge = document.getElementById("sourceBadge");

let debounceTimer = null;
let latestSuggestRequest = 0;
let currentSuggestions = [];
let activeSuggestionIndex = -1;

const setStatus = (message, tone = "idle") => {
  statusMessage.textContent = message;
  statusMessage.classList.remove("is-error", "is-loading");

  if (tone === "error") {
    statusMessage.classList.add("is-error");
  }

  if (tone === "loading") {
    statusMessage.classList.add("is-loading");
  }
};

const setSource = (sourceText) => {
  const normalizedSource = sourceText === "cache" ? "cache" : sourceText === "index" ? "prefix-index" : sourceText;
  sourceBadge.textContent = normalizedSource;
  sourceBadge.classList.remove("is-cache", "is-index");

  if (sourceText === "cache") {
    sourceBadge.classList.add("is-cache");
  } else if (sourceText === "index") {
    sourceBadge.classList.add("is-index");
  }
};

const updateClearButton = () => {
  clearButton.disabled = searchInput.value.trim().length === 0;
};

const renderSuggestionState = (message, tone = "idle") => {
  suggestionList.replaceChildren();

  const item = document.createElement("li");
  item.className = "suggestion-item is-state";

  if (tone === "loading") {
    item.classList.add("is-loading");
  }

  if (tone === "error") {
    item.classList.add("is-error");
  }

  item.textContent = message;
  suggestionList.appendChild(item);
};

const renderSuggestions = (suggestions) => {
  suggestionList.replaceChildren();
  currentSuggestions = suggestions;
  activeSuggestionIndex = suggestions.length > 0 ? Math.min(activeSuggestionIndex, suggestions.length - 1) : -1;

  if (suggestions.length === 0) {
    renderSuggestionState("No suggestions available for this prefix yet.");
    return;
  }

  suggestions.forEach((suggestion, index) => {
    const item = document.createElement("li");
    item.className = "suggestion-item";
    item.style.animationDelay = `${index * 35}ms`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-button";

    if (index === activeSuggestionIndex) {
      button.classList.add("is-active");
    }

    const queryLabel = document.createElement("strong");
    queryLabel.textContent = suggestion.query;

    const countLabel = document.createElement("span");
    countLabel.className = "suggestion-count";
    countLabel.textContent = suggestion.count.toLocaleString();

    button.append(queryLabel, countLabel);

    button.addEventListener("click", () => {
      searchInput.value = suggestion.query;
      updateClearButton();
      void submitSearch(suggestion.query);
    });

    item.appendChild(button);
    suggestionList.appendChild(item);
  });
};

const renderTrending = (items) => {
  trendingList.replaceChildren();

  if (items.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Trending results will appear after search activity is recorded.";
    trendingList.appendChild(item);
    return;
  }

  items.forEach((entry) => {
    const item = document.createElement("li");

    const queryLabel = document.createElement("span");
    queryLabel.textContent = entry.query;

    const scoreLabel = document.createElement("span");
    scoreLabel.className = "trend-score";
    scoreLabel.textContent = String(entry.score);

    item.append(queryLabel, scoreLabel);
    trendingList.appendChild(item);
  });
};

const loadTrending = async () => {
  try {
    const response = await fetch("/api/trending?limit=10");

    if (!response.ok) {
      throw new Error("Unable to load trending searches.");
    }

    const payload = await response.json();
    renderTrending(payload.trending || []);
  } catch (error) {
    renderTrending([]);
    setStatus(error.message, "error");
  }
};

const fetchSuggestions = async (prefix) => {
  latestSuggestRequest += 1;
  const requestId = latestSuggestRequest;
  currentSuggestions = [];
  activeSuggestionIndex = -1;

  try {
    setStatus("Loading suggestions...", "loading");
    renderSuggestionState("Loading suggestions...", "loading");

    const response = await fetch(`/api/suggest?q=${encodeURIComponent(prefix)}&limit=10`);

    if (!response.ok) {
      throw new Error("Suggestion lookup failed.");
    }

    const payload = await response.json();

    if (requestId !== latestSuggestRequest) {
      return;
    }

    renderSuggestions(payload.suggestions || []);
    setSource(payload.source || "unknown");

    if (prefix.trim()) {
      setStatus(`Showing matches for "${payload.prefix}"`);
    } else {
      setStatus("Showing popular searches because the input is empty.");
    }
  } catch (error) {
    if (requestId !== latestSuggestRequest) {
      return;
    }

    currentSuggestions = [];
    activeSuggestionIndex = -1;
    renderSuggestionState(error.message, "error");
    setSource("unavailable");
    setStatus(error.message, "error");
  }
};

const submitSearch = async (query) => {
  const normalized = query.trim();

  if (!normalized) {
    setStatus("Enter a search query before submitting.", "error");
    return;
  }

  try {
    setStatus("Submitting search...", "loading");

    const response = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: normalized })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Search submission failed." }));
      throw new Error(payload.error || "Search submission failed.");
    }

    const payload = await response.json();
    setStatus(`${payload.message}: "${payload.query}"`);
    await Promise.all([loadTrending(), fetchSuggestions(searchInput.value)]);
  } catch (error) {
    setStatus(error.message, "error");
  }
};

searchInput.addEventListener("input", (event) => {
  const prefix = event.target.value;
  updateClearButton();

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    void fetchSuggestions(prefix);
  }, 275);
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" && currentSuggestions.length > 0) {
    event.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex + 1) % currentSuggestions.length;
    renderSuggestions(currentSuggestions);
    return;
  }

  if (event.key === "ArrowUp" && currentSuggestions.length > 0) {
    event.preventDefault();
    activeSuggestionIndex =
      activeSuggestionIndex <= 0 ? currentSuggestions.length - 1 : activeSuggestionIndex - 1;
    renderSuggestions(currentSuggestions);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();

    if (activeSuggestionIndex >= 0 && currentSuggestions[activeSuggestionIndex]) {
      const selectedSuggestion = currentSuggestions[activeSuggestionIndex];
      searchInput.value = selectedSuggestion.query;
      updateClearButton();
      void submitSearch(selectedSuggestion.query);
      return;
    }

    void submitSearch(searchInput.value);
  }
});

submitButton.addEventListener("click", () => {
  void submitSearch(searchInput.value);
});

clearButton.addEventListener("click", () => {
  searchInput.value = "";
  currentSuggestions = [];
  activeSuggestionIndex = -1;
  updateClearButton();
  searchInput.focus();
  void fetchSuggestions("");
});

refreshTrendingButton.addEventListener("click", () => {
  void loadTrending();
});

updateClearButton();
void Promise.all([fetchSuggestions(""), loadTrending()]);
