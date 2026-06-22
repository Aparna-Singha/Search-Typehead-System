const searchInput = document.getElementById("searchInput");
const submitButton = document.getElementById("submitButton");
const clearButton = document.getElementById("clearButton");
const refreshTrendingButton = document.getElementById("refreshTrendingButton");
const routeKeyButton = document.getElementById("routeKeyButton");
const routingKeyInput = document.getElementById("routingKeyInput");
const suggestionList = document.getElementById("suggestionList");
const trendingList = document.getElementById("trendingList");
const statusMessage = document.getElementById("statusMessage");
const sourceBadge = document.getElementById("sourceBadge");

const metricFields = {
  lastPrefix: document.getElementById("lastPrefixValue"),
  lastSource: document.getElementById("lastSourceValue"),
  cacheStatus: document.getElementById("cacheStatusValue"),
  suggestRequests: document.getElementById("suggestRequestsValue"),
  cacheHits: document.getElementById("cacheHitsValue"),
  cacheMisses: document.getElementById("cacheMissesValue"),
  cacheHitRate: document.getElementById("cacheHitRateValue"),
  searchRequests: document.getElementById("searchRequestsValue"),
  batchFlushes: document.getElementById("batchFlushesValue"),
  queuedWrites: document.getElementById("queuedWritesValue"),
  totalSearchEvents: document.getElementById("totalSearchEventsValue"),
  distinctRowsWritten: document.getElementById("distinctRowsWrittenValue"),
  writeReductionEstimate: document.getElementById("writeReductionEstimateValue"),
  routingKey: document.getElementById("routingKeyValue"),
  routingNode: document.getElementById("routingNodeValue"),
  routingReplicas: document.getElementById("routingReplicasValue"),
  routingStrategy: document.getElementById("routingStrategyValue"),
  routingNote: document.getElementById("routingNoteValue")
};

const state = {
  debounceTimer: null,
  latestSuggestRequest: 0,
  currentSuggestions: [],
  activeSuggestionIndex: -1,
  lastPrefix: "popular",
  lastSource: "waiting",
  lastCacheStatus: "pending"
};

const setText = (element, value) => {
  element.textContent = value;
};

const setStatus = (message, tone = "idle") => {
  setText(statusMessage, message);
  statusMessage.classList.remove("is-error", "is-loading");

  if (tone === "error") {
    statusMessage.classList.add("is-error");
  }

  if (tone === "loading") {
    statusMessage.classList.add("is-loading");
  }
};

const setSource = (sourceText) => {
  const normalizedSource =
    sourceText === "cache" ? "Cache" : sourceText === "index" ? "Prefix Index" : sourceText;

  setText(sourceBadge, normalizedSource);
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

const updateRequestInsightFields = () => {
  setText(metricFields.lastPrefix, state.lastPrefix);
  setText(metricFields.lastSource, state.lastSource);
  setText(metricFields.cacheStatus, state.lastCacheStatus);
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
  state.currentSuggestions = suggestions;
  state.activeSuggestionIndex =
    suggestions.length > 0
      ? Math.min(state.activeSuggestionIndex, suggestions.length - 1)
      : -1;

  if (suggestions.length === 0) {
    renderSuggestionState("No suggestions available for this prefix yet.");
    return;
  }

  suggestions.forEach((suggestion, index) => {
    const item = document.createElement("li");
    item.className = "suggestion-item";
    item.style.animationDelay = `${index * 40}ms`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-button";

    if (index === state.activeSuggestionIndex) {
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
    item.className = "trend-empty";
    item.textContent = "No trending data is available yet. Submit a few searches to populate it.";
    trendingList.appendChild(item);
    return;
  }

  items.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "trend-item";

    const queryLabel = document.createElement("span");
    queryLabel.className = "trend-query";
    queryLabel.textContent = entry.query;

    const scoreLabel = document.createElement("span");
    scoreLabel.className = "trend-score";
    scoreLabel.textContent = String(entry.score);

    item.append(queryLabel, scoreLabel);
    trendingList.appendChild(item);
  });
};

const loadMetrics = async () => {
  try {
    const response = await fetch("/api/metrics");

    if (!response.ok) {
      throw new Error("Unable to load metrics.");
    }

    const metrics = await response.json();
    setText(metricFields.suggestRequests, String(metrics.suggestRequests));
    setText(metricFields.cacheHits, String(metrics.cacheHits));
    setText(metricFields.cacheMisses, String(metrics.cacheMisses));
    setText(metricFields.cacheHitRate, `${(metrics.cacheHitRate * 100).toFixed(1)}%`);
    setText(metricFields.searchRequests, String(metrics.searchRequests));
    setText(metricFields.batchFlushes, String(metrics.batchFlushes));
    setText(metricFields.queuedWrites, String(metrics.queuedWrites));
    setText(metricFields.totalSearchEvents, String(metrics.totalSearchEvents));
    setText(metricFields.distinctRowsWritten, String(metrics.distinctRowsWritten));
    setText(metricFields.writeReductionEstimate, metrics.writeReductionEstimate);
    updateRequestInsightFields();
  } catch (error) {
    setText(metricFields.writeReductionEstimate, error.message);
  }
};

const loadTrending = async () => {
  try {
    const response = await fetch("/api/trending?limit=5");

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

const loadCacheRouting = async () => {
  const cacheKey = routingKeyInput.value.trim() || "suggest:iph:10";

  try {
    const response = await fetch(`/api/cache-routing?key=${encodeURIComponent(cacheKey)}`);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({
        error: "Unable to load cache routing details."
      }));
      throw new Error(payload.error || "Unable to load cache routing details.");
    }

    const payload = await response.json();
    setText(metricFields.routingKey, payload.key);
    setText(metricFields.routingNode, payload.selectedNode || "unassigned");
    setText(metricFields.routingReplicas, String(payload.replicas));
    setText(metricFields.routingStrategy, payload.strategy);
    setText(metricFields.routingNote, payload.note);
  } catch (error) {
    setText(metricFields.routingNode, "error");
    setText(metricFields.routingNote, error.message);
  }
};

const fetchSuggestions = async (prefix) => {
  state.latestSuggestRequest += 1;
  const requestId = state.latestSuggestRequest;
  state.currentSuggestions = [];
  state.activeSuggestionIndex = -1;

  try {
    setStatus("Looking up ranked suggestions...", "loading");
    renderSuggestionState("Looking up ranked suggestions...", "loading");

    const response = await fetch(`/api/suggest?q=${encodeURIComponent(prefix)}&limit=5`);

    if (!response.ok) {
      throw new Error("Suggestion lookup failed.");
    }

    const payload = await response.json();

    if (requestId !== state.latestSuggestRequest) {
      return;
    }

    renderSuggestions(payload.suggestions || []);
    setSource(payload.source || "unknown");

    state.lastPrefix = payload.prefix ? payload.prefix : "popular";
    state.lastSource = payload.source === "cache" ? "cache" : "prefix-index";
    state.lastCacheStatus = payload.source === "cache" ? "hit" : "miss";
    updateRequestInsightFields();

    if (prefix.trim()) {
      setStatus(`Showing matches for ${payload.prefix}`);
    } else {
      setStatus("Showing popular searches because the input is empty");
    }

    await loadMetrics();
  } catch (error) {
    if (requestId !== state.latestSuggestRequest) {
      return;
    }

    state.currentSuggestions = [];
    state.activeSuggestionIndex = -1;
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
    setStatus("Submitting search update...", "loading");

    const response = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: normalized })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({
        error: "Search submission failed."
      }));
      throw new Error(payload.error || "Search submission failed.");
    }

    const payload = await response.json();
    setStatus(`${payload.message}: ${payload.query}`);
    await Promise.all([loadTrending(), loadMetrics(), fetchSuggestions(searchInput.value)]);
  } catch (error) {
    setStatus(error.message, "error");
  }
};

searchInput.addEventListener("input", (event) => {
  const prefix = event.target.value;
  updateClearButton();

  if (state.debounceTimer) {
    clearTimeout(state.debounceTimer);
  }

  state.debounceTimer = setTimeout(() => {
    void fetchSuggestions(prefix);
  }, 275);
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" && state.currentSuggestions.length > 0) {
    event.preventDefault();
    state.activeSuggestionIndex =
      (state.activeSuggestionIndex + 1) % state.currentSuggestions.length;
    renderSuggestions(state.currentSuggestions);
    return;
  }

  if (event.key === "ArrowUp" && state.currentSuggestions.length > 0) {
    event.preventDefault();
    state.activeSuggestionIndex =
      state.activeSuggestionIndex <= 0
        ? state.currentSuggestions.length - 1
        : state.activeSuggestionIndex - 1;
    renderSuggestions(state.currentSuggestions);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();

    if (state.activeSuggestionIndex >= 0 && state.currentSuggestions[state.activeSuggestionIndex]) {
      const selectedSuggestion = state.currentSuggestions[state.activeSuggestionIndex];
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
  state.currentSuggestions = [];
  state.activeSuggestionIndex = -1;
  updateClearButton();
  searchInput.focus();
  void fetchSuggestions("");
});

refreshTrendingButton.addEventListener("click", () => {
  void loadTrending();
});

routeKeyButton.addEventListener("click", () => {
  void loadCacheRouting();
});

updateRequestInsightFields();
updateClearButton();
void Promise.all([fetchSuggestions(""), loadTrending(), loadMetrics(), loadCacheRouting()]);
