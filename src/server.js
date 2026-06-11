const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const projectRoot = path.resolve(__dirname, "..");
const publicRoot = path.join(projectRoot, "public");
loadLocalEnv();
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || (isProduction ? "0.0.0.0" : "127.0.0.1");
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB || "world_cup_predictor";
const authSecret = process.env.AUTH_SECRET || crypto.randomBytes(32).toString("hex");
const footballDataToken = process.env.FOOTBALL_DATA_TOKEN || "";
const matchSyncIntervalMs = Math.max(1, Number(process.env.MATCH_SYNC_INTERVAL_MINUTES || 5)) * 60 * 1000;
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
  "leaderboard.html",
  "leaderboard.js",
  "bracket.html",
  "bracket.js",
  "profile.html",
  "profile.js",
  "teams.html",
  "teams.js",
  "nav-session.js",
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
let mongoClient;
let matchSyncPromise;
let lastMatchSyncAt = 0;
let lastMatchSyncAttemptAt = 0;
let cachedMatches = [];

if (isProduction && !process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET must be set when NODE_ENV=production.");
}
if (isProduction && !process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI must be set when NODE_ENV=production.");
}

function loadLocalEnv() {
  const envPath = path.join(projectRoot, ".env");
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
    mongoClient = new MongoClient(mongoUri, {
      appName: "world-cup-predictor",
      serverSelectionTimeoutMS: 10000
    });
    dbPromise = mongoClient.connect().then(async () => {
      const db = mongoClient.db(dbName);
      await db.collection("users").createIndex({ email: 1 }, { unique: true });
      await db.collection("users").createIndex({ nicknameKey: 1 }, { unique: true, sparse: true });
      await db.collection("users").createIndex({ createdAt: -1 });
      await ensureUserNicknames(db);
      await db.collection("predictions").createIndex({ userId: 1, matchId: 1 }, { unique: true });
      await db.collection("predictions").createIndex({ matchId: 1 });
      await db.collection("predictions").createIndex({ updatedAt: -1 });
      await db.collection("results").createIndex({ matchId: 1 }, { unique: true });
      await db.collection("matches").createIndex({ id: 1 }, { unique: true });
      await db.collection("matches").createIndex({ providerMatchId: 1 }, { sparse: true });
      await db.collection("matches").createIndex({ kickoffUtc: 1, id: 1 });
      await db.collection("passwordResets").createIndex({ tokenHash: 1 }, { unique: true });
      await db.collection("passwordResets").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await db.collection("teams").createIndex({ inviteCode: 1 }, { unique: true });
      await db.collection("teams").createIndex({ members: 1 });
      await db.collection("teams").createIndex({ createdAt: -1 });
      await db.collection("brackets").createIndex({ userId: 1 }, { unique: true });
      return db;
    }).catch(async (error) => {
      dbPromise = undefined;
      await mongoClient?.close().catch(() => {});
      mongoClient = undefined;
      throw error;
    });
  }
  return dbPromise;
}

function isMongoThrottle(error) {
  return error?.code === 16500 || /TooManyRequests|Request rate is large/i.test(error?.message || "");
}

function mongoRetryDelay(error, attempt) {
  const retryAfter = Number(
    error?.errorResponse?.RetryAfterMs ||
    error?.retryAfterMs ||
    String(error?.message || "").match(/RetryAfterMs[=:](\d+)/i)?.[1] ||
    100
  );
  return Math.max(100, retryAfter) * (attempt + 1);
}

async function withMongoRetry(operation, attempts = 4) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isMongoThrottle(error) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, mongoRetryDelay(error, attempt)));
    }
  }
  return undefined;
}

async function getMatches() {
  const db = await getDb();
  try {
    const matches = await withMongoRetry(() => db.collection("matches")
      .find({ inactive: { $ne: true } }, { projection: { _id: 0 } })
      .sort({ kickoffUtc: 1, id: 1 })
      .toArray());
    cachedMatches = matches;
    return matches;
  } catch (error) {
    if (isMongoThrottle(error) && cachedMatches.length > 0) {
      console.warn("Cosmos DB throttled a fixture read; serving the in-memory fixture cache.");
      return cachedMatches;
    }
    throw error;
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, securityHeaders({ "Content-Type": types[".json"] }));
  response.end(JSON.stringify(payload));
}

function normalizeMetricRoute(pathname) {
  if (pathname.startsWith("/api/predictions/")) return "/api/predictions/:matchId";
  if (pathname.startsWith("/api/admin/predictions/")) return "/api/admin/predictions/:predictionId";
  if (pathname.startsWith("/api/admin/results/")) return "/api/admin/results/:matchId";
  if (/^\/api\/admin\/teams\/[^/]+\/members\/[^/]+$/.test(pathname)) return "/api/admin/teams/:teamId/members/:memberId";
  if (/^\/api\/admin\/teams\/[^/]+$/.test(pathname)) return "/api/admin/teams/:teamId";
  if (/^\/api\/teams\/[^/]+\/leaderboard$/.test(pathname)) return "/api/teams/:teamId/leaderboard";
  if (/^\/api\/teams\/[^/]+$/.test(pathname)) return "/api/teams/:teamId";
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
    `world_cup_app_info{version="${prometheusEscape(require("../package.json").version)}"} 1`,
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
  const forwardedFor = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const clientAddress = forwardedFor || request.socket.remoteAddress || "unknown";
  const key = `${bucketName}:${clientAddress}`;
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

function normalizeNickname(nickname) {
  return String(nickname || "").trim();
}

function nicknameKey(nickname) {
  return normalizeNickname(nickname).toLowerCase();
}

function isCompatibleNickname(nickname) {
  return /^[a-z0-9_]{3,20}$/i.test(normalizeNickname(nickname));
}

function nicknameBase(user) {
  const source = String(user.nickname || user.name || user.email?.split("@")[0] || "player")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return source.length >= 3 ? source : "player";
}

async function ensureUserNicknames(db) {
  const users = db.collection("users");
  const usedKeys = new Set((await users.distinct("nicknameKey")).filter(Boolean));
  const missing = await users.find({
    $or: [
      { nickname: { $exists: false } },
      { nicknameKey: { $exists: false } }
    ]
  }).toArray();

  for (const user of missing) {
    const base = nicknameBase(user);
    let nickname = base;
    let suffix = 2;
    while (usedKeys.has(nicknameKey(nickname))) {
      const suffixText = String(suffix);
      nickname = `${base.slice(0, 20 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }
    usedKeys.add(nicknameKey(nickname));
    await users.updateOne(
      { _id: user._id },
      { $set: { nickname, nicknameKey: nicknameKey(nickname), updatedAt: new Date() } }
    );
  }
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
    nickname: user.nickname,
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

function encryptResetToken(token) {
  const key = crypto.createHash("sha256").update(authSecret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    encryptedToken: encrypted.toString("base64url"),
    tokenIv: iv.toString("base64url"),
    tokenTag: cipher.getAuthTag().toString("base64url")
  };
}

function decryptResetToken(reset) {
  try {
    if (!reset.encryptedToken || !reset.tokenIv || !reset.tokenTag) return "";
    const key = crypto.createHash("sha256").update(authSecret).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(reset.tokenIv, "base64url"));
    decipher.setAuthTag(Buffer.from(reset.tokenTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(reset.encryptedToken, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return "";
  }
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
    nickname: user.nickname,
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
    sendJson(response, 403, { error: "You do not have permission to access this area." });
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

function predictionPoints(prediction, result) {
  if (prediction.home === result.home && prediction.away === result.away) return 3;
  return outcome(prediction.home, prediction.away) === outcome(result.home, result.away) ? 1 : 0;
}

const bracketMatches = [
  { id: "M73", round: "Round of 32", home: { type: "group", group: "A", position: 2 }, away: { type: "group", group: "B", position: 2 } },
  { id: "M74", round: "Round of 32", home: { type: "group", group: "E", position: 1 }, away: { type: "third", groups: ["A", "B", "C", "D", "F"] } },
  { id: "M75", round: "Round of 32", home: { type: "group", group: "F", position: 1 }, away: { type: "group", group: "C", position: 2 } },
  { id: "M76", round: "Round of 32", home: { type: "group", group: "C", position: 1 }, away: { type: "group", group: "F", position: 2 } },
  { id: "M77", round: "Round of 32", home: { type: "group", group: "I", position: 1 }, away: { type: "third", groups: ["C", "D", "F", "G", "H"] } },
  { id: "M78", round: "Round of 32", home: { type: "group", group: "E", position: 2 }, away: { type: "group", group: "I", position: 2 } },
  { id: "M79", round: "Round of 32", home: { type: "group", group: "A", position: 1 }, away: { type: "third", groups: ["C", "E", "F", "H", "I"] } },
  { id: "M80", round: "Round of 32", home: { type: "group", group: "L", position: 1 }, away: { type: "third", groups: ["E", "H", "I", "J", "K"] } },
  { id: "M81", round: "Round of 32", home: { type: "group", group: "D", position: 1 }, away: { type: "third", groups: ["B", "E", "F", "I", "J"] } },
  { id: "M82", round: "Round of 32", home: { type: "group", group: "G", position: 1 }, away: { type: "third", groups: ["A", "E", "H", "I", "J"] } },
  { id: "M83", round: "Round of 32", home: { type: "group", group: "K", position: 2 }, away: { type: "group", group: "L", position: 2 } },
  { id: "M84", round: "Round of 32", home: { type: "group", group: "H", position: 1 }, away: { type: "group", group: "J", position: 2 } },
  { id: "M85", round: "Round of 32", home: { type: "group", group: "B", position: 1 }, away: { type: "third", groups: ["E", "F", "G", "I", "J"] } },
  { id: "M86", round: "Round of 32", home: { type: "group", group: "J", position: 1 }, away: { type: "group", group: "H", position: 2 } },
  { id: "M87", round: "Round of 32", home: { type: "group", group: "K", position: 1 }, away: { type: "third", groups: ["D", "E", "I", "J", "L"] } },
  { id: "M88", round: "Round of 32", home: { type: "group", group: "D", position: 2 }, away: { type: "group", group: "G", position: 2 } },
  { id: "M89", round: "Round of 16", home: { type: "winner", matchId: "M74" }, away: { type: "winner", matchId: "M77" } },
  { id: "M90", round: "Round of 16", home: { type: "winner", matchId: "M73" }, away: { type: "winner", matchId: "M75" } },
  { id: "M91", round: "Round of 16", home: { type: "winner", matchId: "M76" }, away: { type: "winner", matchId: "M78" } },
  { id: "M92", round: "Round of 16", home: { type: "winner", matchId: "M79" }, away: { type: "winner", matchId: "M80" } },
  { id: "M93", round: "Round of 16", home: { type: "winner", matchId: "M83" }, away: { type: "winner", matchId: "M84" } },
  { id: "M94", round: "Round of 16", home: { type: "winner", matchId: "M81" }, away: { type: "winner", matchId: "M82" } },
  { id: "M95", round: "Round of 16", home: { type: "winner", matchId: "M86" }, away: { type: "winner", matchId: "M88" } },
  { id: "M96", round: "Round of 16", home: { type: "winner", matchId: "M85" }, away: { type: "winner", matchId: "M87" } },
  { id: "M97", round: "Quarter-finals", home: { type: "winner", matchId: "M89" }, away: { type: "winner", matchId: "M90" } },
  { id: "M98", round: "Quarter-finals", home: { type: "winner", matchId: "M93" }, away: { type: "winner", matchId: "M94" } },
  { id: "M99", round: "Quarter-finals", home: { type: "winner", matchId: "M91" }, away: { type: "winner", matchId: "M92" } },
  { id: "M100", round: "Quarter-finals", home: { type: "winner", matchId: "M95" }, away: { type: "winner", matchId: "M96" } },
  { id: "M101", round: "Semi-finals", home: { type: "winner", matchId: "M97" }, away: { type: "winner", matchId: "M98" } },
  { id: "M102", round: "Semi-finals", home: { type: "winner", matchId: "M99" }, away: { type: "winner", matchId: "M100" } },
  { id: "M103", round: "Third place", home: { type: "loser", matchId: "M101" }, away: { type: "loser", matchId: "M102" } },
  { id: "M104", round: "Final", home: { type: "winner", matchId: "M101" }, away: { type: "winner", matchId: "M102" } }
];
const bracketMatchMap = new Map(bracketMatches.map((match) => [match.id, match]));

function groupTeamsFromMatches(matches) {
  const groups = {};
  matches.forEach((match) => {
    const group = String(match.phase || "").match(/^GROUP[_ ]([A-L])$/i)?.[1]?.toUpperCase();
    if (!group) return;
    groups[group] ||= [];
    [match.home, match.away].forEach((team) => {
      if (!team || /^(TBD|Winner|Runner-up|Loser|3rd)\b/i.test(team)) return;
      if (!groups[group].includes(team)) groups[group].push(team);
    });
  });
  Object.values(groups).forEach((teams) => teams.sort((left, right) => left.localeCompare(right)));
  return groups;
}

function bracketSourceLabel(source) {
  if (source.type === "group") {
    return `${source.position === 1 ? "Winner" : "Runner-up"} Group ${source.group}`;
  }
  if (source.type === "third") return `Third place Group ${source.groups.join("/")}`;
  return `${source.type === "loser" ? "Loser" : "Winner"} ${source.matchId}`;
}

function resolveBracketSource(source, entrants, winners) {
  if (source.type === "group" || source.type === "third") return entrants[`${source.matchId || ""}`] || "";
  const previous = bracketMatchMap.get(source.matchId);
  const winner = winners[source.matchId] || "";
  if (source.type === "winner") return winner;
  if (!previous || !winner) return "";
  const participants = resolveBracketParticipants(previous, entrants, winners);
  return participants.find((team) => team && team !== winner) || "";
}

function resolveBracketParticipants(match, entrants, winners) {
  if (match.round === "Round of 32") {
    return [entrants[`${match.id}.home`] || "", entrants[`${match.id}.away`] || ""];
  }
  return [
    resolveBracketSource(match.home, entrants, winners),
    resolveBracketSource(match.away, entrants, winners)
  ];
}

function sanitizeBracketMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, team]) => [
    String(key),
    String(team || "").trim().slice(0, 80)
  ]).filter(([, team]) => team));
}

function validateBracketPicks(entrants, winners, groups) {
  const allowedEntrantKeys = new Set();
  const selectedTeams = new Set();
  const selectedThirdGroups = new Set();
  for (const match of bracketMatches.filter((item) => item.round === "Round of 32")) {
    for (const [side, source] of [["home", match.home], ["away", match.away]]) {
      const key = `${match.id}.${side}`;
      allowedEntrantKeys.add(key);
      const team = entrants[key];
      if (!team) continue;
      const eligibleGroups = source.type === "group" ? [source.group] : source.groups;
      const eligible = eligibleGroups.some((group) => (groups[group] || []).includes(team));
      if (!eligible) throw new Error(`${team} is not eligible for ${bracketSourceLabel(source)}.`);
      if (selectedTeams.has(team)) throw new Error(`${team} cannot occupy more than one bracket position.`);
      if (source.type === "third") {
        const selectedGroup = eligibleGroups.find((group) => (groups[group] || []).includes(team));
        if (selectedThirdGroups.has(selectedGroup)) {
          throw new Error(`Only one third-place team can qualify from Group ${selectedGroup}.`);
        }
        selectedThirdGroups.add(selectedGroup);
      }
      selectedTeams.add(team);
    }
  }
  if (Object.keys(entrants).some((key) => !allowedEntrantKeys.has(key))) {
    throw new Error("The bracket contains an unknown qualification position.");
  }
  const allowedWinnerKeys = new Set(bracketMatches.map((match) => match.id));
  if (Object.keys(winners).some((key) => !allowedWinnerKeys.has(key))) {
    throw new Error("The bracket contains an unknown match.");
  }
  for (const match of bracketMatches) {
    const winner = winners[match.id];
    if (!winner) continue;
    const participants = resolveBracketParticipants(match, entrants, winners);
    if (participants.some((team) => !team) || !participants.includes(winner)) {
      throw new Error(`${winner} cannot advance from ${match.id}. Complete its valid crossing first.`);
    }
  }
}

async function bracketPayload(userId) {
  const db = await getDb();
  const matches = await getMatches();
  const bracket = await db.collection("brackets").findOne({ userId });
  const kickoffMap = new Map(matches.map((match) => [match.id, match.kickoffUtc]));
  return {
    groups: groupTeamsFromMatches(matches),
    matches: bracketMatches.map((match) => ({
      ...match,
      home: { ...match.home, label: bracketSourceLabel(match.home) },
      away: { ...match.away, label: bracketSourceLabel(match.away) },
      kickoffUtc: kickoffMap.get(match.id) || null,
      locked: kickoffMap.has(match.id) && Date.now() >= new Date(kickoffMap.get(match.id)).getTime()
    })),
    picks: {
      entrants: bracket?.entrants || {},
      winners: bracket?.winners || {},
      updatedAt: bracket?.updatedAt || null
    }
  };
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
  const providerMatch = localMatches.find((match) => String(match.providerMatchId) === String(apiMatch.id));
  if (providerMatch) return providerMatch;
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

function valuesMatch(left, right) {
  if (left instanceof Date || right instanceof Date) {
    return new Date(left).getTime() === new Date(right).getTime();
  }
  return (left ?? null) === (right ?? null);
}

function recordChanged(existing, next, fields) {
  if (!existing) return true;
  return fields.some((field) => !valuesMatch(existing[field], next[field]));
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
  const storedResults = await withMongoRetry(() => db.collection("results").find({}).toArray());
  const resultMap = new Map(storedResults.map((result) => [result.matchId, result]));
  const now = new Date();
  const matchFields = [
    "date", "phase", "home", "away", "stadium", "city", "kickoffUtc", "kickoffLocal",
    "stadiumTz", "provider", "providerMatchId", "providerStatus", "source"
  ];
  const resultFields = ["home", "away", "provider", "providerMatchId", "providerStatus"];
  const summary = {
    provider: "football-data.org",
    received: apiMatches.length,
    matchRecordsUpdated: 0,
    matchRecordsUnchanged: 0,
    finished: 0,
    matched: 0,
    updated: 0,
    resultsUnchanged: 0,
    skipped: []
  };

  for (const apiMatch of apiMatches) {
    const localMatch = findLocalMatchForApiMatch(apiMatch, storedMatches);
    const apiStoredMatch = providerMatchToStoredMatch(apiMatch);
    const matchRecord = localMatch ? { ...localMatch, ...apiStoredMatch, id: localMatch.id, source: "api" } : apiStoredMatch;
    const { createdAt, _id, ...matchUpdate } = matchRecord;
    if (localMatch) summary.matched += 1;
    matchUpdate.inactive = false;
    if (recordChanged(localMatch, matchUpdate, matchFields) || localMatch?.inactive === true) {
      await withMongoRetry(() => db.collection("matches").updateOne(
        { id: matchRecord.id },
        {
          $set: {
            ...matchUpdate,
            syncedAt: now,
            updatedAt: now
          },
          $setOnInsert: { createdAt: now }
        },
        { upsert: true }
      ));
      summary.matchRecordsUpdated += 1;
    } else {
      summary.matchRecordsUnchanged += 1;
    }

    if (apiMatch.status !== "FINISHED") continue;
    const fullTime = apiMatch.score?.fullTime || {};
    const home = parseScore(fullTime.home);
    const away = parseScore(fullTime.away);
    if (home === null || away === null) continue;
    summary.finished += 1;
    const resultRecord = {
      matchId: matchRecord.id,
      home,
      away,
      provider: "football-data.org",
      providerMatchId: apiMatch.id,
      providerStatus: apiMatch.status
    };
    if (recordChanged(resultMap.get(matchRecord.id), resultRecord, resultFields)) {
      await withMongoRetry(() => db.collection("results").updateOne(
        { matchId: matchRecord.id },
        {
          $set: {
            ...resultRecord,
            syncedAt: now,
            updatedAt: now
          },
          $setOnInsert: { createdAt: now }
        },
        { upsert: true }
      ));
      summary.updated += 1;
    } else {
      summary.resultsUnchanged += 1;
    }
  }

  return summary;
}

async function refreshFootballDataIfDue() {
  if (!footballDataToken) {
    return syncFootballDataResults({ skipMissingToken: true });
  }
  const lastRefreshAt = Math.max(lastMatchSyncAt, lastMatchSyncAttemptAt);
  if (Date.now() - lastRefreshAt < matchSyncIntervalMs) {
    return {
      provider: "football-data.org",
      cached: true,
      lastSyncedAt: lastMatchSyncAt ? new Date(lastMatchSyncAt).toISOString() : null,
      lastAttemptedAt: lastMatchSyncAttemptAt ? new Date(lastMatchSyncAttemptAt).toISOString() : null
    };
  }
  if (!matchSyncPromise) {
    lastMatchSyncAttemptAt = Date.now();
    matchSyncPromise = syncFootballDataResults({ skipMissingToken: true })
      .then((summary) => {
        lastMatchSyncAt = Date.now();
        return summary;
      })
      .catch((error) => {
        console.error("Fixture synchronization failed:", error);
        return {
          provider: "football-data.org",
          received: 0,
          matchRecordsUpdated: 0,
          finished: 0,
          matched: 0,
          updated: 0,
          skipped: [error.message || "Unable to refresh football-data.org matches."]
        };
      })
      .finally(() => {
        matchSyncPromise = undefined;
      });
  }
  return matchSyncPromise;
}

function emptyAccuracy() {
  return {
    graded: 0,
    points: 0,
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

async function buildLeaderboard(userIds = null) {
  const db = await getDb();
  const userFilter = userIds ? { _id: { $in: userIds } } : {};
  const predictionFilter = userIds ? { userId: { $in: userIds } } : {};
  const [users, predictions, results] = await Promise.all([
    db.collection("users").find(userFilter, { projection: { nickname: 1 } }).toArray(),
    db.collection("predictions").find(predictionFilter).toArray(),
    db.collection("results").find({}).toArray()
  ]);
  const resultMap = new Map(results.map((result) => [result.matchId, result]));
  const standings = new Map(users.map((user) => [String(user._id), {
    nickname: user.nickname,
    points: 0,
    graded: 0,
    exactScoreHits: 0,
    resultHits: 0
  }]));

  predictions.forEach((prediction) => {
    const result = resultMap.get(prediction.matchId);
    const standing = standings.get(String(prediction.userId));
    if (!result || !standing) return;
    standing.graded += 1;
    const points = predictionPoints(prediction, result);
    const exact = points === 3;
    const resultHit = points > 0;
    if (exact) {
      standing.exactScoreHits += 1;
      standing.resultHits += 1;
      standing.points += points;
    } else if (resultHit) {
      standing.resultHits += 1;
      standing.points += points;
    }
  });

  const rows = [...standings.values()].sort((left, right) => (
    right.points - left.points ||
    right.exactScoreHits - left.exactScoreHits ||
    right.resultHits - left.resultHits ||
    left.nickname.localeCompare(right.nickname)
  ));
  let previous;
  rows.forEach((row, index) => {
    const tied = previous &&
      previous.points === row.points &&
      previous.exactScoreHits === row.exactScoreHits &&
      previous.resultHits === row.resultHits;
    row.rank = tied ? previous.rank : index + 1;
    previous = row;
  });
  return rows;
}

function normalizeTeamName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function isCompatibleTeamName(name) {
  const normalized = normalizeTeamName(name);
  return normalized.length >= 3 && normalized.length <= 40 && !/[<>{}]/.test(normalized);
}

function normalizeInviteCode(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generateInviteCode() {
  return crypto.randomBytes(5).toString("hex").toUpperCase();
}

function publicTeam(team, userId) {
  return {
    id: String(team._id),
    name: team.name,
    inviteCode: team.inviteCode,
    memberCount: team.members.length,
    isOwner: String(team.ownerId) === String(userId),
    createdAt: team.createdAt
  };
}

async function getTeamForMember(db, teamId, userId) {
  if (!ObjectId.isValid(teamId)) return null;
  return db.collection("teams").findOne({
    _id: new ObjectId(teamId),
    members: userId
  });
}

async function buildAdminOverview() {
  const db = await getDb();
  void refreshFootballDataIfDue();
  const matches = await getMatches();
  const users = await db.collection("users")
    .find({}, { projection: { passwordHash: 0, passwordSalt: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
  const predictions = await db.collection("predictions").find({}).sort({ updatedAt: -1 }).toArray();
  const results = await db.collection("results").find({}).toArray();
  const teams = await db.collection("teams").find({}).sort({ createdAt: -1 }).toArray();
  const passwordResets = await db.collection("passwordResets")
    .find({ usedAt: { $exists: false }, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .toArray();
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
        accuracy.points += predictionPoints(prediction, result);
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
    teams: teams.map((team) => ({
      id: String(team._id),
      name: team.name,
      inviteCode: team.inviteCode,
      owner: userMap.get(String(team.ownerId)) || {
        id: String(team.ownerId),
        nickname: "Deleted user",
        name: "Deleted user",
        email: ""
      },
      members: team.members.map((memberId) => userMap.get(String(memberId)) || {
        id: String(memberId),
        nickname: "Deleted user",
        name: "Deleted user",
        email: ""
      }),
      createdAt: team.createdAt,
      updatedAt: team.updatedAt
    })),
    passwordResets: passwordResets.map((reset) => {
      const token = decryptResetToken(reset);
      return {
        id: String(reset._id),
        user: userMap.get(String(reset.userId)) || {
          id: String(reset.userId),
          nickname: "Deleted user",
          name: "Deleted user",
          email: ""
        },
        resetPath: token ? `/reset-password.html?token=${encodeURIComponent(token)}` : "",
        createdAt: reset.createdAt,
        expiresAt: reset.expiresAt
      };
    }),
    stats,
    totals: {
      users: users.length,
      predictions: predictions.length,
      teams: teams.length,
      matchesWithVotes: stats.filter((stat) => stat.predictionCount > 0).length,
      completedResults: results.length
    }
  };
}

async function handleApi(request, response, url) {
  try {
    if (request.method === "GET" && url.pathname === "/api/matches") {
      let matches = await getMatches();
      let sync;
      if (matches.length > 0) {
        void refreshFootballDataIfDue();
        sync = {
          provider: "football-data.org",
          background: true,
          lastSyncedAt: lastMatchSyncAt ? new Date(lastMatchSyncAt).toISOString() : null
        };
      } else {
        sync = await refreshFootballDataIfDue();
        matches = await getMatches();
      }
      sendJson(response, 200, { matches, sync });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/leaderboard") {
      sendJson(response, 200, {
        scoring: {
          exactScore: 3,
          correctResult: 1
        },
        leaderboard: await buildLeaderboard()
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/teams") {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        sendJson(response, 401, { error: "Log in to view your teams." });
        return;
      }
      const db = await getDb();
      const teams = await db.collection("teams")
        .find({ members: user._id })
        .sort({ createdAt: -1 })
        .toArray();
      sendJson(response, 200, { teams: teams.map((team) => publicTeam(team, user._id)) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/teams") {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        sendJson(response, 401, { error: "Log in to create a team." });
        return;
      }
      const body = await readBody(request);
      const name = normalizeTeamName(body.name);
      if (!isCompatibleTeamName(name)) {
        sendJson(response, 400, { error: "Team name must be 3-40 characters." });
        return;
      }
      const db = await getDb();
      if (await db.collection("teams").countDocuments({ ownerId: user._id }) >= 10) {
        sendJson(response, 409, { error: "You can create up to 10 teams." });
        return;
      }
      let team;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        team = {
          name,
          inviteCode: generateInviteCode(),
          ownerId: user._id,
          members: [user._id],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        try {
          const result = await db.collection("teams").insertOne(team);
          team._id = result.insertedId;
          break;
        } catch (error) {
          if (error.code !== 11000 || attempt === 4) throw error;
          team = null;
        }
      }
      sendJson(response, 201, { team: publicTeam(team, user._id) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/teams/join") {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        sendJson(response, 401, { error: "Log in to join a team." });
        return;
      }
      const body = await readBody(request);
      const inviteCode = normalizeInviteCode(body.inviteCode);
      if (inviteCode.length !== 10) {
        sendJson(response, 400, { error: "Enter a valid 10-character invite code." });
        return;
      }
      const db = await getDb();
      const existingTeam = await db.collection("teams").findOne({ inviteCode });
      if (!existingTeam) {
        sendJson(response, 404, { error: "No team was found for that invite code." });
        return;
      }
      if (existingTeam.members.some((memberId) => String(memberId) === String(user._id))) {
        sendJson(response, 409, { error: `You are already a member of ${existingTeam.name}.` });
        return;
      }
      if (await db.collection("teams").countDocuments({ members: user._id }) >= 25) {
        sendJson(response, 409, { error: "You can join up to 25 teams." });
        return;
      }
      const team = await db.collection("teams").findOneAndUpdate(
        { _id: existingTeam._id, members: { $ne: user._id } },
        { $addToSet: { members: user._id }, $set: { updatedAt: new Date() } },
        { returnDocument: "after" }
      );
      if (!team) {
        sendJson(response, 409, { error: `You are already a member of ${existingTeam.name}.` });
        return;
      }
      sendJson(response, 200, { team: publicTeam(team, user._id) });
      return;
    }

    const teamLeaderboardMatch = url.pathname.match(/^\/api\/teams\/([^/]+)\/leaderboard$/);
    if (request.method === "GET" && teamLeaderboardMatch) {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        sendJson(response, 401, { error: "Log in to view team standings." });
        return;
      }
      const db = await getDb();
      const team = await getTeamForMember(db, teamLeaderboardMatch[1], user._id);
      if (!team) {
        sendJson(response, 404, { error: "Team not found or you are not a member." });
        return;
      }
      sendJson(response, 200, {
        team: publicTeam(team, user._id),
        scoring: { exactScore: 3, correctResult: 1 },
        leaderboard: await buildLeaderboard(team.members)
      });
      return;
    }

    const teamMembershipMatch = url.pathname.match(/^\/api\/teams\/([^/]+)$/);
    if (request.method === "DELETE" && teamMembershipMatch) {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        sendJson(response, 401, { error: "Log in to manage team membership." });
        return;
      }
      const db = await getDb();
      const team = await getTeamForMember(db, teamMembershipMatch[1], user._id);
      if (!team) {
        sendJson(response, 404, { error: "Team not found or you are not a member." });
        return;
      }
      if (String(team.ownerId) === String(user._id)) {
        await db.collection("teams").deleteOne({ _id: team._id, ownerId: user._id });
        sendJson(response, 200, { message: "Team deleted." });
      } else {
        await db.collection("teams").updateOne(
          { _id: team._id },
          { $pull: { members: user._id }, $set: { updatedAt: new Date() } }
        );
        sendJson(response, 200, { message: "You left the team." });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/register") {
      if (!rateLimit(request, response, "register", 12, 15 * 60 * 1000)) return;
      const body = await readBody(request);
      const name = String(body.name || "").trim();
      const nickname = normalizeNickname(body.nickname);
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      if (!name || !isCompatibleNickname(nickname) || !isCompatibleEmail(email) || password.length < 8) {
        sendJson(response, 400, { error: "Name, valid nickname, email, and an 8+ character password are required." });
        return;
      }

      const { salt, hash } = hashPassword(password);
      const db = await getDb();
      if (await db.collection("users").findOne({ nicknameKey: nicknameKey(nickname) })) {
        sendJson(response, 409, { error: "That nickname is already taken." });
        return;
      }
      const user = {
        name,
        nickname,
        nicknameKey: nicknameKey(nickname),
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
        sendJson(response, 400, { error: "Enter a valid email address, like name@example.com." });
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
        message: "If an account exists for this email, the request has been recorded. Contact the administrator to receive your password reset link."
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
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await db.collection("passwordResets").updateMany(
        { userId: user._id, usedAt: { $exists: false } },
        { $set: { usedAt: new Date(), superseded: true } }
      );
      await db.collection("passwordResets").insertOne({
        userId: user._id,
        tokenHash: hashToken(token),
        ...encryptResetToken(token),
        expiresAt,
        createdAt: new Date()
      });
      sendJson(response, 200, responsePayload);
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

    if (request.method === "GET" && url.pathname === "/api/profile") {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        sendJson(response, 401, { error: "Log in to view your profile." });
        return;
      }
      const db = await getDb();
      const [matches, predictions, results] = await Promise.all([
        getMatches(),
        withMongoRetry(() => db.collection("predictions").find({ userId: user._id }).toArray()),
        withMongoRetry(() => db.collection("results").find({}).toArray())
      ]);
      const matchMap = new Map(matches.map((match) => [match.id, match]));
      const resultMap = new Map(results.map((result) => [result.matchId, result]));
      const summary = {
        totalPredictions: predictions.length,
        graded: 0,
        points: 0,
        exactScoreHits: 0,
        resultHits: 0
      };
      const predictionHistory = predictions.map((prediction) => {
        const match = matchMap.get(prediction.matchId) || null;
        const result = resultMap.get(prediction.matchId) || null;
        const points = result ? predictionPoints(prediction, result) : null;
        if (result) {
          summary.graded += 1;
          summary.points += points;
          if (points === 3) summary.exactScoreHits += 1;
          if (points > 0) summary.resultHits += 1;
        }
        return {
          matchId: prediction.matchId,
          match,
          prediction: { home: prediction.home, away: prediction.away },
          result: result ? { home: result.home, away: result.away } : null,
          points,
          savedAt: prediction.updatedAt
        };
      }).sort((left, right) => {
        const leftDate = new Date(left.match?.kickoffUtc || left.savedAt || 0).getTime();
        const rightDate = new Date(right.match?.kickoffUtc || right.savedAt || 0).getTime();
        return rightDate - leftDate;
      });
      sendJson(response, 200, {
        user: publicUser(user),
        summary,
        predictions: predictionHistory
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/bracket") {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        sendJson(response, 401, { error: "Log in to build your World Cup bracket." });
        return;
      }
      sendJson(response, 200, await bracketPayload(user._id));
      return;
    }

    if (request.method === "PUT" && url.pathname === "/api/bracket") {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        sendJson(response, 401, { error: "Log in to save your World Cup bracket." });
        return;
      }
      const body = await readBody(request);
      const entrants = sanitizeBracketMap(body.entrants);
      const winners = sanitizeBracketMap(body.winners);
      const db = await getDb();
      const matches = await getMatches();
      const groups = groupTeamsFromMatches(matches);
      try {
        validateBracketPicks(entrants, winners, groups);
      } catch (error) {
        sendJson(response, 400, { error: error.message });
        return;
      }
      const existing = await db.collection("brackets").findOne({ userId: user._id });
      const existingEntrants = existing?.entrants || {};
      const existingWinners = existing?.winners || {};
      const kickoffMap = new Map(matches.map((match) => [match.id, match.kickoffUtc]));
      for (const match of bracketMatches) {
        const kickoffUtc = kickoffMap.get(match.id);
        if (!kickoffUtc || Date.now() < new Date(kickoffUtc).getTime()) continue;
        if (match.round === "Round of 32") {
          for (const side of ["home", "away"]) {
            const key = `${match.id}.${side}`;
            if ((entrants[key] || "") !== (existingEntrants[key] || "")) {
              sendJson(response, 403, { error: `${match.id} is locked because it has started.` });
              return;
            }
          }
        }
        if ((winners[match.id] || "") !== (existingWinners[match.id] || "")) {
          sendJson(response, 403, { error: `${match.id} is locked because it has started.` });
          return;
        }
      }
      const now = new Date();
      await db.collection("brackets").updateOne(
        { userId: user._id },
        {
          $set: { userId: user._id, entrants, winners, updatedAt: now },
          $setOnInsert: { createdAt: now }
        },
        { upsert: true }
      );
      sendJson(response, 200, {
        message: "Bracket saved.",
        picks: { entrants, winners, updatedAt: now }
      });
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

    const adminPasswordResetMatch = url.pathname.match(/^\/api\/admin\/password-resets\/([^/]+)$/);
    if (request.method === "POST" && adminPasswordResetMatch) {
      if (!await requireAdmin(request, response)) return;
      if (!ObjectId.isValid(adminPasswordResetMatch[1])) {
        sendJson(response, 404, { error: "Password reset request not found." });
        return;
      }
      const db = await getDb();
      const reset = await db.collection("passwordResets").findOne({
        _id: new ObjectId(adminPasswordResetMatch[1]),
        usedAt: { $exists: false }
      });
      if (!reset) {
        sendJson(response, 404, { error: "Password reset request not found or already used." });
        return;
      }
      const token = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await db.collection("passwordResets").updateOne(
        { _id: reset._id },
        {
          $set: {
            tokenHash: hashToken(token),
            ...encryptResetToken(token),
            expiresAt,
            regeneratedAt: new Date()
          }
        }
      );
      sendJson(response, 200, {
        resetPath: `/reset-password.html?token=${encodeURIComponent(token)}`,
        expiresAt
      });
      return;
    }

    const adminTeamMatch = url.pathname.match(/^\/api\/admin\/teams\/([^/]+)$/);
    if (request.method === "PUT" && adminTeamMatch) {
      if (!await requireAdmin(request, response)) return;
      if (!ObjectId.isValid(adminTeamMatch[1])) {
        sendJson(response, 404, { error: "Team not found." });
        return;
      }
      const body = await readBody(request);
      const name = normalizeTeamName(body.name);
      if (!isCompatibleTeamName(name)) {
        sendJson(response, 400, { error: "Team name must be 3-40 characters." });
        return;
      }
      const db = await getDb();
      const team = await db.collection("teams").findOneAndUpdate(
        { _id: new ObjectId(adminTeamMatch[1]) },
        { $set: { name, updatedAt: new Date(), editedByAdmin: true } },
        { returnDocument: "after" }
      );
      if (!team) {
        sendJson(response, 404, { error: "Team not found." });
        return;
      }
      sendJson(response, 200, { message: "Team renamed." });
      return;
    }

    if (request.method === "DELETE" && adminTeamMatch) {
      if (!await requireAdmin(request, response)) return;
      if (!ObjectId.isValid(adminTeamMatch[1])) {
        sendJson(response, 404, { error: "Team not found." });
        return;
      }
      const db = await getDb();
      const result = await db.collection("teams").deleteOne({ _id: new ObjectId(adminTeamMatch[1]) });
      if (!result.deletedCount) {
        sendJson(response, 404, { error: "Team not found." });
        return;
      }
      sendJson(response, 200, { message: "Team deleted." });
      return;
    }

    const adminTeamMemberMatch = url.pathname.match(/^\/api\/admin\/teams\/([^/]+)\/members\/([^/]+)$/);
    if (request.method === "DELETE" && adminTeamMemberMatch) {
      if (!await requireAdmin(request, response)) return;
      const [teamId, memberId] = adminTeamMemberMatch.slice(1);
      if (!ObjectId.isValid(teamId) || !ObjectId.isValid(memberId)) {
        sendJson(response, 404, { error: "Team or member not found." });
        return;
      }
      const db = await getDb();
      const team = await db.collection("teams").findOne({ _id: new ObjectId(teamId) });
      if (!team || !team.members.some((id) => String(id) === memberId)) {
        sendJson(response, 404, { error: "Team or member not found." });
        return;
      }
      if (String(team.ownerId) === memberId) {
        sendJson(response, 409, { error: "The team owner cannot be removed. Delete the team instead." });
        return;
      }
      await db.collection("teams").updateOne(
        { _id: team._id },
        { $pull: { members: new ObjectId(memberId) }, $set: { updatedAt: new Date(), editedByAdmin: true } }
      );
      sendJson(response, 200, { message: "Member removed from team." });
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
    console.error(`${request.method} ${url.pathname} failed:`, error);
    if (error.code === 11000) {
      sendJson(response, 409, { error: "An account already exists for this email." });
      return;
    }
    let message = "Something went wrong. Please try again later.";
    if (process.env.NODE_ENV !== "production" && error.message && error.message.includes("ECONNREFUSED")) {
      message = "MongoDB is not running at mongodb://127.0.0.1:27017.";
    } else if (process.env.NODE_ENV !== "production" && error.message && (error.message.includes("FOOTBALL_DATA_TOKEN") || error.message.includes("football-data.org"))) {
      message = error.message;
    }
    sendJson(response, 500, { error: message });
  }
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);
  instrumentResponse(request, response, url.pathname);

  if (request.method === "GET" && url.pathname === "/healthz") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/readyz") {
    getDb()
      .then((db) => db.command({ ping: 1 }))
      .then(() => sendJson(response, 200, { status: "ready" }))
      .catch((error) => {
        console.error("Readiness check failed:", error.message);
        sendJson(response, 503, { status: "unavailable" });
      });
    return;
  }

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

  const filePath = path.join(publicRoot, normalized);

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, securityHeaders());
      response.end("Not found");
      return;
    }
    response.writeHead(200, securityHeaders({ "Content-Type": types[path.extname(filePath)] || "application/octet-stream" }));
    response.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`World Cup Predictor running at http://${host}:${port}/`);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down.`);
  server.close(async () => {
    await mongoClient?.close().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
