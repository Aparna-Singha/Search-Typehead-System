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
const lookupModeChip = document.getElementById("lookupModeChip");
const cacheStatusChip = document.getElementById("cacheStatusChip");
const tabButtons = Array.from(document.querySelectorAll(".tab-button"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

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
  currentPrefix: "",
  lastPrefix: "popular",
  lastSource: "waiting",
  lastCacheStatus: "pending"
};

const getErrorMessage = (error, fallback) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const setText = (element, value) => {
  if (element) {
    element.textContent = value;
  }
};

const formatInteger = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString() : String(value);
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

const setLookupChips = (sourceText) => {
  lookupModeChip.classList.remove("is-cache", "is-index");
  cacheStatusChip.classList.remove("is-cache", "is-index", "is-warm");

  if (sourceText === "cache") {
    setText(lookupModeChip, "Cached result");
    setText(cacheStatusChip, "Cache hit");
    lookupModeChip.classList.add("is-cache");
    cacheStatusChip.classList.add("is-cache");
    return;
  }

  if (sourceText === "index") {
    setText(lookupModeChip, "Prefix Index lookup");
    setText(cacheStatusChip, "Cache miss");
    lookupModeChip.classList.add("is-index");
    cacheStatusChip.classList.add("is-warm");
    return;
  }

  setText(lookupModeChip, "Lookup pending");
  setText(cacheStatusChip, "Warm cache");
  cacheStatusChip.classList.add("is-warm");
};

const updateClearButton = () => {
  clearButton.disabled = searchInput.value.trim().length === 0;
};

const updateRequestInsightFields = () => {
  setText(metricFields.lastPrefix, state.lastPrefix);
  setText(metricFields.lastSource, state.lastSource);
  setText(metricFields.cacheStatus, state.lastCacheStatus);
};

const switchTab = async (targetId) => {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tabTarget === targetId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  tabPanels.forEach((panel) => {
    panel.hidden = panel.id !== targetId;
  });

  if (targetId === "panel-search") {
    searchInput.focus();
    return;
  }

  if (targetId === "panel-trending") {
    await loadTrending();
    return;
  }

  if (targetId === "panel-metrics") {
    await loadMetrics();
    return;
  }

  if (targetId === "panel-routing") {
    await loadCacheRouting();
  }
};

const createSuggestionLabel = (query, prefix) => {
  const label = document.createElement("span");
  label.className = "suggestion-label";

  const normalizedPrefix = prefix.trim().toLowerCase();
  const normalizedQuery = query.toLowerCase();

  if (!normalizedPrefix || !normalizedQuery.startsWith(normalizedPrefix)) {
    label.textContent = query;
    return label;
  }

  const prefixSpan = document.createElement("span");
  prefixSpan.className = "suggestion-prefix";
  prefixSpan.textContent = query.slice(0, normalizedPrefix.length);

  const suffix = document.createTextNode(query.slice(normalizedPrefix.length));
  label.append(prefixSpan, suffix);
  return label;
};

const renderSuggestionState = (message, tone = "idle") => {
  suggestionList.replaceChildren();

  const item = document.createElement("li");
  item.className = "suggestion-item is-state";

  const stateBox = document.createElement("div");
  stateBox.className = "suggestion-state";

  if (tone === "loading") {
    stateBox.classList.add("is-loading");
  }

  if (tone === "error") {
    stateBox.classList.add("is-error");
  }

  stateBox.textContent = message;
  item.appendChild(stateBox);
  suggestionList.appendChild(item);
};

const renderSuggestions = (suggestions, prefix) => {
  suggestionList.replaceChildren();
  state.currentSuggestions = suggestions;
  state.currentPrefix = prefix;
  state.activeSuggestionIndex =
    suggestions.length > 0
      ? Math.min(state.activeSuggestionIndex, suggestions.length - 1)
      : -1;

  if (suggestions.length === 0) {
    renderSuggestionState("No ranked suggestions are available for this prefix yet.");
    return;
  }

  suggestions.forEach((suggestion, index) => {
    const item = document.createElement("li");
    item.className = "suggestion-item";
    item.style.animationDelay = `${index * 35}ms`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-button";

    if (index === state.activeSuggestionIndex) {
      button.classList.add("is-active");
    }

    const main = document.createElement("span");
    main.className = "suggestion-main";

    const mark = document.createElement("span");
    mark.className = "suggestion-mark";
    mark.setAttribute("aria-hidden", "true");

    main.append(mark, createSuggestionLabel(suggestion.query, prefix));

    const countLabel = document.createElement("span");
    countLabel.className = "suggestion-count";
    countLabel.textContent = formatInteger(suggestion.count);

    button.append(main, countLabel);
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
    item.textContent = "No recent searches yet. Submit a search to create trend activity.";
    trendingList.appendChild(item);
    return;
  }

  items.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "trend-item";

    const rank = document.createElement("span");
    rank.className = "trend-rank";
    rank.textContent = String(index + 1);

    const queryLabel = document.createElement("span");
    queryLabel.className = "trend-query";
    queryLabel.textContent = entry.query;

    const scoreLabel = document.createElement("span");
    scoreLabel.className = "trend-score";
    scoreLabel.textContent = formatInteger(entry.score);

    item.append(rank, queryLabel, scoreLabel);
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
    setText(metricFields.suggestRequests, formatInteger(metrics.suggestRequests));
    setText(metricFields.cacheHits, formatInteger(metrics.cacheHits));
    setText(metricFields.cacheMisses, formatInteger(metrics.cacheMisses));
    setText(
      metricFields.cacheHitRate,
      `${(Number(metrics.cacheHitRate || 0) * 100).toFixed(1)}%`
    );
    setText(metricFields.searchRequests, formatInteger(metrics.searchRequests));
    setText(metricFields.batchFlushes, formatInteger(metrics.batchFlushes));
    setText(metricFields.queuedWrites, formatInteger(metrics.queuedWrites));
    setText(metricFields.totalSearchEvents, formatInteger(metrics.totalSearchEvents));
    setText(metricFields.distinctRowsWritten, formatInteger(metrics.distinctRowsWritten));
    setText(metricFields.writeReductionEstimate, metrics.writeReductionEstimate);
    updateRequestInsightFields();
  } catch (error) {
    setText(metricFields.writeReductionEstimate, getErrorMessage(error, "Unable to load metrics."));
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
    setStatus(getErrorMessage(error, "Unable to load trending searches."), "error");
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
    setText(metricFields.routingReplicas, formatInteger(payload.replicas));
    setText(metricFields.routingStrategy, payload.strategy);
    setText(metricFields.routingNote, payload.note);
  } catch (error) {
    setText(metricFields.routingNode, "error");
    setText(metricFields.routingNote, getErrorMessage(error, "Unable to load cache routing details."));
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

    const normalizedPrefix = payload.prefix || "";
    renderSuggestions(payload.suggestions || [], normalizedPrefix);
    setSource(payload.source || "unknown");
    setLookupChips(payload.source || "unknown");

    state.lastPrefix = normalizedPrefix || "popular";
    state.lastSource = payload.source === "cache" ? "cache" : "prefix-index";
    state.lastCacheStatus = payload.source === "cache" ? "hit" : "miss";
    updateRequestInsightFields();

    if (normalizedPrefix.trim()) {
      setStatus(`Showing matches for ${normalizedPrefix}`);
    } else {
      setStatus("Showing popular searches because the input is empty");
    }

    await loadMetrics();
  } catch (error) {
    if (requestId !== state.latestSuggestRequest) {
      return;
    }

    const message = getErrorMessage(error, "Suggestion lookup failed.");
    state.currentSuggestions = [];
    state.activeSuggestionIndex = -1;
    renderSuggestionState(message, "error");
    setSource("Unavailable");
    setLookupChips("unknown");
    setStatus(message, "error");
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
    setStatus(getErrorMessage(error, "Search submission failed."), "error");
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
    renderSuggestions(state.currentSuggestions, state.currentPrefix);
    return;
  }

  if (event.key === "ArrowUp" && state.currentSuggestions.length > 0) {
    event.preventDefault();
    state.activeSuggestionIndex =
      state.activeSuggestionIndex <= 0
        ? state.currentSuggestions.length - 1
        : state.activeSuggestionIndex - 1;
    renderSuggestions(state.currentSuggestions, state.currentPrefix);
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

routingKeyInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void loadCacheRouting();
  }
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    void switchTab(button.dataset.tabTarget);
  });
});

updateRequestInsightFields();
updateClearButton();
setLookupChips("index");
void Promise.all([fetchSuggestions(""), loadTrending(), loadMetrics(), loadCacheRouting()]);
