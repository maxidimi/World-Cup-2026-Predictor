const rows = document.querySelector("#leaderboardRows");
const message = document.querySelector("#leaderboardMessage");

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
  document.querySelector("#leaderCount").textContent = leaderboard.length;
  document.querySelector("#gradedCount").textContent = leaderboard.reduce((total, user) => total + user.graded, 0);
  document.querySelector("#topScore").textContent = leaderboard[0]?.points || 0;
  rows.innerHTML = leaderboard.map((user) => `
    <tr class="${user.rank <= 3 ? `rank-${user.rank}` : ""}">
      <td><strong class="rank-number">${user.rank}</strong></td>
      <td><strong>${escapeHtml(user.nickname)}</strong></td>
      <td><strong class="points">${user.points}</strong></td>
      <td><strong>${user.exactScoreHits}</strong></td>
      <td><strong>${user.resultHits}</strong></td>
      <td><strong>${user.graded}</strong></td>
    </tr>
  `).join("") || `<tr><td colspan="6"><span>No players yet.</span></td></tr>`;
}

async function loadLeaderboard() {
  message.textContent = "Loading standings...";
  try {
    const response = await fetch("/api/leaderboard");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load the leaderboard.");
    renderLeaderboard(data.leaderboard || []);
    message.textContent = "";
  } catch (error) {
    message.textContent = error.message;
  }
}

loadLeaderboard();
