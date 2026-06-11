const rows = document.querySelector("#leaderboardRows");
const message = document.querySelector("#leaderboardMessage");
const searchInput = document.querySelector("#leaderboardSearch");
let leaderboardRows = [];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function renderLeaderboard(leaderboard) {
  rows.innerHTML = leaderboard.map((user) => `
    <tr class="${user.rank <= 3 ? `rank-${user.rank}` : ""}">
      <td><strong class="rank-number">${user.rank}</strong></td>
      <td><a class="player-link" href="player-predictions.html?nickname=${encodeURIComponent(user.nickname)}">${escapeHtml(user.nickname)}</a></td>
      <td><strong class="points">${user.points}</strong></td>
      <td><strong>${user.exactScoreHits}</strong></td>
      <td><strong>${user.resultHits}</strong></td>
      <td><strong>${user.graded}</strong></td>
    </tr>
  `).join("") || `<tr><td colspan="6"><span>${leaderboardRows.length ? "No players match your search." : "No players yet."}</span></td></tr>`;
}

function filterLeaderboard() {
  const query = searchInput.value.trim().toLowerCase();
  renderLeaderboard(leaderboardRows.filter((user) => user.nickname.toLowerCase().includes(query)));
}

async function loadLeaderboard() {
  message.textContent = "Loading standings...";
  try {
    const response = await fetch("/api/leaderboard");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load the leaderboard.");
    leaderboardRows = data.leaderboard || [];
    document.querySelector("#leaderCount").textContent = leaderboardRows.length;
    document.querySelector("#gradedCount").textContent = leaderboardRows.reduce((total, user) => total + user.graded, 0);
    document.querySelector("#topScore").textContent = leaderboardRows[0]?.points || 0;
    filterLeaderboard();
    message.textContent = "";
  } catch (error) {
    message.textContent = error.message;
  }
}

searchInput.addEventListener("input", filterLeaderboard);
loadLeaderboard();
