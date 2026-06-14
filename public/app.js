let matches = [];

const state = {
  currentUser: null,
  token: localStorage.getItem("wc_auth_token") || "",
  predictions: {},
  matchesLoaded: false,
  matchesError: "",
  groupBy: "date",
  search: "",
  phase: "all",
  team: "all"
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const kickoffDateFormatter = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const kickoffTimeFormatter = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" });
const matchVisibilityAfterKickoffMs = 24 * 60 * 60 * 1000;
const tournamentStages = [
  { key: "group-stage", label: "Group stage" },
  { key: "round-of-32", label: "Round of 32" },
  { key: "round-of-16", label: "Round of 16" },
  { key: "quarter-finals", label: "Quarter-finals" },
  { key: "semi-finals", label: "Semi-finals" },
  { key: "third-place", label: "Third place" },
  { key: "final", label: "Final" }
];
const stageLabels = new Map(tournamentStages.map((stage) => [stage.key, stage.label]));

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function loadMatches() {
  try {
    const data = await api("/api/matches");
    matches = Array.isArray(data.matches) ? data.matches : [];
    state.matchesError = "";
  } catch (error) {
    matches = [];
    state.matchesError = "Fixtures are temporarily unavailable. Please try again later.";
  } finally {
    state.matchesLoaded = true;
  }
}

function kickoffDate(match) {
  return kickoffDateFormatter.format(new Date(match.kickoffUtc));
}

function kickoffTime(match) {
  return kickoffTimeFormatter.format(new Date(match.kickoffUtc));
}

function kickoffLabel(match) {
  return `${kickoffDate(match)} - ${kickoffTime(match)} (${userTimeZone})`;
}

function displayPhase(value) {
  const phase = String(value || "").trim();
  const group = phase.match(/GROUP_([A-Z])$/i);
  return group ? `Group ${group[1].toUpperCase()}` : stageLabels.get(stageKey(phase)) || phase.replace(/_/g, " ");
}

function stageKey(value) {
  const phase = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (/^GROUP_[A-Z]$/.test(phase)) return "group-stage";
  if (["LAST_32", "ROUND_OF_32"].includes(phase)) return "round-of-32";
  if (["LAST_16", "ROUND_OF_16"].includes(phase)) return "round-of-16";
  if (["QUARTER_FINALS", "QUARTER_FINAL"].includes(phase)) return "quarter-finals";
  if (["SEMI_FINALS", "SEMI_FINAL"].includes(phase)) return "semi-finals";
  if (["THIRD_PLACE", "THIRD_PLACE_PLAY_OFF"].includes(phase)) return "third-place";
  if (phase === "FINAL") return "final";
  return phase.toLowerCase();
}

function phaseOrder(value) {
  const group = String(value || "").match(/^Group ([A-Z])$/);
  if (group) return group[1].charCodeAt(0) - 65;
  const stage = tournamentStages.findIndex((item) => item.label === value);
  return stage === -1 ? Number.MAX_SAFE_INTEGER : 100 + stage;
}

function hasMatchStarted(match) {
  return Date.now() >= new Date(match.kickoffUtc).getTime();
}

function isMatchVisible(match) {
  const kickoff = new Date(match.kickoffUtc).getTime();
  return !Number.isFinite(kickoff) || Date.now() - kickoff <= matchVisibilityAfterKickoffMs;
}

function fillSelects() {
  const phaseSelect = $("#phaseFilter");
  const teamSelect = $("#teamFilter");
  const visibleMatches = matches.filter(isMatchVisible);
  phaseSelect.replaceChildren(new Option("All stages", "all"));
  teamSelect.replaceChildren(new Option("All teams", "all"));
  const availableStages = new Set(visibleMatches.map((match) => stageKey(match.phase)));
  tournamentStages.forEach((stage) => {
    if (availableStages.has(stage.key)) phaseSelect.append(new Option(stage.label, stage.key));
  });

  const realTeams = [...new Set(visibleMatches.flatMap((match) => [match.home, match.away]))]
    .filter((team) => !/^(Winner|Runner-up|Loser|3rd)/.test(team))
    .sort();
  realTeams.forEach((team) => teamSelect.append(new Option(team, team)));
}

function filteredMatches() {
  const query = state.search.trim().toLowerCase();
  return matches.filter((match) => {
    if (!isMatchVisible(match)) return false;
    const phaseOk = state.phase === "all" || stageKey(match.phase) === state.phase;
    const teamOk = state.team === "all" || match.home === state.team || match.away === state.team;
    const queryOk = !query || [
      match.id,
      match.date,
      kickoffDate(match),
      kickoffTime(match),
      displayPhase(match.phase),
      stageLabels.get(stageKey(match.phase)),
      match.home,
      match.away,
      match.stadium,
      match.city
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
    return phaseOk && teamOk && queryOk;
  });
}

function groupMatches(items) {
  const groups = new Map();
  items.forEach((match) => {
    let keys;
    if (state.groupBy === "team") {
      keys = state.team !== "all"
        ? [state.team]
        : [match.home, match.away].filter((team) => !/^(Winner|Runner-up|Loser|3rd)/.test(team));
      if (!keys.length) keys = ["Knockout placeholders"];
    } else if (state.groupBy === "phase") {
      keys = [displayPhase(match.phase)];
    } else {
      keys = [kickoffDate(match)];
    }
    keys.forEach((key) => {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(match);
    });
  });
  if (state.groupBy === "phase") {
    return new Map([...groups.entries()].sort(([left], [right]) => phaseOrder(left) - phaseOrder(right)));
  }
  return groups;
}

function clearFilters() {
  state.search = "";
  state.phase = "all";
  state.team = "all";
  $("#searchInput").value = "";
  $("#phaseFilter").value = "all";
  $("#teamFilter").value = "all";
  renderMatches();
}

function renderMatches() {
  const container = $("#matches");
  const predictions = state.predictions;
  const items = filteredMatches();
  const groups = groupMatches(items);
  container.replaceChildren();

  $("#matchCount").textContent = items.length;
  $("#savedCount").textContent = Object.keys(predictions).length;
  $("#activeView").textContent = $(`.segment[data-group="${state.groupBy}"]`).textContent;

  if (!items.length) {
    const empty = document.createElement("section");
    empty.className = "group";
    const header = document.createElement("div");
    header.className = "group-header";
    const noFixtures = state.matchesLoaded && matches.length === 0;
    header.innerHTML = `<h2>${state.matchesError || (noFixtures ? "Fixtures will appear here when available." : "No matches found")}</h2>`;
    const clearButton = document.createElement("button");
    clearButton.className = "ghost";
    clearButton.type = "button";
    clearButton.textContent = "Clear filters";
    clearButton.addEventListener("click", clearFilters);
    if (!noFixtures) header.append(clearButton);
    empty.append(header);
    container.append(empty);
    return;
  }

  groups.forEach((groupItems, title) => {
    const section = document.createElement("section");
    section.className = "group";
    const header = document.createElement("div");
    header.className = "group-header";
    header.innerHTML = `<h2>${title}</h2><span>${groupItems.length} matches</span>`;
    const list = document.createElement("div");
    list.className = "match-list";
    groupItems.forEach((match) => list.append(renderCard(match, predictions[match.id])));
    section.append(header, list);
    container.append(section);
  });
}

function renderCard(match, prediction) {
  const node = $("#matchTemplate").content.firstElementChild.cloneNode(true);
  $(".phase", node).textContent = displayPhase(match.phase);
  $(".date", node).textContent = kickoffLabel(match);
  $(".home", node).textContent = match.home;
  $(".away", node).textContent = match.away;
  const venueParts = [match.stadium, match.city]
    .map((value) => String(value || "").trim())
    .filter((value) => value && value.toUpperCase() !== "TBD");
  const venue = $(".venue", node);
  venue.textContent = [...new Set(venueParts)].join(", ");
  venue.classList.toggle("hidden", !venue.textContent);

  const homeScore = $(".home-score", node);
  const awayScore = $(".away-score", node);
  homeScore.setAttribute("aria-label", `${match.home} predicted score`);
  awayScore.setAttribute("aria-label", `${match.away} predicted score`);
  const stateLine = $(".prediction-state", node);
  const form = $(".prediction", node);
  const saveButton = $("button", form);
  const locked = hasMatchStarted(match);
  if (prediction) {
    homeScore.value = prediction.home;
    awayScore.value = prediction.away;
    stateLine.textContent = `Saved: ${match.home} ${prediction.home} - ${prediction.away} ${match.away}`;
  } else {
    stateLine.textContent = state.currentUser ? "No prediction yet" : "Log in to save";
  }
  if (locked) {
    homeScore.disabled = true;
    awayScore.disabled = true;
    saveButton.disabled = true;
    stateLine.textContent = prediction
      ? `Locked after kickoff: ${match.home} ${prediction.home} - ${prediction.away} ${match.away}`
      : "Locked after kickoff";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (hasMatchStarted(match)) {
      stateLine.textContent = "Predictions are locked after kickoff.";
      return;
    }
    if (!state.currentUser) {
      stateLine.textContent = "Please register or log in first.";
      return;
    }
    if (homeScore.value === "" || awayScore.value === "") {
      stateLine.textContent = "Enter both scores.";
      return;
    }
    try {
      stateLine.textContent = "Saving...";
      const data = await api(`/api/predictions/${match.id}`, {
        method: "PUT",
        body: JSON.stringify({
          home: Number(homeScore.value),
          away: Number(awayScore.value)
        })
      });
      state.predictions[match.id] = {
        home: data.prediction.home,
        away: data.prediction.away,
        savedAt: new Date().toISOString()
      };
      renderMatches();
    } catch (error) {
      stateLine.textContent = error.message;
    }
  });

  return node;
}

function renderAuth() {
  const loggedIn = Boolean(state.currentUser);
  $("#guestActions").classList.toggle("hidden", loggedIn);
  $("#logoutBtn").classList.toggle("hidden", !loggedIn);
  $(".header-profile").classList.toggle("hidden", !loggedIn);
}

function bindEvents() {
  $("#logoutBtn").addEventListener("click", () => {
    state.currentUser = null;
    state.token = "";
    state.predictions = {};
    localStorage.removeItem("wc_auth_token");
    renderAuth();
    renderMatches();
  });
  $$(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      state.groupBy = button.dataset.group;
      $$(".segment").forEach((item) => item.classList.toggle("active", item === button));
      renderMatches();
    });
  });
  $("#searchInput").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderMatches();
  });
  $("#phaseFilter").addEventListener("change", (event) => {
    state.phase = event.target.value;
    renderMatches();
  });
  $("#teamFilter").addEventListener("change", (event) => {
    state.team = event.target.value;
    renderMatches();
  });
  $("#clearFiltersBtn").addEventListener("click", clearFilters);
}

async function restoreSession() {
  if (!state.token) return;
  try {
    const data = await api("/api/session");
    state.currentUser = data.user;
    await loadPredictions();
  } catch {
    state.token = "";
    state.predictions = {};
    localStorage.removeItem("wc_auth_token");
  }
}

async function loadPredictions() {
  if (!state.currentUser) {
    state.predictions = {};
    return;
  }
  const data = await api("/api/predictions");
  state.predictions = data.predictions || {};
}

async function init() {
  bindEvents();
  await restoreSession();
  renderAuth();
  await loadMatches();
  fillSelects();
  renderMatches();
}

init();
