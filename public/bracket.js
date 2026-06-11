const token = localStorage.getItem("wc_auth_token") || "";
const board = document.querySelector("#bracketBoard");
const message = document.querySelector("#bracketMessage");
const saveButton = document.querySelector("#saveBracketBtn");
const groupGrid = document.querySelector("#groupPredictionGrid");
const state = {
  view: "groups",
  groups: {},
  groupLocks: {},
  thirdPlaceLocked: false,
  groupRankings: {},
  thirdPlaceGroups: [],
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

function thirdPlaceSlots() {
  return state.matches
    .filter((match) => match.round === "Round of 32")
    .flatMap((match) => [["home", match.home], ["away", match.away]]
      .filter(([, source]) => source.type === "third")
      .map(([side, source]) => ({ key: `${match.id}.${side}`, groups: source.groups })));
}

function assignThirdPlaceGroups(selectedGroups) {
  const slots = thirdPlaceSlots();
  const orderedGroups = [...selectedGroups].sort((left, right) => {
    const leftOptions = slots.filter((slot) => slot.groups.includes(left)).length;
    const rightOptions = slots.filter((slot) => slot.groups.includes(right)).length;
    return leftOptions - rightOptions || left.localeCompare(right);
  });
  const assignment = {};
  const usedSlots = new Set();

  function assign(index) {
    if (index === orderedGroups.length) return true;
    const group = orderedGroups[index];
    const candidates = slots
      .filter((slot) => slot.groups.includes(group) && !usedSlots.has(slot.key))
      .sort((left, right) => left.key.localeCompare(right.key));
    for (const slot of candidates) {
      assignment[slot.key] = group;
      usedSlots.add(slot.key);
      if (assign(index + 1)) return true;
      usedSlots.delete(slot.key);
      delete assignment[slot.key];
    }
    return false;
  }

  return assign(0) ? assignment : null;
}

function deriveEntrants() {
  const entrants = {};
  state.matches.filter((match) => match.round === "Round of 32").forEach((match) => {
    [["home", match.home], ["away", match.away]].forEach(([side, source]) => {
      if (source.type === "group") {
        entrants[`${match.id}.${side}`] = state.groupRankings[source.group]?.[source.position - 1] || "";
      }
    });
  });
  const thirdAssignments = assignThirdPlaceGroups(state.thirdPlaceGroups) || {};
  Object.entries(thirdAssignments).forEach(([key, group]) => {
    entrants[key] = state.groupRankings[group]?.[2] || "";
  });
  state.entrants = entrants;
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

function entrantDisplay(match, side, source) {
  const key = `${match.id}.${side}`;
  const selected = state.entrants[key] || "";
  return `
    <div class="bracket-entrant">
      <span title="${escapeHtml(source.label)}">${escapeHtml(source.label)}</span>
      <strong>${escapeHtml(selected || "Waiting for group prediction")}</strong>
    </div>
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
      ${entrantDisplay(match, "home", match.home)}
      ${entrantDisplay(match, "away", match.away)}
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
  deriveEntrants();
  reconcileWinners();
  renderGroups();
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
  renderView();

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

function renderView() {
  const groupView = state.view === "groups";
  document.querySelector("#groupStageView").classList.toggle("hidden", !groupView);
  document.querySelector("#knockoutView").classList.toggle("hidden", groupView);
  document.querySelectorAll(".bracket-view-tab").forEach((button) => {
    const active = button.dataset.bracketView === state.view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function renderGroups() {
  const positionLabels = ["1st", "2nd", "3rd", "4th"];
  groupGrid.innerHTML = Object.keys(state.groups).sort().map((group) => {
    const ranking = state.groupRankings[group] || [...state.groups[group]];
    const locked = Boolean(state.groupLocks[group]);
    return `
      <article class="group-prediction-card ${locked ? "locked" : ""}">
        <header>
          <h3>Group ${group}</h3>
          ${locked ? `<span>Locked</span>` : ""}
        </header>
        <div class="group-ranking">
          ${ranking.map((selected, index) => `
            <label>
              <span>${positionLabels[index]}</span>
              <select data-group="${group}" data-position="${index}" ${locked ? "disabled" : ""}>
                ${state.groups[group].map((team) => `
                  <option value="${escapeHtml(team)}" ${team === selected ? "selected" : ""}>${escapeHtml(team)}</option>
                `).join("")}
              </select>
            </label>
          `).join("")}
        </div>
        <label class="third-place-choice">
          <input type="checkbox" data-third-group="${group}"
            ${state.thirdPlaceGroups.includes(group) ? "checked" : ""}
            ${state.thirdPlaceLocked ? "disabled" : ""}>
          <span>${escapeHtml(ranking[2])} advances as a best third-place team</span>
        </label>
      </article>
    `;
  }).join("");
  document.querySelector("#thirdPlaceProgress").textContent =
    `${state.thirdPlaceGroups.length} of 8 third-place qualifiers`;

  groupGrid.querySelectorAll("select[data-group]").forEach((select) => {
    select.addEventListener("change", () => {
      const group = select.dataset.group;
      const position = Number(select.dataset.position);
      const ranking = state.groupRankings[group];
      const previousPosition = ranking.indexOf(select.value);
      [ranking[position], ranking[previousPosition]] = [ranking[previousPosition], ranking[position]];
      message.textContent = "";
      render();
    });
  });
  groupGrid.querySelectorAll("input[data-third-group]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const group = checkbox.dataset.thirdGroup;
      const previous = [...state.thirdPlaceGroups];
      if (checkbox.checked) {
        if (state.thirdPlaceGroups.length >= 8) {
          message.textContent = "Only eight third-place teams can qualify.";
          render();
          return;
        }
        state.thirdPlaceGroups.push(group);
      } else {
        state.thirdPlaceGroups = state.thirdPlaceGroups.filter((item) => item !== group);
      }
      if (!assignThirdPlaceGroups(state.thirdPlaceGroups)) {
        state.thirdPlaceGroups = previous;
        message.textContent = "That combination cannot produce valid Round-of-32 crossings.";
      } else {
        message.textContent = "";
      }
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
  state.groupLocks = data.groupLocks || {};
  state.thirdPlaceLocked = Boolean(data.thirdPlaceLocked);
  state.matches = data.matches || [];
  state.groupRankings = data.picks?.groupRankings || {};
  state.thirdPlaceGroups = data.picks?.thirdPlaceGroups || [];
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
      body: JSON.stringify({
        groupRankings: state.groupRankings,
        thirdPlaceGroups: state.thirdPlaceGroups,
        winners: state.winners
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to save your bracket.");
    state.groupRankings = data.picks.groupRankings;
    state.thirdPlaceGroups = data.picks.thirdPlaceGroups;
    state.entrants = data.picks.entrants;
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
document.querySelectorAll(".bracket-view-tab").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.bracketView;
    renderView();
  });
});
loadBracket().catch((error) => {
  message.textContent = error.message;
});
