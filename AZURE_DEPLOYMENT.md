# Azure Deployment Runbook

This document describes how to deploy the complete World Cup Predictor application to a single Azure Linux virtual machine for educational, low-traffic use.

The deployment includes:

- Node.js application
- MongoDB
- Prometheus
- Caddy reverse proxy
- Automatic HTTPS
- Persistent Docker volumes

## 1. Target Architecture

```mermaid
flowchart LR
    User["Public user"] -->|"HTTPS 443"| Caddy
    Admin["Administrator"] -->|"HTTPS 443"| Caddy
    Caddy -->|"Internal port 8000"| App["Node.js app"]
    App -->|"Internal port 27017"| MongoDB
    Prometheus -->|"Scrape /metrics"| App
    Operator["Administrator over SSH"] -->|"SSH tunnel"| Prometheus
```

Only ports `80`, `443`, and restricted SSH access should be exposed publicly.

Do not expose:

- Application port `8000`
- MongoDB port `27017`
- Prometheus port `9090`

## 2. Important Difference From Local Development

The current local Docker configuration connects back to Windows MongoDB using:

```text
mongodb://host.docker.internal:27017
```

That address is only appropriate for local Docker Desktop development.

The Azure deployment will run MongoDB as a private Docker service named `mongo`. The application will connect to:

```text
mongodb://<username>:<password>@mongo:27017/world_cup_predictor?authSource=admin
```

## 3. Prerequisites

Prepare the following:

- An active Azure subscription.
- Access to the Azure Portal.
- A GitHub repository containing this project.
- An SSH client.
- A generated SSH key pair.
- A domain name or Azure public IP DNS label.
- MongoDB Database Tools installed locally if existing data must be migrated.
- The football-data.org API token.

Recommended Azure resources:

- Region: `West Europe` or another nearby region.
- VM: Ubuntu Server 24.04 LTS.
- Size: `Standard_B2s`, 2 vCPU and 4 GB RAM.
- OS disk: 32 GB Standard SSD or larger.
- Public IP: Standard SKU, static allocation.

## 4. Create the Azure VM

1. Open the [Azure Portal](https://portal.azure.com).
2. Search for **Virtual machines**.
3. Select **Create > Azure virtual machine**.
4. Create or select a resource group, for example:

   ```text
   world-cup-predictor-rg
   ```

5. Configure the VM:

   | Setting | Recommended value |
   |---|---|
   | Virtual machine name | `world-cup-predictor-vm` |
   | Region | `West Europe` |
   | Availability | No infrastructure redundancy required |
   | Image | Ubuntu Server 24.04 LTS |
   | Architecture | x64 |
   | Size | Standard B2s |
   | Authentication | SSH public key |
   | Username | `azureuser` |
   | Public inbound ports | SSH, HTTP, HTTPS |

6. Download and protect the generated private SSH key if Azure creates it.
7. Under **Disks**, choose Standard SSD for this educational deployment.
8. Under **Networking**:

   - Use a Standard static public IP.
   - Allow TCP `80` and `443`.
   - Allow TCP `22` only from your own public IP when possible.

9. Select **Review + create**, then create the VM.

## 5. Configure DNS

### Option A: Azure Public IP DNS Label

This avoids purchasing a domain.

1. Open the VM's public IP resource.
2. Select **Configuration**.
3. Enter a DNS name label, for example:

   ```text
   world-cup-predictor-demo
   ```

4. Save the configuration.
5. Azure provides a hostname similar to:

   ```text
   world-cup-predictor-demo.westeurope.cloudapp.azure.com
   ```

Use this hostname as `APP_DOMAIN`.

### Option B: Custom Domain

Create an `A` record with your DNS provider:

```text
Type: A
Name: predictions
Value: <Azure static public IPv4 address>
TTL: 300
```

The resulting hostname might be:

```text
predictions.example.com
```

Wait until DNS resolves before starting Caddy:

```powershell
Resolve-DnsName predictions.example.com
```

## 6. Connect Through SSH

From PowerShell:

```powershell
ssh -i C:\path\to\azure-key.pem azureuser@<public-ip-or-hostname>
```

On Linux or macOS:

```bash
chmod 600 ~/path/to/azure-key.pem
ssh -i ~/path/to/azure-key.pem azureuser@<public-ip-or-hostname>
```

## 7. Update the VM

Run:

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl git
```

Reboot if the upgrade requires it:

```bash
sudo reboot
```

Reconnect through SSH afterward.

## 8. Install Docker Engine and Compose

Use Docker's official Ubuntu repository:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

Add the repository:

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Install Docker:

```bash
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

Allow the current user to run Docker:

```bash
sudo usermod -aG docker "$USER"
exit
```

Reconnect through SSH and verify:

```bash
docker --version
docker compose version
```

## 9. Clone the Project

Create an application directory:

```bash
sudo mkdir -p /opt/world-cup-predictor
sudo chown "$USER":"$USER" /opt/world-cup-predictor
```

Clone the repository:

```bash
git clone <repository-url> /opt/world-cup-predictor
cd /opt/world-cup-predictor
```

For a private repository, use a GitHub deploy key or a short-lived personal access token. Do not place the token inside repository files.

## 10. Create the Production Environment File

Generate secure values:

```bash
openssl rand -hex 32
openssl rand -base64 32
```

Create the file:

```bash
nano .env.production
```

Example:

```text
APP_DOMAIN=world-cup-predictor-demo.westeurope.cloudapp.azure.com
AUTH_SECRET=<64-character-random-hex-value>
FOOTBALL_DATA_TOKEN=<football-data-token>
MONGO_ROOT_USERNAME=worldcupadmin
MONGO_ROOT_PASSWORD=<strong-random-password>
MONGODB_DB=world_cup_predictor
```

Protect it:

```bash
chmod 600 .env.production
```

Important:

- Do not commit `.env.production`.
- Avoid `@`, `:`, `/`, `?`, `#`, and `%` in the MongoDB password unless it is URL-encoded.
- Never reuse the application admin password as the MongoDB password.

## 11. Create the Azure Compose File

Create:

```bash
nano compose.azure.yaml
```

Use:

```yaml
services:
  app:
    build: .
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      PORT: 8000
      MONGODB_URI: mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@mongo:27017/${MONGODB_DB}?authSource=admin
      MONGODB_DB: ${MONGODB_DB}
      AUTH_SECRET: ${AUTH_SECRET}
      FOOTBALL_DATA_TOKEN: ${FOOTBALL_DATA_TOKEN}
    expose:
      - "8000"
    depends_on:
      mongo:
        condition: service_healthy
    restart: unless-stopped

  mongo:
    image: mongo:7
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USERNAME}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test:
        - CMD
        - mongosh
        - --quiet
        - --username
        - ${MONGO_ROOT_USERNAME}
        - --password
        - ${MONGO_ROOT_PASSWORD}
        - --authenticationDatabase
        - admin
        - --eval
        - db.adminCommand('ping')
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:v3.5.0
    command:
      - --config.file=/etc/prometheus/prometheus.yml
      - --storage.tsdb.path=/prometheus
      - --storage.tsdb.retention.time=15d
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    expose:
      - "9090"
    depends_on:
      - app
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    environment:
      APP_DOMAIN: ${APP_DOMAIN}
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      - app
    restart: unless-stopped

volumes:
  mongo-data:
  prometheus-data:
  caddy-data:
  caddy-config:
```

This file deliberately does not publish MongoDB, Prometheus, or application ports.

## 12. Create the Caddy Configuration

Create:

```bash
nano Caddyfile
```

Use:

```caddyfile
{$APP_DOMAIN} {
    encode zstd gzip

    @prometheusMetrics path /metrics
    respond @prometheusMetrics 404

    reverse_proxy app:8000

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "no-referrer"
        -Server
    }
}
```

Caddy will request and renew the TLS certificate automatically when:

- The domain resolves to the Azure public IP.
- Ports `80` and `443` are reachable.
- No other process uses those ports.

## 13. Validate the Deployment Configuration

Run:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  config --quiet
```

Inspect the rendered configuration without sharing its output because it may contain secrets:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  config
```

## 14. Start the Application

Run:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  up --build -d
```

Check services:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  ps
```

Check logs:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  logs --tail 100 app mongo caddy prometheus
```

## 15. Verify the Public Application

Open:

```text
https://<APP_DOMAIN>
```

Verify:

1. The browser shows a valid HTTPS certificate.
2. Registration succeeds.
3. Login succeeds.
4. Predictions can be saved.
5. Refreshing retains the logged-in session.
6. Admin-only pages reject ordinary users.
7. Match data loads from MongoDB.
8. Dark/light mode works.

Check the application locally from the VM:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  exec app wget -qO- http://127.0.0.1:8000/metrics | head
```

## 16. Migrate the Existing Local MongoDB Data

Skip this section if production should begin with an empty database.

### 16.1 Create the Dump on Windows

Run in PowerShell:

```powershell
mongodump `
  --uri="mongodb://127.0.0.1:27017/world_cup_predictor" `
  --archive="world-cup-predictor.archive.gz" `
  --gzip
```

Using an archive is recommended on Windows.

### 16.2 Upload the Archive

```powershell
scp -i C:\path\to\azure-key.pem `
  .\world-cup-predictor.archive.gz `
  azureuser@<public-ip>:/opt/world-cup-predictor/
```

### 16.3 Restore Into the MongoDB Container

On the VM:

```bash
cat world-cup-predictor.archive.gz | docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  exec -T mongo mongorestore \
    --username "$MONGO_ROOT_USERNAME" \
    --password "$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --archive \
    --gzip \
    --drop
```

If shell variables are not exported, load them first:

```bash
set -a
. ./.env.production
set +a
```

Remove the uploaded archive after verifying the restore:

```bash
rm world-cup-predictor.archive.gz
```

## 17. Create or Restore the Admin User

Register the desired account through the public registration page.

Open MongoDB:

```bash
set -a
. ./.env.production
set +a

docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  exec mongo mongosh \
    --username "$MONGO_ROOT_USERNAME" \
    --password "$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    "$MONGODB_DB"
```

Set the admin flag:

```javascript
db.users.updateMany({}, { $set: { isAdmin: false } })

db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { isAdmin: true } }
)
```

Confirm:

```javascript
db.users.find({}, { name: 1, email: 1, isAdmin: 1 })
```

Exit:

```javascript
exit
```

Log out and log in again in the application.

## 18. Access Prometheus Securely

Prometheus is intentionally not public.

Create an SSH tunnel from your computer:

```powershell
ssh -i C:\path\to\azure-key.pem `
  -L 9090:127.0.0.1:9090 `
  azureuser@<public-ip>
```

The VM currently does not publish the Prometheus container port to its loopback interface. Add this temporary binding to the `prometheus` service when direct Prometheus UI access is required:

```yaml
ports:
  - "127.0.0.1:9090:9090"
```

Recreate Prometheus:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  up -d prometheus
```

Then open locally:

```text
http://127.0.0.1:9090
```

The application admin page already provides its own protected Metrics tab, so direct Prometheus access is usually unnecessary.

## 19. Database Backups

Create a backup directory:

```bash
mkdir -p /opt/world-cup-predictor/backups
chmod 700 /opt/world-cup-predictor/backups
```

Create a backup script:

```bash
nano /opt/world-cup-predictor/backup-mongo.sh
```

Use:

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /opt/world-cup-predictor
set -a
. ./.env.production
set +a

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="backups/world-cup-predictor-${timestamp}.archive.gz"

docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  exec -T mongo mongodump \
    --username "$MONGO_ROOT_USERNAME" \
    --password "$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --db "$MONGODB_DB" \
    --archive \
    --gzip > "$output"

find backups -type f -name "*.archive.gz" -mtime +14 -delete
```

Make it executable:

```bash
chmod 700 backup-mongo.sh
```

Test it:

```bash
./backup-mongo.sh
ls -lh backups
```

Schedule it daily:

```bash
crontab -e
```

Add:

```cron
30 2 * * * /opt/world-cup-predictor/backup-mongo.sh >> /opt/world-cup-predictor/backups/backup.log 2>&1
```

For meaningful disaster recovery, copy backups off the VM to Azure Blob Storage or another machine. A backup stored only on the same VM does not protect against VM or disk loss.

## 20. Azure Disk Protection

For stronger persistence:

1. Attach a Standard SSD managed data disk.
2. Mount it using its filesystem UUID.
3. Store Docker data or database backups on that disk.
4. Create periodic Azure managed-disk snapshots.

Snapshots are point-in-time disk copies and should complement, not replace, MongoDB logical backups.

## 21. Deploy Application Updates

SSH to the VM:

```bash
cd /opt/world-cup-predictor
git pull --ff-only
```

Validate:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  config --quiet
```

Rebuild:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  up --build -d
```

Check:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  ps

docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  logs --tail 100 app
```

## 22. Roll Back an Application Update

Find the previous commit:

```bash
git log --oneline -10
```

Check it out:

```bash
git checkout <previous-commit>
```

Rebuild:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  up --build -d
```

Return to the deployment branch later:

```bash
git checkout master
```

Do not restore an old MongoDB backup unless a database migration or data corruption requires it.

## 23. Security Checklist

- [ ] `NODE_ENV=production`
- [ ] Strong and unique `AUTH_SECRET`
- [ ] Strong MongoDB username and password
- [ ] `.env.production` permissions set to `600`
- [ ] SSH key authentication enabled
- [ ] SSH restricted to your public IP
- [ ] Ports `80` and `443` publicly accessible
- [ ] Ports `8000`, `9090`, and `27017` not publicly accessible
- [ ] HTTPS certificate valid
- [ ] Only the intended database user has `isAdmin: true`
- [ ] Football API token is not committed to Git
- [ ] Backups tested
- [ ] VM and Docker images updated regularly

## 24. Cost Controls

For educational use:

1. Enable Azure VM auto-shutdown if the application does not need to run continuously.
2. Remember that auto-shutdown does not automatically start the VM the next morning.
3. Configure an Azure budget and cost alert.
4. Use Standard SSD instead of Premium SSD.
5. Stop and deallocate the VM when it is not needed.
6. Delete the entire resource group after the educational project ends.

Stopping the operating system from inside Ubuntu is not always sufficient to stop compute billing. Confirm the VM shows **Stopped (deallocated)** in Azure.

## 25. Troubleshooting

### Application returns 502

Check:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  ps

docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  logs --tail 100 app caddy
```

### Application cannot connect to MongoDB

Check:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  logs --tail 100 mongo app
```

Confirm that `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`, and `MONGODB_DB` are present in `.env.production`.

### HTTPS certificate is not issued

Confirm:

- DNS resolves to the correct Azure public IP.
- Azure NSG allows TCP `80` and `443`.
- Caddy is running.
- No other service is bound to ports `80` or `443`.

Inspect:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  logs --tail 200 caddy
```

### Prometheus target is down

Confirm that the application produces metrics:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  exec app wget -qO- http://127.0.0.1:8000/metrics | head
```

Then check Prometheus logs:

```bash
docker compose \
  --env-file .env.production \
  -f compose.azure.yaml \
  logs --tail 100 prometheus
```

### Disk is full

Check:

```bash
df -h
docker system df
du -sh /var/lib/docker/*
```

Do not run destructive Docker cleanup commands until database volumes and backups have been verified.

## 26. Final Acceptance Checklist

- [ ] Public URL opens over HTTPS.
- [ ] HTTP redirects to HTTPS.
- [ ] Registration and login work.
- [ ] Existing MongoDB data has been restored if required.
- [ ] Exactly one intended user has admin access.
- [ ] Predictions are stored after page refresh.
- [ ] Predictions lock after kickoff.
- [ ] Football match synchronization works.
- [ ] Admin user and prediction views work.
- [ ] Admin Metrics dashboard loads.
- [ ] Prometheus successfully scrapes `/metrics`.
- [ ] Public requests to `/metrics` return `404`.
- [ ] MongoDB is not reachable from the public internet.
- [ ] Prometheus is not reachable from the public internet.
- [ ] Backup creation and restoration have been tested.
- [ ] Azure cost alerts are configured.

## References

- [Create a Linux VM in the Azure Portal](https://learn.microsoft.com/azure/virtual-machines/linux/quick-create-portal)
- [Connect to an Azure Linux VM](https://learn.microsoft.com/azure/virtual-machines/linux-vm-connect)
- [Use SSH keys with Azure Linux VMs](https://learn.microsoft.com/azure/virtual-machines/linux/ssh-from-windows)
- [Azure DNS zones and records](https://learn.microsoft.com/azure/dns/dns-zones-records)
- [Attach a data disk to a Linux VM](https://learn.microsoft.com/azure/virtual-machines/linux/attach-disk-portal)
- [Create an Azure managed-disk snapshot](https://learn.microsoft.com/azure/virtual-machines/snapshot-copy-managed-disk)
- [Configure Azure VM auto-shutdown](https://learn.microsoft.com/azure/virtual-machines/auto-shutdown-vm)
- [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Install the Docker Compose plugin](https://docs.docker.com/compose/install/linux/)
- [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/)
- [MongoDB mongodump](https://www.mongodb.com/docs/database-tools/mongodump/)
- [MongoDB mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/)
