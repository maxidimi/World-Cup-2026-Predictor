const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const root = __dirname;
loadLocalEnv();
const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || "127.0.0.1";
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB || "world_cup_predictor";
const authSecret = process.env.AUTH_SECRET || crypto.randomBytes(32).toString("hex");
const footballDataToken = process.env.FOOTBALL_DATA_TOKEN || "";
const footballDataBaseUrl = "https://api.football-data.org/v4";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8"
};
const publicFiles = new Set([
  "index.html",
  "admin.html",
  "admin-error.html",
  "app.js",
  "login.html",
  "register.html",
  "auth.js",
  "theme.js",
  "admin.js",
  "admin-error.js",
  "forgot-password.html",
  "forgot-password.js",
  "reset-password.html",
  "reset-password.js",
  "styles.css"
]);
const authRateBuckets = new Map();
const metricsStartedAt = Date.now();
const requestMetrics = new Map();
const recentRequests = [];
const durationBuckets = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

let dbPromise;
let matchesCache;

if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET must be set when NODE_ENV=production.");
}

function loadLocalEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function getDb() {
  if (!dbPromise) {
    const client = new MongoClient(mongoUri);
    dbPromise = client.connect().then(async () => {
      const db = client.db(dbName);
      await db.collection("users").createIndex({ email: 1 }, { unique: true });
      await db.collection("predictions").createIndex({ userId: 1, matchId: 1 }, { unique: true });
      await db.collection("predictions").createIndex({ matchId: 1 });
      await db.collection("results").createIndex({ matchId: 1 }, { unique: true });
      await db.collection("matches").createIndex({ id: 1 }, { unique: true });
      await db.collection("matches").createIndex({ providerMatchId: 1 }, { sparse: true });
      await db.collection("passwordResets").createIndex({ tokenHash: 1 }, { unique: true });
      await db.collection("passwordResets").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await seedMatches(db);
      return db;
    });
  }
  return dbPromise;
}

function getSeedMatches() {
  if (!matchesCache) {
    const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
    const match = source.match(/const rawMatches = ([\s\S]*?\n\];)/);
    const rawMatches = JSON.parse(match[1].replace(/;$/, ""));
    matchesCache = rawMatches.map((item, index) => ({
      id: `M${index + 1}`,
      date: item[0],
      phase: item[1],
      home: item[2],
      away: item[3],
      stadium: item[4],
      city: item[5],
      kickoffUtc: item[6],
      kickoffLocal: item[7],
      stadiumTz: item[8]
    }));
  }
  return matchesCache;
}

async function seedMatches(db) {
  const count = await db.collection("matches").countDocuments();
  if (count > 0) return;
  const seededAt = new Date();
  const operations = getSeedMatches().map((match) => ({
    updateOne: {
      filter: { id: match.id },
      update: {
        $set: {
          ...match,
          source: "seed",
          updatedAt: seededAt
        },
        $setOnInsert: { createdAt: seededAt }
      },
      upsert: true
    }
  }));
  if (operations.length) {
    await db.collection("matches").bulkWrite(operations);
  }
}

async function getMatches() {
  const db = await getDb();
  const matches = await db.collection("matches")
    .find({ inactive: { $ne: true } }, { projection: { _id: 0 } })
    .sort({ kickoffUtc: 1, id: 1 })
    .toArray();
  return matches.length ? matches : getSeedMatches();
}

function sendJson(response, status, payload) {
  response.writeHead(status, securityHeaders({ "Content-Type": types[".json"] }));
  response.end(JSON.stringify(payload));
}

function normalizeMetricRoute(pathname) {
  if (pathname.startsWith("/api/predictions/")) return "/api/predictions/:matchId";
  if (pathname.startsWith("/api/admin/predictions/")) return "/api/admin/predictions/:predictionId";
  if (pathname.startsWith("/api/admin/results/")) return "/api/admin/results/:matchId";
  if (pathname.startsWith("/assets/")) return "/assets/:file";
  return pathname === "/" ? "/" : pathname;
}

function recordRequestMetric(method, route, status, durationSeconds) {
  const key = `${method}|${route}|${status}`;
  const metric = requestMetrics.get(key) || {
    method,
    route,
    status,
    count: 0,
    durationSum: 0,
    buckets: durationBuckets.map(() => 0)
  };
  metric.count += 1;
  metric.durationSum += durationSeconds;
  durationBuckets.forEach((bucket, index) => {
    if (durationSeconds <= bucket) metric.buckets[index] += 1;
  });
  requestMetrics.set(key, metric);
  recentRequests.push({ timestamp: Date.now(), method, route, status, durationSeconds });
  const cutoff = Date.now() - 60 * 60 * 1000;
  while (recentRequests.length && recentRequests[0].timestamp < cutoff) recentRequests.shift();
}

function instrumentResponse(request, response, pathname) {
  const startedAt = process.hrtime.bigint();
  const originalWriteHead = response.writeHead.bind(response);
  const originalEnd = response.end.bind(response);
  let statusCode = 200;
  let recorded = false;

  response.writeHead = (status, ...args) => {
    statusCode = status;
    return originalWriteHead(status, ...args);
  };
  response.end = (...args) => {
    if (!recorded) {
      recorded = true;
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      recordRequestMetric(request.method, normalizeMetricRoute(pathname), statusCode, durationSeconds);
    }
    return originalEnd(...args);
  };
}

function prometheusEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, "\\\"");
}

async function getApplicationGauges() {
  const db = await getDb();
  const [users, predictions, matches, results] = await Promise.all([
    db.collection("users").countDocuments(),
    db.collection("predictions").countDocuments(),
    db.collection("matches").countDocuments({ inactive: { $ne: true } }),
    db.collection("results").countDocuments()
  ]);
  return { users, predictions, matches, results };
}

async function buildPrometheusMetrics() {
  const gauges = await getApplicationGauges();
  const memory = process.memoryUsage();
  const lines = [
    "# HELP world_cup_app_info Application information.",
    "# TYPE world_cup_app_info gauge",
    `world_cup_app_info{version="${prometheusEscape(require("./package.json").version)}"} 1`,
    "# HELP world_cup_process_uptime_seconds Process uptime in seconds.",
    "# TYPE world_cup_process_uptime_seconds gauge",
    `world_cup_process_uptime_seconds ${process.uptime()}`,
    "# HELP world_cup_process_memory_bytes Process memory usage in bytes.",
    "# TYPE world_cup_process_memory_bytes gauge",
    `world_cup_process_memory_bytes{type="rss"} ${memory.rss}`,
    `world_cup_process_memory_bytes{type="heap_used"} ${memory.heapUsed}`,
    `world_cup_process_memory_bytes{type="heap_total"} ${memory.heapTotal}`,
    "# HELP world_cup_users_total Registered users.",
    "# TYPE world_cup_users_total gauge",
    `world_cup_users_total ${gauges.users}`,
    "# HELP world_cup_predictions_total Stored predictions.",
    "# TYPE world_cup_predictions_total gauge",
    `world_cup_predictions_total ${gauges.predictions}`,
    "# HELP world_cup_matches_total Active matches.",
    "# TYPE world_cup_matches_total gauge",
    `world_cup_matches_total ${gauges.matches}`,
    "# HELP world_cup_results_total Stored match results.",
    "# TYPE world_cup_results_total gauge",
    `world_cup_results_total ${gauges.results}`,
    "# HELP world_cup_http_requests_total HTTP requests handled.",
    "# TYPE world_cup_http_requests_total counter"
  ];

  [...requestMetrics.values()].forEach((metric) => {
    const labels = `method="${prometheusEscape(metric.method)}",route="${prometheusEscape(metric.route)}",status="${metric.status}"`;
    lines.push(`world_cup_http_requests_total{${labels}} ${metric.count}`);
  });
  lines.push(
    "# HELP world_cup_http_request_duration_seconds HTTP request duration.",
    "# TYPE world_cup_http_request_duration_seconds histogram"
  );
  [...requestMetrics.values()].forEach((metric) => {
    const labels = `method="${prometheusEscape(metric.method)}",route="${prometheusEscape(metric.route)}",status="${metric.status}"`;
    durationBuckets.forEach((bucket, index) => {
      lines.push(`world_cup_http_request_duration_seconds_bucket{${labels},le="${bucket}"} ${metric.buckets[index]}`);
    });
    lines.push(`world_cup_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${metric.count}`);
    lines.push(`world_cup_http_request_duration_seconds_sum{${labels}} ${metric.durationSum}`);
    lines.push(`world_cup_http_request_duration_seconds_count{${labels}} ${metric.count}`);
  });
  return `${lines.join("\n")}\n`;
}

function percentile(values, percent) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((percent / 100) * sorted.length) - 1)];
}

async function buildAdminMetrics() {
  const gauges = await getApplicationGauges();
  const memory = process.memoryUsage();
  const now = Date.now();
  const lastFiveMinutes = recentRequests.filter((item) => item.timestamp >= now - 5 * 60 * 1000);
  const durations = lastFiveMinutes.map((item) => item.durationSeconds * 1000);
  const statusCounts = {};
  const routeCounts = {};
  lastFiveMinutes.forEach((item) => {
    const statusGroup = `${Math.floor(item.status / 100)}xx`;
    statusCounts[statusGroup] = (statusCounts[statusGroup] || 0) + 1;
    routeCounts[item.route] = (routeCounts[item.route] || 0) + 1;
  });
  const timeline = Array.from({ length: 15 }, (_, index) => {
    const start = now - (14 - index) * 60 * 1000;
    const end = start + 60 * 1000;
    const bucket = recentRequests.filter((item) => item.timestamp >= start && item.timestamp < end);
    return {
      time: new Date(start).toISOString(),
      requests: bucket.length,
      errors: bucket.filter((item) => item.status >= 500).length
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    uptimeSeconds: Math.floor((now - metricsStartedAt) / 1000),
    memory: { rss: memory.rss, heapUsed: memory.heapUsed, heapTotal: memory.heapTotal },
    app: gauges,
    requests: {
      lastFiveMinutes: lastFiveMinutes.length,
      perMinute: Number((lastFiveMinutes.length / 5).toFixed(1)),
      errorRate: lastFiveMinutes.length
        ? Number(((lastFiveMinutes.filter((item) => item.status >= 500).length / lastFiveMinutes.length) * 100).toFixed(1))
        : 0,
      p50Ms: Number(percentile(durations, 50).toFixed(1)),
      p95Ms: Number(percentile(durations, 95).toFixed(1)),
      statuses: statusCounts,
      routes: Object.entries(routeCounts)
        .map(([route, count]) => ({ route, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      timeline
    }
  };
}

function securityHeaders(extra = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    ...extra
  };
}

function rateLimit(request, response, bucketName, limit, windowMs) {
  const key = `${bucketName}:${request.socket.remoteAddress || "unknown"}`;
  const now = Date.now();
  const bucket = authRateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  authRateBuckets.set(key, bucket);
  if (bucket.count > limit) {
    response.writeHead(429, securityHeaders({
      "Content-Type": types[".json"],
      "Retry-After": String(Math.ceil((bucket.resetAt - now) / 1000))
    }));
    response.end(JSON.stringify({ error: "Too many attempts. Try again shortly." }));
    return false;
  }
  return true;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isCompatibleEmail(email) {
  const pattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
  if (email.length > 254 || /\s/.test(email)) return false;
  const [local, domain] = email.split("@");
  if (!local || !domain || local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  return pattern.test(email);
}

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    isAdmin: Boolean(user.isAdmin)
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.passwordHash, "hex"));
}

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({
    sub: String(user._id),
    email: user.email,
    name: user.name,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", authSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  try {
    if (!token || !token.includes(".")) return null;
    const [payload, signature] = token.split(".");
    const expected = crypto.createHmac("sha256", authSecret).update(payload).digest("base64url");
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

function getBearerToken(request) {
  const header = request.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

async function getAuthenticatedUser(request) {
  const token = verifyToken(getBearerToken(request));
  if (!token) return null;
  const db = await getDb();
  return db.collection("users").findOne({ _id: new ObjectId(token.sub) });
}

async function requireAdmin(request, response) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    sendJson(response, 401, { error: "Log in as the admin user to continue." });
    return null;
  }
  if (!user.isAdmin) {
    sendJson(response, 403, { error: "Admin access requires the isAdmin flag in the database." });
    return null;
  }
  return user;
}

function parseScore(value) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 && score <= 30 ? score : null;
}

function hasMatchStarted(match) {
  return Date.now() >= new Date(match.kickoffUtc).getTime();
}

function outcome(home, away) {
  if (home > away) return "1";
  if (home === away) return "x";
  return "2";
}

function normalizeTeamName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\busa\b/g, "united states")
    .replace(/\bcote d ivoire\b/g, "ivory coast")
    .replace(/\bturkey\b/g, "turkiye")
    .replace(/\bczech republic\b/g, "czechia")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameTeam(localName, apiName) {
  return normalizeTeamName(localName) === normalizeTeamName(apiName);
}

function providerMatchToStoredMatch(apiMatch) {
  const apiDate = String(apiMatch.utcDate || "").slice(0, 10);
  const home = apiMatch.homeTeam?.name || apiMatch.homeTeam?.shortName || apiMatch.homeTeam?.tla;
  const away = apiMatch.awayTeam?.name || apiMatch.awayTeam?.shortName || apiMatch.awayTeam?.tla;
  const kickoffUtc = apiMatch.utcDate || (apiDate ? `${apiDate}T00:00:00.000Z` : null);
  const stage = String(apiMatch.stage || "").replace(/_/g, " ").toLowerCase();
  const phase = apiMatch.group || (stage ? stage.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "API match");
  return {
    id: `FD${apiMatch.id}`,
    date: apiDate,
    phase,
    home: home || "TBD",
    away: away || "TBD",
    stadium: apiMatch.venue || "TBD",
    city: "",
    kickoffUtc,
    kickoffLocal: kickoffUtc ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date(kickoffUtc)) : "",
    stadiumTz: "UTC",
    provider: "football-data.org",
    providerMatchId: apiMatch.id,
    providerStatus: apiMatch.status,
    source: "api"
  };
}

function findLocalMatchForApiMatch(apiMatch, localMatches) {
  const apiDate = String(apiMatch.utcDate || "").slice(0, 10);
  const home = apiMatch.homeTeam?.name || apiMatch.homeTeam?.shortName || apiMatch.homeTeam?.tla;
  const away = apiMatch.awayTeam?.name || apiMatch.awayTeam?.shortName || apiMatch.awayTeam?.tla;
  if (!apiDate || !home || !away) return null;
  return localMatches.find((match) => (
    match.date === apiDate &&
    sameTeam(match.home, home) &&
    sameTeam(match.away, away)
  ));
}

async function fetchFootballDataMatches() {
  if (!footballDataToken) {
    throw new Error("FOOTBALL_DATA_TOKEN is not set on the server.");
  }
  const url = new URL(`${footballDataBaseUrl}/competitions/WC/matches`);
  url.searchParams.set("dateFrom", "2026-06-11");
  url.searchParams.set("dateTo", "2026-07-19");
  const response = await fetch(url, {
    headers: { "X-Auth-Token": footballDataToken }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `football-data.org returned ${response.status}.`);
  }
  return data.matches || [];
}

async function syncFootballDataResults({ skipMissingToken = false } = {}) {
  if (!footballDataToken && skipMissingToken) {
    return {
      provider: "football-data.org",
      received: 0,
      matchRecordsUpdated: 0,
      finished: 0,
      matched: 0,
      updated: 0,
      skipped: ["FOOTBALL_DATA_TOKEN is not set on the server."]
    };
  }
  const db = await getDb();
  const apiMatches = await fetchFootballDataMatches();
  const storedMatches = await getMatches();
  const now = new Date();
  const summary = {
    provider: "football-data.org",
    received: apiMatches.length,
    matchRecordsUpdated: 0,
    finished: 0,
    matched: 0,
    updated: 0,
    skipped: []
  };

  for (const apiMatch of apiMatches) {
    const localMatch = findLocalMatchForApiMatch(apiMatch, storedMatches);
    const apiStoredMatch = providerMatchToStoredMatch(apiMatch);
    const matchRecord = localMatch ? { ...localMatch, ...apiStoredMatch, id: localMatch.id, source: "seed+api" } : apiStoredMatch;
    const { createdAt, _id, ...matchUpdate } = matchRecord;
    if (localMatch) summary.matched += 1;
    await db.collection("matches").updateOne(
      { id: matchRecord.id },
      {
        $set: {
          ...matchUpdate,
          inactive: false,
          syncedAt: now,
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );
    summary.matchRecordsUpdated += 1;

    if (apiMatch.status !== "FINISHED") continue;
    const fullTime = apiMatch.score?.fullTime || {};
    const home = parseScore(fullTime.home);
    const away = parseScore(fullTime.away);
    if (home === null || away === null) continue;
    summary.finished += 1;
    if (!matchRecord) continue;
    await db.collection("results").updateOne(
      { matchId: matchRecord.id },
      {
        $set: {
          matchId: matchRecord.id,
          home,
          away,
          provider: "football-data.org",
          providerMatchId: apiMatch.id,
          providerStatus: apiMatch.status,
          syncedAt: now,
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );
    summary.updated += 1;
  }

  if (apiMatches.length) {
    await db.collection("matches").updateMany(
      { source: "seed" },
      { $set: { inactive: true, updatedAt: now } }
    );
  }

  return summary;
}

function emptyAccuracy() {
  return {
    graded: 0,
    exactScoreHits: 0,
    resultHits: 0,
    exactScorePercent: 0,
    resultPercent: 0
  };
}

function finalizeAccuracy(accuracy) {
  return {
    ...accuracy,
    exactScorePercent: accuracy.graded ? Number(((accuracy.exactScoreHits / accuracy.graded) * 100).toFixed(1)) : 0,
    resultPercent: accuracy.graded ? Number(((accuracy.resultHits / accuracy.graded) * 100).toFixed(1)) : 0
  };
}

async function buildAdminOverview() {
  const db = await getDb();
  try {
    await syncFootballDataResults({ skipMissingToken: true });
  } catch {
    // Admin stats should remain available even when the external score API is down.
  }
  const matches = await getMatches();
  const users = await db.collection("users")
    .find({}, { projection: { passwordHash: 0, passwordSalt: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
  const predictions = await db.collection("predictions").find({}).sort({ updatedAt: -1 }).toArray();
  const results = await db.collection("results").find({}).toArray();
  const userMap = new Map(users.map((user) => [String(user._id), publicUser(user)]));
  const matchMap = new Map(matches.map((match) => [match.id, match]));
  const resultMap = new Map(results.map((result) => [result.matchId, result]));
  const userAccuracyMap = new Map(users.map((user) => [String(user._id), emptyAccuracy()]));
  const statsMap = new Map(matches.map((match) => [match.id, {
    match,
    result: resultMap.get(match.id) ? {
      home: resultMap.get(match.id).home,
      away: resultMap.get(match.id).away,
      updatedAt: resultMap.get(match.id).updatedAt
    } : null,
    predictionCount: 0,
    homeWinVotes: 0,
    drawVotes: 0,
    awayWinVotes: 0,
    totalHomeGoals: 0,
    totalAwayGoals: 0
  }]));

  const enrichedPredictions = predictions.map((prediction) => {
    const user = userMap.get(String(prediction.userId)) || { id: String(prediction.userId), name: "Deleted user", email: "" };
    const match = matchMap.get(prediction.matchId);
    const result = resultMap.get(prediction.matchId);
    const stat = statsMap.get(prediction.matchId);
    if (stat) {
      stat.predictionCount += 1;
      stat.totalHomeGoals += prediction.home;
      stat.totalAwayGoals += prediction.away;
      if (prediction.home > prediction.away) stat.homeWinVotes += 1;
      else if (prediction.home === prediction.away) stat.drawVotes += 1;
      else stat.awayWinVotes += 1;
    }
    if (result) {
      const accuracy = userAccuracyMap.get(String(prediction.userId));
      if (accuracy) {
        accuracy.graded += 1;
        if (prediction.home === result.home && prediction.away === result.away) accuracy.exactScoreHits += 1;
        if (outcome(prediction.home, prediction.away) === outcome(result.home, result.away)) accuracy.resultHits += 1;
      }
    }
    return {
      id: String(prediction._id),
      user,
      match,
      result: result ? { home: result.home, away: result.away, updatedAt: result.updatedAt } : null,
      matchId: prediction.matchId,
      home: prediction.home,
      away: prediction.away,
      updatedAt: prediction.updatedAt
    };
  });

  const stats = [...statsMap.values()].map((stat) => ({
    ...stat,
    averageHomeGoals: stat.predictionCount ? Number((stat.totalHomeGoals / stat.predictionCount).toFixed(2)) : 0,
    averageAwayGoals: stat.predictionCount ? Number((stat.totalAwayGoals / stat.predictionCount).toFixed(2)) : 0
  }));

  return {
    users: users.map((user) => ({
      ...publicUser(user),
      predictionCount: predictions.filter((prediction) => String(prediction.userId) === String(user._id)).length,
      accuracy: finalizeAccuracy(userAccuracyMap.get(String(user._id)) || emptyAccuracy())
    })),
    predictions: enrichedPredictions,
    results: results.map((result) => ({
      id: String(result._id),
      matchId: result.matchId,
      match: matchMap.get(result.matchId),
      home: result.home,
      away: result.away,
      updatedAt: result.updatedAt
    })),
    stats,
    totals: {
      users: users.length,
      predictions: predictions.length,
      matchesWithVotes: stats.filter((stat) => stat.predictionCount > 0).length,
      completedResults: results.length
    }
  };
}

async function handleApi(request, response, url) {
  try {
    if (request.method === "GET" && url.pathname === "/api/matches") {
      let sync = null;
      try {
        sync = await syncFootballDataResults({ skipMissingToken: true });
      } catch (error) {
        sync = {
          provider: "football-data.org",
          received: 0,
          matchRecordsUpdated: 0,
          finished: 0,
          matched: 0,
          updated: 0,
          skipped: [error.message || "Unable to refresh football-data.org matches."]
        };
      }
      sendJson(response, 200, { matches: await getMatches(), sync });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/register") {
      if (!rateLimit(request, response, "register", 12, 15 * 60 * 1000)) return;
      const body = await readBody(request);
      const name = String(body.name || "").trim();
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      if (!name || !isCompatibleEmail(email) || password.length < 8) {
        sendJson(response, 400, { error: "Name, valid email, and an 8+ character password are required." });
        return;
      }

      const { salt, hash } = hashPassword(password);
      const db = await getDb();
      const user = {
        name,
        email,
        passwordSalt: salt,
        passwordHash: hash,
        isAdmin: false,
        createdAt: new Date()
      };
      const result = await db.collection("users").insertOne(user);
      user._id = result.insertedId;
      sendJson(response, 201, { user: publicUser(user), token: signToken(user) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/login") {
      if (!rateLimit(request, response, "login", 20, 15 * 60 * 1000)) return;
      const body = await readBody(request);
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      if (!isCompatibleEmail(email)) {
        sendJson(response, 400, { error: "Use a compatible email address, like name@example.com." });
        return;
      }
      const db = await getDb();
      const user = await db.collection("users").findOne({ email });
      if (!user || !verifyPassword(password, user)) {
        sendJson(response, 401, { error: "Email or password is incorrect." });
        return;
      }
      sendJson(response, 200, { user: publicUser(user), token: signToken(user) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/password-reset/request") {
      if (!rateLimit(request, response, "password-reset-request", 8, 15 * 60 * 1000)) return;
      const body = await readBody(request);
      const email = normalizeEmail(body.email);
      const responsePayload = {
        message: "If this email exists, a reset link was created for local use."
      };
      if (!isCompatibleEmail(email)) {
        sendJson(response, 200, responsePayload);
        return;
      }
      const db = await getDb();
      const user = await db.collection("users").findOne({ email });
      if (!user) {
        sendJson(response, 200, responsePayload);
        return;
      }
      const token = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await db.collection("passwordResets").updateMany(
        { userId: user._id, usedAt: { $exists: false } },
        { $set: { usedAt: new Date(), superseded: true } }
      );
      await db.collection("passwordResets").insertOne({
        userId: user._id,
        tokenHash: hashToken(token),
        expiresAt,
        createdAt: new Date()
      });
      sendJson(response, 200, {
        ...responsePayload,
        resetUrl: `/reset-password.html?token=${encodeURIComponent(token)}`,
        expiresAt
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/password-reset/confirm") {
      if (!rateLimit(request, response, "password-reset-confirm", 12, 15 * 60 * 1000)) return;
      const body = await readBody(request);
      const token = String(body.token || "");
      const password = String(body.password || "");
      if (!token || password.length < 8) {
        sendJson(response, 400, { error: "A valid reset token and an 8+ character password are required." });
        return;
      }
      const db = await getDb();
      const reset = await db.collection("passwordResets").findOne({
        tokenHash: hashToken(token),
        usedAt: { $exists: false },
        expiresAt: { $gt: new Date() }
      });
      if (!reset) {
        sendJson(response, 400, { error: "Reset link is invalid or expired." });
        return;
      }
      const { salt, hash } = hashPassword(password);
      await db.collection("users").updateOne(
        { _id: reset.userId },
        { $set: { passwordSalt: salt, passwordHash: hash, updatedAt: new Date() } }
      );
      await db.collection("passwordResets").updateOne(
        { _id: reset._id },
        { $set: { usedAt: new Date() } }
      );
      sendJson(response, 200, { message: "Password updated. You can now log in." });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/session") {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        sendJson(response, 401, { error: "Not signed in." });
        return;
      }
      sendJson(response, 200, { user: publicUser(user) });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/predictions") {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        sendJson(response, 401, { error: "Not signed in." });
        return;
      }
      const db = await getDb();
      const predictions = await db.collection("predictions").find({ userId: user._id }).toArray();
      const byMatch = {};
      predictions.forEach((prediction) => {
        byMatch[prediction.matchId] = {
          home: prediction.home,
          away: prediction.away,
          savedAt: prediction.updatedAt
        };
      });
      sendJson(response, 200, { predictions: byMatch });
      return;
    }

    if (request.method === "PUT" && url.pathname.startsWith("/api/predictions/")) {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        sendJson(response, 401, { error: "Not signed in." });
        return;
      }
      const matchId = url.pathname.split("/").pop();
      const match = (await getMatches()).find((item) => item.id === matchId);
      if (!match) {
        sendJson(response, 404, { error: "Match not found." });
        return;
      }
      if (hasMatchStarted(match)) {
        sendJson(response, 403, { error: "Predictions are locked after kickoff." });
        return;
      }
      const body = await readBody(request);
      const home = parseScore(body.home);
      const away = parseScore(body.away);
      if (home === null || away === null) {
        sendJson(response, 400, { error: "Scores must be whole numbers from 0 to 30." });
        return;
      }
      const db = await getDb();
      await db.collection("predictions").updateOne(
        { userId: user._id, matchId },
        { $set: { userId: user._id, matchId, home, away, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      );
      sendJson(response, 200, { prediction: { matchId, home, away } });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/overview") {
      if (!await requireAdmin(request, response)) return;
      sendJson(response, 200, await buildAdminOverview());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/metrics") {
      if (!await requireAdmin(request, response)) return;
      sendJson(response, 200, await buildAdminMetrics());
      return;
    }

    if (request.method === "PUT" && url.pathname.startsWith("/api/admin/predictions/")) {
      if (!await requireAdmin(request, response)) return;
      const predictionId = url.pathname.split("/").pop();
      const body = await readBody(request);
      const home = parseScore(body.home);
      const away = parseScore(body.away);
      if (home === null || away === null) {
        sendJson(response, 400, { error: "Scores must be whole numbers from 0 to 30." });
        return;
      }
      const db = await getDb();
      const result = await db.collection("predictions").findOneAndUpdate(
        { _id: new ObjectId(predictionId) },
        { $set: { home, away, updatedAt: new Date(), editedByAdmin: true } },
        { returnDocument: "after" }
      );
      if (!result) {
        sendJson(response, 404, { error: "Prediction not found." });
        return;
      }
      sendJson(response, 200, { prediction: result });
      return;
    }

    if (request.method === "PUT" && url.pathname.startsWith("/api/admin/results/")) {
      if (!await requireAdmin(request, response)) return;
      const matchId = url.pathname.split("/").pop();
      if (!(await getMatches()).some((match) => match.id === matchId)) {
        sendJson(response, 404, { error: "Match not found." });
        return;
      }
      const body = await readBody(request);
      const home = parseScore(body.home);
      const away = parseScore(body.away);
      if (home === null || away === null) {
        sendJson(response, 400, { error: "Scores must be whole numbers from 0 to 30." });
        return;
      }
      const db = await getDb();
      const result = await db.collection("results").findOneAndUpdate(
        { matchId },
        { $set: { matchId, home, away, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true, returnDocument: "after" }
      );
      sendJson(response, 200, { result });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/admin/sync-results") {
      if (!await requireAdmin(request, response)) return;
      const summary = await syncFootballDataResults();
      sendJson(response, 200, { summary });
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    if (error.code === 11000) {
      sendJson(response, 409, { error: "That email is already registered. Switch to login." });
      return;
    }
    let message = "Server error.";
    if (error.message && error.message.includes("ECONNREFUSED")) {
      message = "MongoDB is not running at mongodb://127.0.0.1:27017.";
    } else if (error.message && (error.message.includes("FOOTBALL_DATA_TOKEN") || error.message.includes("football-data.org"))) {
      message = error.message;
    }
    sendJson(response, 500, { error: message });
  }
}

http.createServer((request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);
  instrumentResponse(request, response, url.pathname);

  if (request.method === "GET" && url.pathname === "/metrics") {
    buildPrometheusMetrics()
      .then((metrics) => {
        response.writeHead(200, securityHeaders({
          "Content-Type": "text/plain; version=0.0.4; charset=utf-8"
        }));
        response.end(metrics);
      })
      .catch(() => {
        response.writeHead(503, securityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
        response.end("Metrics unavailable\n");
      });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    handleApi(request, response, url);
    return;
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, securityHeaders({ "Allow": "GET, HEAD" }));
    response.end();
    return;
  }

  let relativePath = decodeURIComponent(url.pathname);
  if (relativePath === "/") relativePath = "/index.html";
  relativePath = relativePath.replace(/^\/+/, "").replace(/\//g, path.sep);
  const normalized = path.normalize(relativePath);
  const isAsset = normalized.startsWith(`assets${path.sep}`) && [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(path.extname(normalized).toLowerCase());
  const isPublicFile = publicFiles.has(normalized);
  if (normalized.includes("..") || normalized.startsWith(".") || (!isPublicFile && !isAsset)) {
    response.writeHead(404, securityHeaders());
    response.end("Not found");
    return;
  }

  const filePath = path.join(root, normalized);

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, securityHeaders());
      response.end("Not found");
      return;
    }
    response.writeHead(200, securityHeaders({ "Content-Type": types[path.extname(filePath)] || "application/octet-stream" }));
    response.end(data);
  });
}).listen(port, host, () => {
  console.log(`World Cup Predictor running at http://${host}:${port}/`);
});
