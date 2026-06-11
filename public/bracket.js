const token = localStorage.getItem("wc_auth_token") || "";
const board = document.querySelector("#bracketBoard");
const message = document.querySelector("#bracketMessage");
const saveButton = document.querySelector("#saveBracketBtn");
const state = {
  groups: {},
  matches: [],
  entrants: {},
  winners: {},
  updatedAt: null
};

const roundLayout = [
  { title: "Round of 32", matches: ["M74", "M77", "M73", "M75", "M83", "M84", "M81", "M82", "M76", "M78", "M79", "M80", "M86", "M88", "M85", "M87"], span: 1 },
  { title: "Round of 16", matches: ["M89", "M90", "M93", "M94", "M91", "M92", "M95", "M96"], span: 2 },
  { title: "Quarter-finals", matches: ["M97", "M98", "M99", "M100"], span: 4 },
  { title: "Semi-finals", matches: ["M101", "M102"], span: 8 },
  { title: "Finals", matches: ["M104", "M103"], span: 8, final: true }
];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function matchById(matchId) {
  return state.matches.find((match) => match.id === matchId);
}

function sourceTeam(source) {
  if (source.type === "winner") return state.winners[source.matchId] || "";
  if (source.type === "loser") {
    const participants = participantsFor(matchById(source.matchId));
    const winner = state.winners[source.matchId];
    return participants.find((team) => team && team !== winner) || "";
  }
  return "";
}

function participantsFor(match) {
  if (!match) return ["", ""];
  if (match.round === "Round of 32") {
    return [
      state.entrants[`${match.id}.home`] || "",
      state.entrants[`${match.id}.away`] || ""
    ];
  }
  return [sourceTeam(match.home), sourceTeam(match.away)];
}

function eligibleTeams(source) {
  const groups = source.type === "group" ? [source.group] : source.groups;
  return [...new Set(groups.flatMap((group) => state.groups[group] || []))].sort();
}

function selectedElsewhere(entryKey, team) {
  return Object.entries(state.entrants).some(([key, selected]) => key !== entryKey && selected === team);
}

function teamGroup(team) {
  return Object.entries(state.groups).find(([, teams]) => teams.includes(team))?.[0] || "";
}

function sourceForEntryKey(entryKey) {
  const [matchId, side] = entryKey.split(".");
  return matchById(matchId)?.[side];
}

function thirdGroupSelectedElsewhere(entryKey, team) {
  const source = sourceForEntryKey(entryKey);
  if (source?.type !== "third") return false;
  const group = teamGroup(team);
  return Object.entries(state.entrants).some(([key, selected]) => (
    key !== entryKey &&
    sourceForEntryKey(key)?.type === "third" &&
    teamGroup(selected) === group
  ));
}

function reconcileWinners() {
  let changed = true;
  while (changed) {
    changed = false;
    state.matches.forEach((match) => {
      const winner = state.winners[match.id];
      if (!winner) return;
      const participants = participantsFor(match);
      if (participants.some((team) => !team) || !participants.includes(winner)) {
        delete state.winners[match.id];
        changed = true;
      }
    });
  }
}

function entrantSelect(match, side, source) {
  const key = `${match.id}.${side}`;
  const selected = state.entrants[key] || "";
  const options = eligibleTeams(source).map((team) => `
    <option value="${escapeHtml(team)}" ${team === selected ? "selected" : ""}
      ${selectedElsewhere(key, team) || thirdGroupSelectedElsewhere(key, team) ? "disabled" : ""}>
      ${escapeHtml(team)}
    </option>
  `).join("");
  return `
    <label class="bracket-entrant">
      <span>${escapeHtml(source.label)}</span>
      <select data-entry-key="${key}" ${match.locked ? "disabled" : ""}>
        <option value="">Select team</option>
        ${options}
      </select>
    </label>
  `;
}

function participantRow(team, winner, match) {
  const selected = team && winner === team;
  return `
    <button class="bracket-team ${selected ? "selected" : ""}" type="button"
      data-match-id="${match.id}" data-team="${escapeHtml(team)}"
      ${!team || match.locked ? "disabled" : ""}>
      <span>${escapeHtml(team || "Waiting for previous winner")}</span>
      <span class="advance-mark" aria-hidden="true">${selected ? "Win" : ""}</span>
    </button>
  `;
}

function renderMatch(match, gridRow, span, finalRound = false) {
  const participants = participantsFor(match);
  const winner = state.winners[match.id] || "";
  const kickoff = match.kickoffUtc ? new Date(match.kickoffUtc).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }) : "";
  const entrantControls = match.round === "Round of 32" ? `
    <div class="bracket-entrants">
      ${entrantSelect(match, "home", match.home)}
      ${entrantSelect(match, "away", match.away)}
    </div>
  ` : "";
  return `
    <article class="bracket-match bracket-slot-${gridRow} bracket-span-${span} ${match.locked ? "locked" : ""} ${finalRound ? "final-match" : ""}">
      <header>
        <strong>${match.id}</strong>
        <span>${escapeHtml(match.round)}</span>
        ${match.locked ? `<span class="bracket-lock">Locked</span>` : ""}
      </header>
      ${entrantControls}
      <div class="bracket-teams">
        ${participantRow(participants[0], winner, match)}
        ${participantRow(participants[1], winner, match)}
      </div>
      <time>${escapeHtml(kickoff)}</time>
    </article>
  `;
}

function render() {
  reconcileWinners();
  board.innerHTML = roundLayout.map((round) => {
    let row = 1;
    const cards = round.matches.map((matchId) => {
      const match = matchById(matchId);
      const card = renderMatch(match, row, round.span, round.final);
      row += round.span;
      return card;
    }).join("");
    return `
      <section class="bracket-round ${round.final ? "bracket-finals" : ""}">
        <h2>${round.title}</h2>
        <div class="bracket-round-grid">${cards}</div>
      </section>
    `;
  }).join("");

  const winnerCount = Object.keys(state.winners).length;
  document.querySelector("#bracketProgress").textContent = `${winnerCount} of 32 winners selected`;
  document.querySelector("#bracketSavedAt").textContent = state.updatedAt
    ? `Saved ${new Date(state.updatedAt).toLocaleString()}`
    : "Not saved yet";
  const champion = state.winners.M104 || "";
  document.querySelector("#championPanel").classList.toggle("hidden", !champion);
  document.querySelector("#championName").textContent = champion;

  board.querySelectorAll("select[data-entry-key]").forEach((select) => {
    select.addEventListener("change", () => {
      if (select.value) state.entrants[select.dataset.entryKey] = select.value;
      else delete state.entrants[select.dataset.entryKey];
      message.textContent = "";
      render();
    });
  });
  board.querySelectorAll(".bracket-team[data-team]").forEach((button) => {
    button.addEventListener("click", () => {
      const current = state.winners[button.dataset.matchId];
      if (current === button.dataset.team) delete state.winners[button.dataset.matchId];
      else state.winners[button.dataset.matchId] = button.dataset.team;
      message.textContent = "";
      render();
    });
  });
}

async function loadBracket() {
  if (!token) {
    window.location.replace("login.html");
    return;
  }
  const response = await fetch("/api/bracket", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (response.status === 401) {
    localStorage.removeItem("wc_auth_token");
    window.location.replace("login.html");
    return;
  }
  if (!response.ok) throw new Error(data.error || "Unable to load your bracket.");
  state.groups = data.groups || {};
  state.matches = data.matches || [];
  state.entrants = data.picks?.entrants || {};
  state.winners = data.picks?.winners || {};
  state.updatedAt = data.picks?.updatedAt || null;
  message.textContent = "";
  render();
}

async function saveBracket() {
  try {
    saveButton.disabled = true;
    message.textContent = "Saving bracket...";
    const response = await fetch("/api/bracket", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ entrants: state.entrants, winners: state.winners })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to save your bracket.");
    state.updatedAt = data.picks.updatedAt;
    message.textContent = data.message;
    render();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    saveButton.disabled = false;
  }
}

saveButton.addEventListener("click", saveBracket);
loadBracket().catch((error) => {
  message.textContent = error.message;
});
