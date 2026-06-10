# Azure Deployment

This project is prepared for a low-cost Azure deployment using:

- Azure Container Apps Consumption with `0-1` replicas.
- Azure Cosmos DB for MongoDB with the lifetime free-tier discount.
- GitHub Container Registry instead of a paid Azure Container Registry.
- GitHub Actions for future image deployments.

The separate local Prometheus container is deliberately not deployed. The app still exposes `/metrics` and the protected admin metrics page.

## 1. Prerequisites

Install:

- Git
- Docker Desktop
- Azure CLI

You also need:

- An Azure subscription.
- This repository pushed to GitHub.
- A football-data.org token.

Sign in:

```powershell
az login
az account show
```

If you have more than one subscription:

```powershell
az account set --subscription "<subscription-id>"
```

## 2. Prepare Production Secrets

Keep `.env` out of Git. It must contain:

```text
AUTH_SECRET=<random-value-at-least-32-characters>
FOOTBALL_DATA_TOKEN=<football-data.org-token>
```

Generate an authentication secret:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

Do not reuse an account password as `AUTH_SECRET`.

## 3. Publish the Container Image

The included workflow builds:

```text
ghcr.io/maxidimi/world-cup-2026-predictor:latest
```

Push the repository to `master`. Then:

1. Open the GitHub repository.
2. Open **Actions** and confirm **Build and deploy** completed its build job.
3. Open the package from the repository or profile Packages section.
4. Open **Package settings**.
5. Change package visibility to **Public**.

Public visibility lets Container Apps pull the image without registry credentials or an Azure Container Registry.

If the repository owner or name changes, pass the corresponding lowercase GHCR image to the deployment script.

## 4. Deploy Azure Infrastructure

From the repository root:

```powershell
.\scripts\deploy-azure.ps1
```

Optional parameters:

```powershell
.\scripts\deploy-azure.ps1 `
  -SubscriptionId "<subscription-id>" `
  -ResourceGroup "world-cup-predictor-rg" `
  -Location "westeurope" `
  -ContainerAppName "world-cup-predictor" `
  -ContainerImage "ghcr.io/maxidimi/world-cup-2026-predictor:latest"
```

The script:

1. Registers the required Azure providers.
2. Creates the resource group.
3. Deploys the Bicep template in `infra/main.bicep`.
4. Creates a Cosmos DB MongoDB account with free tier enabled.
5. Creates the shared-throughput MongoDB database at 400 RU/s.
6. Creates the Container Apps environment and web app.
7. Adds application secrets without committing them.
8. Prints the HTTPS application URL.

Free tier must be selected when the Cosmos DB account is first created. Azure permits one free-tier Cosmos DB account per subscription.

## 5. Verify the Deployment

Open the URL printed by the script.

Health endpoints:

```text
https://<container-app-host>/healthz
https://<container-app-host>/readyz
```

Check application state:

```powershell
az containerapp show `
  --resource-group world-cup-predictor-rg `
  --name world-cup-predictor `
  --query properties.runningStatus
```

The first request after inactivity can take several seconds because the app scales from zero.

## 6. Configure Automatic Deployments

The GitHub workflow can deploy each push after the initial infrastructure exists. Use Azure workload identity federation instead of storing an Azure password.

Create an Entra application and service principal:

```powershell
$subscriptionId = az account show --query id -o tsv
$tenantId = az account show --query tenantId -o tsv
$app = az ad app create --display-name "world-cup-predictor-github" | ConvertFrom-Json
az ad sp create --id $app.appId
az role assignment create `
  --assignee $app.appId `
  --role "Contributor" `
  --scope "/subscriptions/$subscriptionId/resourceGroups/world-cup-predictor-rg"
```

Create `github-federated-credential.json` outside the repository, replacing the GitHub owner if needed:

```json
{
  "name": "github-master",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:maxidimi/World-Cup-2026-Predictor:ref:refs/heads/master",
  "description": "Deploy master to Azure Container Apps",
  "audiences": [
    "api://AzureADTokenExchange"
  ]
}
```

Create the credential:

```powershell
az ad app federated-credential create `
  --id $app.appId `
  --parameters "@github-federated-credential.json"
```

In GitHub, open **Settings > Secrets and variables > Actions**.

Add repository secrets:

```text
AZURE_CLIENT_ID=<app.appId>
AZURE_TENANT_ID=<tenant-id>
AZURE_SUBSCRIPTION_ID=<subscription-id>
```

Add repository variables:

```text
AZURE_RESOURCE_GROUP=world-cup-predictor-rg
AZURE_CONTAINER_APP_NAME=world-cup-predictor
```

After these values exist, every push to `master` builds a SHA-tagged image and updates the Container App.

## 7. Create the Administrator

Register the intended administrator through the app first.

Then open:

```text
Azure Portal > Cosmos DB account > Data Explorer
```

Find the user document in:

```text
world_cup_predictor > users
```

Change:

```json
"isAdmin": true
```

Keep every other user at `false`.

## 8. Import Existing Local Data

Install MongoDB Database Tools. Export the local database:

```powershell
mongodump `
  --uri "mongodb://127.0.0.1:27017/world_cup_predictor" `
  --archive="world-cup-predictor.archive"
```

Retrieve the Azure connection string securely:

```powershell
$account = az cosmosdb list `
  --resource-group world-cup-predictor-rg `
  --query "[0].name" -o tsv

$mongoUri = az cosmosdb keys list `
  --resource-group world-cup-predictor-rg `
  --name $account `
  --type connection-strings `
  --query "connectionStrings[0].connectionString" -o tsv
```

Restore:

```powershell
mongorestore `
  --uri $mongoUri `
  --nsFrom "world_cup_predictor.*" `
  --nsTo "world_cup_predictor.*" `
  --archive="world-cup-predictor.archive"
```

Delete the archive after confirming the data. Database exports can contain password hashes, emails, predictions, and reset records.

## 9. Operations

View revisions:

```powershell
az containerapp revision list `
  --resource-group world-cup-predictor-rg `
  --name world-cup-predictor `
  --output table
```

Update an application secret:

```powershell
az containerapp secret set `
  --resource-group world-cup-predictor-rg `
  --name world-cup-predictor `
  --secrets "football-data-token=<new-token>"
```

Restart by creating a new revision:

```powershell
az containerapp revision restart `
  --resource-group world-cup-predictor-rg `
  --name world-cup-predictor `
  --revision "<revision-name>"
```

Delete everything:

```powershell
az group delete `
  --name world-cup-predictor-rg `
  --yes
```

## 10. Cost Controls

- Keep Container Apps `minReplicas` at `0`.
- Keep `maxReplicas` at `1` for educational traffic.
- Keep Cosmos DB at 400 shared RU/s and below 25 GB.
- Do not create Azure Container Registry for this deployment.
- Do not deploy the separate Prometheus container.
- Add an Azure budget alert even when expecting a zero bill.
- Review the Azure Cost Analysis page after the first day and first month.

The automatic match sync is throttled by `MATCH_SYNC_INTERVAL_MINUTES`, defaulting to five minutes, so repeated page loads do not repeatedly rewrite all fixtures.

## Container Apps Regional Capacity Error

If deployment fails with `ManagedEnvironmentCapacityHeavyUsageError`, Azure temporarily has no Container Apps capacity in the selected region. This is not an application or template error.

If this was the first deployment and the database is still empty, remove the incomplete resource group:

```powershell
az group delete `
  --name world-cup-predictor-rg `
  --yes
```

Wait until deletion finishes:

```powershell
az group wait `
  --name world-cup-predictor-rg `
  --deleted
```

Then choose another nearby region:

```powershell
.\scripts\deploy-azure.ps1 -Location northeurope
```

Other nearby alternatives include `swedencentral`, `francecentral`, and `germanywestcentral`.

## Password Reset

Password reset requests are recorded for the administrator. The requester is instructed to contact the administrator, who can copy or regenerate the one-hour reset URL from the **Password resets** page in the admin dashboard.

Reset tokens are hashed for validation and separately encrypted for admin display. Each link is single-use. For a larger public deployment, replace this manual handoff with an email provider.
