const adminState = {
  overview: null,
  search: "",
  phase: "all",
  view: "users",
  selectedUserId: ""
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const dateFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });
const kickoffFormatter = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function formatDate(value) {
  return value ? dateFormatter.format(new Date(`${value}T12:00:00`)) : "";
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "Never";
}

function formatKickoff(match) {
  return match?.kickoffUtc ? `${kickoffFormatter.format(new Date(match.kickoffUtc))} (${userTimeZone})` : "";
}

function outcome(home, away) {
  if (home > away) return "1";
  if (home === away) return "x";
  return "2";
}

async function api(path, options = {}) {
  const token = localStorage.getItem("wc_auth_token") || "";
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function redirectAdminError(reason) {
  window.location.href = `admin-error.html?reason=${encodeURIComponent(reason)}`;
}

function matchLabel(match) {
  if (!match) return "Unknown match";
  return `${match.id} - ${match.home} vs ${match.away}`;
}

function searchableUser(user) {
  return [user.name, user.email].join(" ").toLowerCase();
}

function searchableMatch(match) {
  return [match?.id, match?.phase, match?.home, match?.away, match?.city, match?.stadium].join(" ").toLowerCase();
}

function filteredUsers() {
  const query = adminState.search.trim().toLowerCase();
  return adminState.overview.users.filter((user) => !query || searchableUser(user).includes(query));
}

function filteredPredictions() {
  const query = adminState.search.trim().toLowerCase();
  return adminState.overview.predictions.filter((prediction) => {
    const phaseOk = adminState.phase === "all" || prediction.match?.phase === adminState.phase;
    const searchOk = !query || [
      prediction.user?.name,
      prediction.user?.email,
      prediction.matchId,
      searchableMatch(prediction.match)
    ].join(" ").toLowerCase().includes(query);
    return phaseOk && searchOk;
  });
}

function filteredStats() {
  const query = adminState.search.trim().toLowerCase();
  return adminState.overview.stats.filter((stat) => {
    const phaseOk = adminState.phase === "all" || stat.match.phase === adminState.phase;
    const searchOk = !query || searchableMatch(stat.match).includes(query);
    return phaseOk && searchOk;
  });
}

function renderSummary() {
  $("#userCount").textContent = adminState.overview.totals.users;
  $("#predictionCount").textContent = adminState.overview.totals.predictions;
  $("#votedMatchCount").textContent = adminState.overview.totals.matchesWithVotes;
}

function renderFilters() {
  const select = $("#adminPhase");
  if (select.options.length > 1) return;
  const phases = [...new Set(adminState.overview.stats.map((stat) => stat.match.phase))];
  phases.forEach((phase) => select.append(new Option(phase, phase)));
}

function renderUsers() {
  const users = filteredUsers();
  $("#usersPanelCount").textContent = `${users.length} users`;
  $("#userRows").innerHTML = users.map((user) => `
    <tr>
      <td>
        <strong>${escapeHtml(user.name)}${user.isAdmin ? " (admin)" : ""}</strong>
        <span>${escapeHtml(user.email)}</span>
      </td>
      <td><strong>${user.predictionCount}</strong><span>saved picks</span></td>
      <td><strong>${user.accuracy.exactScorePercent}%</strong><span>${user.accuracy.exactScoreHits}/${user.accuracy.graded} graded</span></td>
      <td><strong>${user.accuracy.resultPercent}%</strong><span>${user.accuracy.resultHits}/${user.accuracy.graded} graded</span></td>
      <td><button class="open-user" data-user-id="${escapeHtml(user.id)}" type="button">Open</button></td>
    </tr>
  `).join("") || `<tr><td colspan="5"><span>No users match the current search.</span></td></tr>`;

  $$(".open-user").forEach((button) => {
    button.addEventListener("click", () => {
      adminState.selectedUserId = button.dataset.userId;
      renderUserDetail();
    });
  });
}

function renderUserDetail() {
  const user = adminState.overview.users.find((item) => item.id === adminState.selectedUserId);
  if (!user) {
    $("#userDetailPanel").classList.add("hidden");
    return;
  }
  const predictions = adminState.overview.predictions.filter((prediction) => prediction.user.id === user.id);
  $("#userDetailTitle").textContent = `${user.name} - predictions`;
  $("#userDetailStats").innerHTML = `
    <div><strong>${user.predictionCount}</strong><span>predictions</span></div>
    <div><strong>${user.accuracy.exactScorePercent}%</strong><span>exact scores (${user.accuracy.exactScoreHits}/${user.accuracy.graded})</span></div>
    <div><strong>${user.accuracy.resultPercent}%</strong><span>results 1/x/2 (${user.accuracy.resultHits}/${user.accuracy.graded})</span></div>
  `;
  $("#userPredictionRows").innerHTML = predictions.map((prediction) => {
    const result = prediction.result;
    const exact = result && prediction.home === result.home && prediction.away === result.away;
    const resultHit = result && outcome(prediction.home, prediction.away) === outcome(result.home, result.away);
    return `
      <tr>
        <td>
          <strong>${escapeHtml(matchLabel(prediction.match))}</strong>
          <span>${escapeHtml(prediction.match?.phase || "")} - ${escapeHtml(formatKickoff(prediction.match))}</span>
        </td>
        <td><strong>${prediction.home} - ${prediction.away}</strong><span>${escapeHtml(formatDateTime(prediction.updatedAt))}</span></td>
        <td><strong>${result ? `${result.home} - ${result.away}` : "No result"}</strong></td>
        <td><strong>${result ? (exact ? "Yes" : "No") : "-"}</strong></td>
        <td><strong>${result ? (resultHit ? "Yes" : "No") : "-"}</strong></td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="5"><span>This user has no predictions yet.</span></td></tr>`;
  $("#userDetailPanel").classList.remove("hidden");
  $("#userDetailPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderPredictions() {
  const rows = filteredPredictions();
  $("#predictionPanelCount").textContent = `${rows.length} rows`;
  $("#predictionRows").innerHTML = rows.map((prediction) => {
    const match = prediction.match;
    return `
      <tr>
        <td>
          <strong>${escapeHtml(prediction.user.name)}</strong>
          <span>${escapeHtml(prediction.user.email)}</span>
        </td>
        <td>
          <strong>${escapeHtml(matchLabel(match))}</strong>
          <span>${escapeHtml(match?.phase || "")} - ${escapeHtml(formatKickoff(match))}</span>
        </td>
        <td><strong>${escapeHtml(match?.home || "Home")} ${prediction.home} - ${prediction.away} ${escapeHtml(match?.away || "Away")}</strong></td>
        <td><span>${escapeHtml(formatDateTime(prediction.updatedAt))}</span></td>
        <td>
          <form class="admin-edit" data-id="${escapeHtml(prediction.id)}">
            <input name="home" type="number" min="0" max="30" value="${prediction.home}" aria-label="Home score">
            <input name="away" type="number" min="0" max="30" value="${prediction.away}" aria-label="Away score">
            <button type="submit">Save</button>
          </form>
        </td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="5"><span>No predictions match the current filters.</span></td></tr>`;

  $$(".admin-edit").forEach((form) => form.addEventListener("submit", handleEditPrediction));
}

function renderStats() {
  const rows = filteredStats();
  $("#statsPanelCount").textContent = `${rows.length} matches`;
  $("#statsRows").innerHTML = rows.map((stat) => {
    const match = stat.match;
    return `
      <tr>
        <td>
          <strong>${escapeHtml(matchLabel(match))}</strong>
          <span>${escapeHtml(match.phase)} - ${escapeHtml(formatKickoff(match))}</span>
        </td>
        <td><strong>${stat.predictionCount}</strong><span>people voted</span></td>
        <td>
          <span>${escapeHtml(match.home)} win: ${stat.homeWinVotes}</span>
          <span>Draw: ${stat.drawVotes}</span>
          <span>${escapeHtml(match.away)} win: ${stat.awayWinVotes}</span>
        </td>
        <td><strong>${stat.averageHomeGoals} - ${stat.averageAwayGoals}</strong><span>average predicted score</span></td>
      </tr>
    `;
  }).join("");
}

function renderResults() {
  const rows = filteredStats();
  $("#resultsPanelCount").textContent = `${rows.length} matches`;
  $("#resultRows").innerHTML = rows.map((stat) => {
    const match = stat.match;
    const result = stat.result;
    return `
      <tr>
        <td>
          <strong>${escapeHtml(matchLabel(match))}</strong>
          <span>${escapeHtml(match.phase)} - ${escapeHtml(formatKickoff(match))}</span>
        </td>
        <td><strong>${result ? `${result.home} - ${result.away}` : "Not entered"}</strong></td>
        <td>
          <form class="admin-edit result-edit" data-match-id="${escapeHtml(match.id)}">
            <input name="home" type="number" min="0" max="30" value="${result?.home ?? ""}" placeholder="H" aria-label="Actual home score">
            <input name="away" type="number" min="0" max="30" value="${result?.away ?? ""}" placeholder="A" aria-label="Actual away score">
            <button type="submit">Save</button>
          </form>
        </td>
      </tr>
    `;
  }).join("");
  $$(".result-edit").forEach((form) => form.addEventListener("submit", handleEditResult));
}

function render() {
  if (!adminState.overview) return;
  renderSummary();
  renderFilters();
  renderUsers();
  renderPredictions();
  renderStats();
  renderResults();
  $$(".admin-tab").forEach((button) => button.classList.toggle("active", button.dataset.view === adminState.view));
  $("#usersPanel").classList.toggle("hidden", adminState.view !== "users");
  $("#predictionPanel").classList.toggle("hidden", adminState.view !== "predictions");
  $("#statsPanel").classList.toggle("hidden", adminState.view !== "stats");
  $("#resultsPanel").classList.toggle("hidden", adminState.view !== "results");
  if (adminState.view !== "users") $("#userDetailPanel").classList.add("hidden");
}

function readScores(form) {
  const home = Number(form.elements.home.value);
  const away = Number(form.elements.away.value);
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 30 || away > 30) {
    throw new Error("Scores must be whole numbers from 0 to 30.");
  }
  return { home, away };
}

async function handleEditPrediction(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  $("#adminMessage").textContent = "";
  try {
    const scores = readScores(form);
    button.disabled = true;
    await api(`/api/admin/predictions/${form.dataset.id}`, {
      method: "PUT",
      body: JSON.stringify(scores)
    });
    $("#adminMessage").textContent = "Prediction updated.";
    await loadOverview();
  } catch (error) {
    $("#adminMessage").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function handleEditResult(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  $("#adminMessage").textContent = "";
  try {
    const scores = readScores(form);
    button.disabled = true;
    await api(`/api/admin/results/${form.dataset.matchId}`, {
      method: "PUT",
      body: JSON.stringify(scores)
    });
    $("#adminMessage").textContent = "Result updated. User percentages recalculated.";
    await loadOverview();
  } catch (error) {
    $("#adminMessage").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function handleSyncResults() {
  const button = $("#syncResultsBtn");
  $("#adminMessage").textContent = "";
  try {
    button.disabled = true;
    $("#adminMessage").textContent = "Syncing scores from football-data.org...";
    const data = await api("/api/admin/sync-results", { method: "POST", body: "{}" });
    const summary = data.summary;
    $("#adminMessage").textContent = `Sync complete: ${summary.updated} results updated, ${summary.finished} finished matches found, ${summary.skipped.length} skipped.`;
    await loadOverview();
  } catch (error) {
    $("#adminMessage").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function loadOverview() {
  if (!localStorage.getItem("wc_auth_token")) {
    redirectAdminError("login");
    return;
  }
  $("#adminMessage").textContent = "Loading admin data...";
  adminState.overview = await api("/api/admin/overview");
  $("#adminMessage").textContent = "";
  render();
}

function bindEvents() {
  $("#refreshBtn").addEventListener("click", loadOverview);
  $("#adminSearch").addEventListener("input", (event) => {
    adminState.search = event.target.value;
    render();
  });
  $("#adminPhase").addEventListener("change", (event) => {
    adminState.phase = event.target.value;
    render();
  });
  $$(".admin-tab").forEach((button) => {
    button.addEventListener("click", () => {
      adminState.view = button.dataset.view;
      render();
    });
  });
  $("#closeUserDetail").addEventListener("click", () => {
    adminState.selectedUserId = "";
    $("#userDetailPanel").classList.add("hidden");
  });
  $("#syncResultsBtn").addEventListener("click", handleSyncResults);
}

bindEvents();
loadOverview().catch((error) => {
  if (error.status === 401) {
    redirectAdminError("expired");
    return;
  }
  if (error.status === 403) {
    redirectAdminError("forbidden");
    return;
  }
  $("#adminMessage").textContent = error.message;
});
