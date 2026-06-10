const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "world_cup_predictor";

if (!uri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

const checks = [
  ["users email index", (db) => db.collection("users").createIndex({ email: 1 }, { unique: true })],
  ["users nickname index", (db) => db.collection("users").createIndex({ nicknameKey: 1 }, { unique: true, sparse: true })],
  ["predictions user/match index", (db) => db.collection("predictions").createIndex({ userId: 1, matchId: 1 }, { unique: true })],
  ["predictions match index", (db) => db.collection("predictions").createIndex({ matchId: 1 })],
  ["results match index", (db) => db.collection("results").createIndex({ matchId: 1 }, { unique: true })],
  ["matches id index", (db) => db.collection("matches").createIndex({ id: 1 }, { unique: true })],
  ["matches provider index", (db) => db.collection("matches").createIndex({ providerMatchId: 1 }, { sparse: true })],
  ["password reset token index", (db) => db.collection("passwordResets").createIndex({ tokenHash: 1 }, { unique: true })],
  ["password reset expiry index", (db) => db.collection("passwordResets").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })],
  ["teams invite index", (db) => db.collection("teams").createIndex({ inviteCode: 1 }, { unique: true })],
  ["teams members index", (db) => db.collection("teams").createIndex({ members: 1 })]
];

async function main() {
  const client = new MongoClient(uri, {
    appName: "world-cup-predictor-diagnostic",
    serverSelectionTimeoutMS: 15000
  });
  try {
    await client.connect();
    console.log("Connection: OK");
    const db = client.db(dbName);
    await db.command({ ping: 1 });
    console.log("Ping: OK");
    for (const [name, check] of checks) {
      try {
        await check(db);
        console.log(`${name}: OK`);
      } catch (error) {
        console.error(`${name}: FAILED (${error.code || "unknown"}) ${error.message}`);
        process.exitCode = 1;
        break;
      }
    }
  } catch (error) {
    console.error(`Connection: FAILED (${error.code || "unknown"}) ${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => {});
  }
}

main();
