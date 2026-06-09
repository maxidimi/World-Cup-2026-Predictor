# World Cup Predictor

A local World Cup prediction web app with MongoDB-backed users, login, admin tools, match storage, and score syncing from football-data.org.

For a complete public Azure deployment procedure, see [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md).

## Features

- Register and log in with local MongoDB authentication.
- Validate email format before registration or login.
- Browse World Cup matches by date, team, or phase.
- Store matches in MongoDB and render the app from the database.
- Sync available fixtures and scores from football-data.org when `FOOTBALL_DATA_TOKEN` is configured.
- Save user predictions before kickoff only.
- Admin dashboard for users, predictions, vote stats, result stats, and manual prediction/result edits.
- Admin access controlled by the `isAdmin` flag in MongoDB.
- Local password reset flow.
- Docker support for running the app and MongoDB together.

## Requirements

- Node.js
- MongoDB
- Optional: Docker and Docker Compose
- Optional: a football-data.org API token

## Environment

Create a `.env` file in the project root:

```text
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=world_cup_predictor
AUTH_SECRET=replace-with-a-long-random-secret
FOOTBALL_DATA_TOKEN=your-football-data-org-token
HOST=127.0.0.1
PORT=8000
NODE_ENV=development
```

`AUTH_SECRET` is used to sign login tokens. Use a long random value, especially before publishing.

`FOOTBALL_DATA_TOKEN` is optional. Without it, the app still works from MongoDB and the seeded local schedule. With it, `/api/matches` checks football-data.org on refresh and updates stored matches and scores.

## Run Locally

Install dependencies:

```powershell
npm install
```

Make sure MongoDB is running locally, then start the app:

```powershell
npm start
```

Open:

```text
http://127.0.0.1:8000
```

## Run With Docker

Create `.env` first:

```text
AUTH_SECRET=replace-with-a-long-random-secret
FOOTBALL_DATA_TOKEN=
DOCKER_MONGODB_URI=mongodb://host.docker.internal:27017
```

Make sure the local MongoDB Windows service is running, then start the app and Prometheus:

```powershell
docker compose up --build
```

Open:

```text
http://localhost:8000
```

The Docker app connects to the local MongoDB server visible in Compass through `host.docker.internal:27017`. In Compass, connect to:

```text
mongodb://127.0.0.1:27017
```

Open the `world_cup_predictor` database to view users, matches, predictions, results, and password reset records.

Prometheus is available at:

```text
http://localhost:9090
```

It scrapes the app's Prometheus-compatible endpoint every 15 seconds:

```text
http://localhost:8000/metrics
```

The admin page also includes a Metrics tab with request traffic, latency, error rate, memory, uptime, and database totals.

Useful Docker commands:

```powershell
docker compose logs app
docker compose logs prometheus
docker compose down
docker compose down -v
```

`docker compose down -v` removes Prometheus data. It does not delete the local MongoDB database.

## Admin Access

Admin permissions are stored in MongoDB with the `isAdmin` flag.

After the admin user registers, open MongoDB:

```powershell
mongosh world_cup_predictor
```

Then set the admin flag:

```javascript
db.users.updateOne(
  { email: "admin@domain.com" },
  { $set: { isAdmin: true } }
)
```

The admin page is:

```text
http://127.0.0.1:8000/admin.html
```

Users without admin permission are redirected to the admin error page.

## Match Data

The app stores matches in the `matches` collection.

On startup, MongoDB is seeded from the bundled World Cup schedule if the `matches` collection is empty. During normal use, the frontend loads matches from:

```text
GET /api/matches
```

When `FOOTBALL_DATA_TOKEN` is set, that endpoint also tries to refresh fixtures and scores from football-data.org. API-backed rows are marked active. Old seed-only duplicates can be marked inactive and are not shown by the app.

Admin users can also trigger a manual sync:

```text
POST /api/admin/sync-results
```

## Database Collections

- `users`: registered users and admin flag.
- `predictions`: user score predictions.
- `results`: official or admin-entered match scores.
- `matches`: stored fixtures shown by the app.
- `passwordResets`: local password reset tokens.

## Security Notes

Before publishing publicly:

- Set `NODE_ENV=production`.
- Set a strong `AUTH_SECRET`.
- Use MongoDB with authentication enabled.
- Do not expose MongoDB directly to the internet.
- Keep `.env` private.
- Use HTTPS in front of the app.
- Grant admin only through `isAdmin: true` in MongoDB.

The server only serves known public files and assets. It does not serve `.env`, `server.js`, `package.json`, `node_modules`, or other project files.
