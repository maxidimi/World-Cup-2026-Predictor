const token = localStorage.getItem("wc_auth_token") || "";
const message = document.querySelector("#profileMessage");
const list = document.querySelector("#profilePredictionsList");
const dateFormatter = new Intl.DateTimeFormat("en", {
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

function displayPhase(value) {
  const phase = String(value || "").trim();
  const group = phase.match(/GROUP_([A-Z])$/i);
  return group ? `Group ${group[1].toUpperCase()}` : phase.replace(/_/g, " ");
}

function renderProfile(data) {
  document.querySelector("#profileNickname").textContent = data.user.nickname || data.user.name;
  document.querySelector("#profileIdentity").textContent = `${data.user.name} | ${data.user.email}`;
  document.querySelector("#profilePoints").textContent = data.summary.points;
  document.querySelector("#profilePredictions").textContent = data.summary.totalPredictions;
  document.querySelector("#profileGraded").textContent = data.summary.graded;
  document.querySelector("#profileExact").textContent = data.summary.exactScoreHits;
  document.querySelector("#profileResults").textContent = data.summary.resultHits;

  if (!data.predictions.length) {
    list.innerHTML = `<p class="empty-state">You have not made any predictions yet.</p>`;
    return;
  }

  list.innerHTML = data.predictions.map((item) => {
    const match = item.match;
    const completed = Boolean(item.result);
    const pointsLabel = completed ? `${item.points} ${item.points === 1 ? "point" : "points"}` : "Not completed";
    const kickoff = match?.kickoffUtc ? dateFormatter.format(new Date(match.kickoffUtc)) : "";
    return `
      <article class="profile-prediction">
        <div class="profile-match-meta">
          <span>${escapeHtml(displayPhase(match?.phase))}</span>
          <time>${escapeHtml(kickoff)}</time>
        </div>
        <div class="profile-scoreline">
          <strong>${escapeHtml(match?.home || item.matchId)}</strong>
          <span class="profile-score">${item.prediction.home} - ${item.prediction.away}</span>
          <strong>${escapeHtml(match?.away || "")}</strong>
        </div>
        <div class="profile-result">
          <span>${completed ? `Final score ${item.result.home} - ${item.result.away}` : "Awaiting final score"}</span>
          <strong class="profile-points ${completed ? `points-${item.points}` : ""}">${pointsLabel}</strong>
        </div>
      </article>
    `;
  }).join("");
}

async function loadProfile() {
  if (!token) {
    window.location.replace("login.html");
    return;
  }
  try {
    const response = await fetch("/api/profile", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (response.status === 401) {
      localStorage.removeItem("wc_auth_token");
      window.location.replace("login.html");
      return;
    }
    if (!response.ok) throw new Error(data.error || "Unable to load your profile.");
    renderProfile(data);
    message.textContent = "";
  } catch (error) {
    message.textContent = error.message;
  }
}

loadProfile();
