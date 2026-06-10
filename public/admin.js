const adminState = {
  overview: null,
  metrics: null,
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

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", `${minutes}m`].filter(Boolean).join(" ");
}

function formatKickoff(match) {
  return match?.kickoffUtc ? `${kickoffFormatter.format(new Date(match.kickoffUtc))} (${userTimeZone})` : "";
}

function displayPhase(value) {
  const phase = String(value || "").trim();
  const group = phase.match(/GROUP_([A-Z])$/i);
  return group ? `GROUP ${group[1].toUpperCase()}` : phase.replace(/_/g, " ");
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
  return [user.name, user.nickname, user.email].join(" ").toLowerCase();
}

function searchableMatch(match) {
  return [match?.id, match?.phase, match?.home, match?.away, match?.city, match?.stadium].join(" ").toLowerCase();
}

function filteredUsers() {
  const query = adminState.search.trim().toLowerCase();
  return adminState.overview.users.filter((user) => !query || searchableUser(user).includes(query));
}

function filteredTeams() {
  const query = adminState.search.trim().toLowerCase();
  return adminState.overview.teams.filter((team) => !query || [
    team.name,
    team.inviteCode,
    team.owner.nickname,
    team.owner.name,
    team.owner.email,
    ...team.members.flatMap((member) => [member.nickname, member.name, member.email])
  ].join(" ").toLowerCase().includes(query));
}

function filteredPredictions() {
  const query = adminState.search.trim().toLowerCase();
  return adminState.overview.predictions.filter((prediction) => {
    const phaseOk = adminState.phase === "all" || prediction.match?.phase === adminState.phase;
    const searchOk = !query || [
      prediction.user?.name,
      prediction.user?.nickname,
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
  phases.forEach((phase) => select.append(new Option(displayPhase(phase), phase)));
}

function renderUsers() {
  const users = filteredUsers();
  $("#usersPanelCount").textContent = `${users.length} users`;
  $("#userRows").innerHTML = users.map((user) => `
    <tr>
      <td>
        <strong>${escapeHtml(user.nickname)}${user.isAdmin ? " (admin)" : ""}</strong>
        <span>${escapeHtml(user.name)} - ${escapeHtml(user.email)}</span>
      </td>
      <td><strong>${user.predictionCount}</strong><span>saved picks</span></td>
      <td><strong>${user.accuracy.points}</strong><span>leaderboard score</span></td>
      <td><strong>${user.accuracy.exactScorePercent}%</strong><span>${user.accuracy.exactScoreHits}/${user.accuracy.graded} graded</span></td>
      <td><strong>${user.accuracy.resultPercent}%</strong><span>${user.accuracy.resultHits}/${user.accuracy.graded} graded</span></td>
      <td><button class="open-user" data-user-id="${escapeHtml(user.id)}" type="button">Open</button></td>
    </tr>
  `).join("") || `<tr><td colspan="6"><span>No users match the current search.</span></td></tr>`;

  $$(".open-user").forEach((button) => {
    button.addEventListener("click", () => {
      adminState.selectedUserId = button.dataset.userId;
      renderUserDetail();
    });
  });
}

function renderTeams() {
  const teams = filteredTeams();
  $("#teamsPanelCount").textContent = `${teams.length} ${teams.length === 1 ? "team" : "teams"}`;
  $("#adminTeamList").innerHTML = teams.map((team) => `
    <article class="admin-team">
      <div class="admin-team-heading">
        <form class="admin-team-rename" data-team-id="${escapeHtml(team.id)}">
          <label>
            <span>Team name</span>
            <input name="name" maxlength="40" value="${escapeHtml(team.name)}">
          </label>
          <button type="submit">Save name</button>
        </form>
        <div class="admin-team-meta">
          <span>Invite code</span>
          <strong>${escapeHtml(team.inviteCode)}</strong>
          <span>${team.members.length} ${team.members.length === 1 ? "member" : "members"}</span>
          <button class="ghost delete-admin-team" data-team-id="${escapeHtml(team.id)}" data-team-name="${escapeHtml(team.name)}" type="button">Delete team</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="admin-team-members">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${team.members.map((member) => {
              const isOwner = member.id === team.owner.id;
              return `
                <tr>
                  <td>
                    <strong>${escapeHtml(member.nickname)}</strong>
                    <span>${escapeHtml(member.name)} - ${escapeHtml(member.email)}</span>
                  </td>
                  <td><strong>${isOwner ? "Owner" : "Member"}</strong></td>
                  <td>
                    ${isOwner
                      ? `<span>Owner cannot be removed</span>`
                      : `<button class="ghost remove-admin-team-member" data-team-id="${escapeHtml(team.id)}" data-member-id="${escapeHtml(member.id)}" data-member-name="${escapeHtml(member.nickname)}" type="button">Remove</button>`}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `).join("") || `<p class="empty-state">No teams match the current search.</p>`;

  $$(".admin-team-rename").forEach((form) => form.addEventListener("submit", handleRenameTeam));
  $$(".delete-admin-team").forEach((button) => button.addEventListener("click", handleDeleteTeam));
  $$(".remove-admin-team-member").forEach((button) => button.addEventListener("click", handleRemoveTeamMember));
}

function renderUserDetail() {
  const user = adminState.overview.users.find((item) => item.id === adminState.selectedUserId);
  if (!user) {
    $("#userDetailPanel").classList.add("hidden");
    return;
  }
  const predictions = adminState.overview.predictions.filter((prediction) => prediction.user.id === user.id);
  $("#userDetailTitle").textContent = `${user.nickname} - predictions`;
  $("#userDetailStats").innerHTML = `
    <div><strong>${user.predictionCount}</strong><span>predictions</span></div>
    <div><strong>${user.accuracy.points || 0}</strong><span>leaderboard points</span></div>
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
          <strong>${escapeHtml(prediction.user.nickname)}</strong>
          <span>${escapeHtml(prediction.user.name)} - ${escapeHtml(prediction.user.email)}</span>
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
          <span>${escapeHtml(displayPhase(match.phase))} - ${escapeHtml(formatKickoff(match))}</span>
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
          <span>${escapeHtml(displayPhase(match.phase))} - ${escapeHtml(formatKickoff(match))}</span>
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

function renderMetricBars(container, items, labelKey, valueKey) {
  const max = Math.max(1, ...items.map((item) => item[valueKey]));
  container.innerHTML = items.map((item) => `
    <div class="metric-bar-row">
      <span title="${escapeHtml(item[labelKey])}">${escapeHtml(item[labelKey])}</span>
      <progress class="metric-bar-track" max="${max}" value="${item[valueKey]}" aria-label="${escapeHtml(item[labelKey])}: ${item[valueKey]}"></progress>
      <strong>${item[valueKey]}</strong>
    </div>
  `).join("") || `<p class="metric-empty">No requests recorded yet.</p>`;
}

function renderMetrics() {
  const metrics = adminState.metrics;
  if (!metrics) return;
  $("#metricsUpdatedAt").textContent = `Updated ${formatDateTime(metrics.generatedAt)}`;
  $("#metricsCards").innerHTML = `
    <div><span>Requests/min</span><strong>${metrics.requests.perMinute}</strong><small>${metrics.requests.lastFiveMinutes} in 5 minutes</small></div>
    <div><span>p95 latency</span><strong>${metrics.requests.p95Ms} ms</strong><small>p50 ${metrics.requests.p50Ms} ms</small></div>
    <div><span>Application errors</span><strong>${metrics.requests.errorRate}%</strong><small>5xx response rate</small></div>
    <div><span>Memory</span><strong>${formatBytes(metrics.memory.rss)}</strong><small>${formatBytes(metrics.memory.heapUsed)} heap used</small></div>
    <div><span>Uptime</span><strong>${formatUptime(metrics.uptimeSeconds)}</strong><small>Current process</small></div>
    <div><span>Database</span><strong>${metrics.app.users} users</strong><small>${metrics.app.predictions} predictions, ${metrics.app.results} results</small></div>
  `;

  const timeline = metrics.requests.timeline;
  const timelineMax = Math.max(1, ...timeline.map((item) => item.requests));
  $("#trafficChart").innerHTML = timeline.map((item) => `
    <div class="traffic-column" title="${new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}: ${item.requests} requests, ${item.errors} errors">
      <div class="traffic-stack">
        <progress class="traffic-requests" max="${timelineMax}" value="${item.requests}" aria-label="${item.requests} requests"></progress>
        <progress class="traffic-errors" max="${timelineMax}" value="${item.errors}" aria-label="${item.errors} errors"></progress>
      </div>
      <span>${new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
    </div>
  `).join("");

  const statuses = Object.entries(metrics.requests.statuses)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => a.status.localeCompare(b.status));
  renderMetricBars($("#statusChart"), statuses, "status", "count");
  renderMetricBars($("#routeChart"), metrics.requests.routes, "route", "count");
}

function render() {
  if (!adminState.overview) return;
  renderSummary();
  renderFilters();
  renderUsers();
  renderTeams();
  renderPredictions();
  renderStats();
  renderResults();
  renderMetrics();
  $$(".admin-tab").forEach((button) => button.classList.toggle("active", button.dataset.view === adminState.view));
  $("#usersPanel").classList.toggle("hidden", adminState.view !== "users");
  $("#teamsPanel").classList.toggle("hidden", adminState.view !== "teams");
  $("#predictionPanel").classList.toggle("hidden", adminState.view !== "predictions");
  $("#statsPanel").classList.toggle("hidden", adminState.view !== "stats");
  $("#resultsPanel").classList.toggle("hidden", adminState.view !== "results");
  $("#metricsPanel").classList.toggle("hidden", adminState.view !== "metrics");
  if (adminState.view !== "users") $("#userDetailPanel").classList.add("hidden");
}

async function handleRenameTeam(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  const name = form.elements.name.value.trim();
  try {
    button.disabled = true;
    const data = await api(`/api/admin/teams/${form.dataset.teamId}`, {
      method: "PUT",
      body: JSON.stringify({ name })
    });
    $("#adminMessage").textContent = data.message;
    await loadOverview();
  } catch (error) {
    $("#adminMessage").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function handleDeleteTeam(event) {
  const button = event.currentTarget;
  if (!window.confirm(`Delete ${button.dataset.teamName}? This removes the team for every member.`)) return;
  try {
    button.disabled = true;
    const data = await api(`/api/admin/teams/${button.dataset.teamId}`, { method: "DELETE" });
    $("#adminMessage").textContent = data.message;
    await loadOverview();
  } catch (error) {
    $("#adminMessage").textContent = error.message;
    button.disabled = false;
  }
}

async function handleRemoveTeamMember(event) {
  const button = event.currentTarget;
  if (!window.confirm(`Remove ${button.dataset.memberName} from this team?`)) return;
  try {
    button.disabled = true;
    const data = await api(`/api/admin/teams/${button.dataset.teamId}/members/${button.dataset.memberId}`, {
      method: "DELETE"
    });
    $("#adminMessage").textContent = data.message;
    await loadOverview();
  } catch (error) {
    $("#adminMessage").textContent = error.message;
    button.disabled = false;
  }
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
    $("#adminMessage").textContent = "Updating match results...";
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

async function loadMetrics() {
  adminState.metrics = await api("/api/admin/metrics");
  renderMetrics();
}

function bindEvents() {
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
      if (adminState.view === "metrics") {
        loadMetrics().catch((error) => {
          $("#adminMessage").textContent = error.message;
        });
      }
    });
  });
  $("#closeUserDetail").addEventListener("click", () => {
    adminState.selectedUserId = "";
    $("#userDetailPanel").classList.add("hidden");
  });
  $("#syncResultsBtn").addEventListener("click", handleSyncResults);
  $("#refreshMetricsBtn").addEventListener("click", () => {
    loadMetrics().catch((error) => {
      $("#adminMessage").textContent = error.message;
    });
  });
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

setInterval(() => {
  if (adminState.view !== "metrics" || document.hidden) return;
  loadMetrics().catch(() => {});
}, 15000);
