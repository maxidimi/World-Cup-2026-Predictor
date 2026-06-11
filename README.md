# World Cup Predictor

A World Cup prediction web app with MongoDB-backed users, login, admin tools, match storage, and score syncing from football-data.org.

For a complete public Azure deployment procedure, see [Azure deployment](docs/AZURE_DEPLOYMENT.md).

## Features

- Register and log in with local MongoDB authentication.
- Choose a unique public nickname during registration.
- Validate email format before registration or login.
- Browse World Cup matches by date, team, or phase.
- Store matches in MongoDB and render the app from the database.
- Sync available fixtures and scores from football-data.org when `FOOTBALL_DATA_TOKEN` is configured.
- Save user predictions before kickoff only.
- View a public leaderboard with 3 points for an exact score and 1 point for the correct 1/X/2 result.
- Create private teams, invite other users by code, and view team-only leaderboards.
- Admin dashboard for users, predictions, vote stats, result stats, and manual prediction/result edits.
- Admin access controlled by the `isAdmin` flag in MongoDB.
- Local password reset flow.
- Docker support for local operation.
- Low-cost Azure Container Apps and Cosmos DB deployment files.

## Requirements

- Node.js
- MongoDB
- Optional: Docker and Docker Compose
- Optional: a football-data.org API token

## Project Structure

```text
.
|-- public/                 Browser pages, scripts, styles, and images
|-- src/                    Node.js server
|-- docs/                   Deployment and operational documentation
|-- infra/                  Azure Bicep infrastructure
|-- scripts/                Deployment helpers
|-- .github/workflows/      CI and Azure deployment workflow
|-- compose.yaml            Local app and Prometheus services
|-- Dockerfile              Production application image
|-- package.json            Node.js dependencies and commands
`-- prometheus.yml          Local Prometheus configuration
```

## Environment

Create a `.env` file in the project root:

```text
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=world_cup_predictor
AUTH_SECRET=replace-with-a-long-random-secret
FOOTBALL_DATA_TOKEN=your-football-data-org-token
MATCH_SYNC_INTERVAL_MINUTES=5
HOST=127.0.0.1
PORT=8000
NODE_ENV=development
```

`AUTH_SECRET` is used to sign login tokens. Use a long random value, especially before publishing.

`FOOTBALL_DATA_TOKEN` is required to populate a new database with fixtures. After fixtures have been stored, the app can continue displaying the saved schedule if the provider is temporarily unavailable.

`MATCH_SYNC_INTERVAL_MINUTES` prevents repeated page loads from rewriting every fixture. Admin-triggered synchronization remains immediate.

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

The app stores matches in the `matches` collection. The frontend loads them from:

```text
GET /api/matches
```

That endpoint refreshes available fixtures and scores from football-data.org before returning the active records stored in MongoDB. There is no bundled fixture schedule in the frontend or server.

Admin users can also trigger a manual sync:

```text
POST /api/admin/sync-results
```

## Database Collections

- `users`: registered users, public nickname, and admin flag.
- `predictions`: user score predictions.
- `results`: official or admin-entered match scores.
- `matches`: stored fixtures shown by the app.
- `brackets`: each user's knockout-stage qualification and winner selections.
- `passwordResets`: local password reset tokens.
- `teams`: private prediction groups, invite codes, owners, and members.

## Security Notes

Before publishing publicly:

- Set `NODE_ENV=production`.
- Set a strong `AUTH_SECRET`.
- Use MongoDB with authentication enabled.
- Do not expose MongoDB directly to the internet.
- Keep `.env` private.
- Use HTTPS in front of the app.
- Grant admin only through `isAdmin: true` in MongoDB.

The server only serves allow-listed files from `public/`. It does not expose `.env`, `src/`, `package.json`, `node_modules`, infrastructure, scripts, or documentation.

## Azure

The repository includes:

- `infra/main.bicep`: Container Apps Consumption and Cosmos DB MongoDB free-tier infrastructure.
- `scripts/deploy-azure.ps1`: initial Azure deployment.
- `.github/workflows/deploy-azure.yml`: GHCR build and automatic Container App revision deployment.

Follow [Azure deployment](docs/AZURE_DEPLOYMENT.md) for the complete process.
