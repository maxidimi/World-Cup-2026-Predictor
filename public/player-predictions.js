const message = document.querySelector("#playerPredictionsMessage");
const scoresList = document.querySelector("#playerScoresList");
const groupGrid = document.querySelector("#playerGroupGrid");
const bracketBoard = document.querySelector("#playerBracketBoard");
const nickname = new URLSearchParams(window.location.search).get("nickname") || "";
let playerData;

const roundLayout = [
  { title: "Round of 32", matches: ["M74", "M77", "M73", "M75", "M83", "M84", "M81", "M82", "M76", "M78", "M79", "M80", "M86", "M88", "M85", "M87"], span: 1 },
  { title: "Round of 16", matches: ["M89", "M90", "M93", "M94", "M91", "M92", "M95", "M96"], span: 2 },
  { title: "Quarter-finals", matches: ["M97", "M98", "M99", "M100"], span: 4 },
  { title: "Semi-finals", matches: ["M101", "M102"], span: 8 },
  { title: "Finals", matches: ["M104", "M103"], span: 8, final: true }
];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[char]));
}

function displayPhase(value) {
  const phase = String(value || "").trim();
  const group = phase.match(/GROUP_([A-Z])$/i);
  return group ? `Group ${group[1].toUpperCase()}` : phase.replace(/_/g, " ");
}

function renderScores() {
  const predictions = playerData.predictions || [];
  scoresList.innerHTML = predictions.map((item) => {
    const match = item.match;
    const completed = Boolean(item.result);
    const pointsLabel = completed ? `${item.points} ${item.points === 1 ? "point" : "points"}` : "Not completed";
    const kickoff = match?.kickoffUtc ? new Date(match.kickoffUtc).toLocaleString([], {
      weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
    }) : "";
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
  }).join("") || `<p class="empty-state">This player has not made any match predictions yet.</p>`;
}

function renderGroups() {
  const picks = playerData.bracket?.picks;
  if (!picks?.saved) {
    groupGrid.innerHTML = `<p class="empty-state">This player has not saved group predictions yet.</p>`;
    return;
  }
  const positionLabels = ["1st", "2nd", "3rd", "4th"];
  groupGrid.innerHTML = Object.keys(picks.groupRankings || {}).sort().map((group) => `
    <article class="group-prediction-card">
      <header><h3>Group ${group}</h3></header>
      <div class="public-group-ranking">
        ${picks.groupRankings[group].map((team, index) => `
          <div>
            <span>${positionLabels[index]}</span>
            <strong>${escapeHtml(team)}</strong>
            ${index === 2 && picks.thirdPlaceGroups.includes(group) ? `<em>Qualified</em>` : ""}
          </div>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function matchById(matchId) {
  return playerData.bracket.matches.find((match) => match.id === matchId);
}

function participantsFor(match) {
  if (!match) return ["", ""];
  const picks = playerData.bracket.picks;
  if (match.round === "Round of 32") {
    return [picks.entrants[`${match.id}.home`] || "", picks.entrants[`${match.id}.away`] || ""];
  }
  return [sourceTeam(match.home), sourceTeam(match.away)];
}

function sourceTeam(source) {
  const picks = playerData.bracket.picks;
  if (source.type === "winner") return picks.winners[source.matchId] || "";
  if (source.type === "loser") {
    const participants = participantsFor(matchById(source.matchId));
    const winner = picks.winners[source.matchId];
    return participants.find((team) => team && team !== winner) || "";
  }
  return "";
}

function renderBracketMatch(match, row, span, finalRound) {
  const participants = participantsFor(match);
  const winner = playerData.bracket.picks.winners[match.id] || "";
  return `
    <article class="bracket-match bracket-slot-${row} bracket-span-${span} ${finalRound ? "final-match" : ""}">
      <header><strong>${match.id}</strong><span>${escapeHtml(match.round)}</span></header>
      <div class="bracket-teams">
        ${participants.map((team) => `
          <div class="bracket-team public-bracket-team ${team && team === winner ? "selected" : ""}">
            <span>${escapeHtml(team || "Waiting for previous winner")}</span>
            <span class="advance-mark">${team && team === winner ? "Win" : ""}</span>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function renderBracket() {
  const picks = playerData.bracket?.picks;
  if (!picks?.saved) {
    bracketBoard.innerHTML = `<p class="empty-state">This player has not saved a bracket yet.</p>`;
    return;
  }
  bracketBoard.innerHTML = roundLayout.map((round) => {
    let row = 1;
    const matches = round.matches.map((matchId) => {
      const card = renderBracketMatch(matchById(matchId), row, round.span, round.final);
      row += round.span;
      return card;
    }).join("");
    return `<section class="bracket-round ${round.final ? "bracket-finals" : ""}">
      <h2>${round.title}</h2><div class="bracket-round-grid">${matches}</div>
    </section>`;
  }).join("");
  const champion = picks.winners.M104 || "";
  document.querySelector("#publicChampionPanel").classList.toggle("hidden", !champion);
  document.querySelector("#publicChampionName").textContent = champion;
}

function renderSummary() {
  document.querySelector("#playerNickname").textContent = playerData.user.nickname;
  document.title = `${playerData.user.nickname} - World Cup Predictor`;
  document.querySelector("#playerPoints").textContent = playerData.summary.points;
  document.querySelector("#playerPredictions").textContent = playerData.summary.totalPredictions;
  document.querySelector("#playerGraded").textContent = playerData.summary.graded;
  document.querySelector("#playerExact").textContent = playerData.summary.exactScoreHits;
  document.querySelector("#playerResults").textContent = playerData.summary.resultHits;
}

function showView(view) {
  document.querySelector("#scoresView").classList.toggle("hidden", view !== "scores");
  document.querySelector("#groupsView").classList.toggle("hidden", view !== "groups");
  document.querySelector("#bracketView").classList.toggle("hidden", view !== "bracket");
  document.querySelectorAll(".prediction-view-tab").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

document.querySelectorAll(".prediction-view-tab").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

async function loadPlayerPredictions() {
  if (!nickname) {
    message.textContent = "Player not found.";
    return;
  }
  try {
    const response = await fetch(`/api/users/${encodeURIComponent(nickname)}/predictions`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load player predictions.");
    playerData = data;
    renderSummary();
    renderScores();
    renderGroups();
    renderBracket();
    message.textContent = "";
  } catch (error) {
    message.textContent = error.message;
  }
}

loadPlayerPredictions();
