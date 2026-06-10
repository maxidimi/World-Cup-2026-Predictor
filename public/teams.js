const token = localStorage.getItem("wc_auth_token") || "";
const message = document.querySelector("#teamsMessage");
const teamList = document.querySelector("#teamList");
const standingsPanel = document.querySelector("#teamStandingsPanel");
let teams = [];
let selectedTeamId = "";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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

function renderTeamList() {
  document.querySelector("#teamCount").textContent = `${teams.length} ${teams.length === 1 ? "team" : "teams"}`;
  teamList.innerHTML = teams.map((team) => `
    <article class="team-item ${team.id === selectedTeamId ? "active" : ""}">
      <button class="team-open" data-team-id="${escapeHtml(team.id)}" type="button">
        <strong>${escapeHtml(team.name)}</strong>
        <span>${team.memberCount} ${team.memberCount === 1 ? "member" : "members"}</span>
      </button>
      <div class="team-code">
        <span>Invite code</span>
        <strong>${escapeHtml(team.inviteCode)}</strong>
        <button class="ghost copy-code" data-code="${escapeHtml(team.inviteCode)}" type="button">Copy</button>
      </div>
      <button class="ghost remove-team" data-team-id="${escapeHtml(team.id)}" type="button">
        ${team.isOwner ? "Delete" : "Leave"}
      </button>
    </article>
  `).join("") || `<p class="empty-state">You have not joined a team yet.</p>`;

  document.querySelectorAll(".team-open").forEach((button) => {
    button.addEventListener("click", () => loadTeamLeaderboard(button.dataset.teamId));
  });
  document.querySelectorAll(".copy-code").forEach((button) => {
    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(button.dataset.code);
      message.textContent = "Invite code copied.";
    });
  });
  document.querySelectorAll(".remove-team").forEach((button) => {
    button.addEventListener("click", () => removeTeam(button.dataset.teamId));
  });
}

function renderLeaderboard(data) {
  document.querySelector("#teamStandingsTitle").textContent = data.team.name;
  document.querySelector("#teamStandingsMeta").textContent = `${data.team.memberCount} members`;
  document.querySelector("#teamLeaderboardRows").innerHTML = data.leaderboard.map((user) => `
    <tr class="${user.rank <= 3 ? `rank-${user.rank}` : ""}">
      <td><strong class="rank-number">${user.rank}</strong></td>
      <td><strong>${escapeHtml(user.nickname)}</strong></td>
      <td><strong class="points">${user.points}</strong></td>
      <td><strong>${user.exactScoreHits}</strong></td>
      <td><strong>${user.resultHits}</strong></td>
      <td><strong>${user.graded}</strong></td>
    </tr>
  `).join("");
  standingsPanel.classList.remove("hidden");
}

async function loadTeams(preferredTeamId = "") {
  const data = await api("/api/teams");
  teams = data.teams || [];
  selectedTeamId = preferredTeamId || (teams.some((team) => team.id === selectedTeamId) ? selectedTeamId : teams[0]?.id || "");
  renderTeamList();
  if (selectedTeamId) {
    await loadTeamLeaderboard(selectedTeamId);
  } else {
    standingsPanel.classList.add("hidden");
  }
}

async function loadTeamLeaderboard(teamId) {
  selectedTeamId = teamId;
  renderTeamList();
  const data = await api(`/api/teams/${teamId}/leaderboard`);
  renderLeaderboard(data);
}

async function removeTeam(teamId) {
  const team = teams.find((item) => item.id === teamId);
  if (!team) return;
  const action = team.isOwner ? "delete this team" : "leave this team";
  if (!window.confirm(`Are you sure you want to ${action}?`)) return;
  try {
    const data = await api(`/api/teams/${teamId}`, { method: "DELETE" });
    message.textContent = data.message;
    if (selectedTeamId === teamId) selectedTeamId = "";
    await loadTeams();
  } catch (error) {
    message.textContent = error.message;
  }
}

document.querySelector("#createTeamForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#teamName");
  if (!input.value.trim()) {
    message.textContent = "Enter a team name.";
    return;
  }
  try {
    const data = await api("/api/teams", {
      method: "POST",
      body: JSON.stringify({ name: input.value })
    });
    input.value = "";
    message.textContent = "Team created.";
    await loadTeams(data.team.id);
  } catch (error) {
    message.textContent = error.message;
  }
});

document.querySelector("#joinTeamForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#inviteCode");
  try {
    const data = await api("/api/teams/join", {
      method: "POST",
      body: JSON.stringify({ inviteCode: input.value })
    });
    input.value = "";
    message.textContent = `Joined ${data.team.name}.`;
    await loadTeams(data.team.id);
  } catch (error) {
    message.textContent = error.message;
  }
});

if (!token) {
  window.location.replace("login.html");
} else {
  loadTeams().catch((error) => {
    if (error.status === 401) {
      localStorage.removeItem("wc_auth_token");
      window.location.replace("login.html");
      return;
    }
    message.textContent = error.message;
  });
}
