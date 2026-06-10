param(
  [string]$SubscriptionId = "",
  [string]$ResourceGroup = "world-cup-predictor-rg",
  [string]$Location = "westeurope",
  [string]$ContainerAppName = "world-cup-predictor",
  [string]$ContainerImage = "ghcr.io/maxidimi/world-cup-2026-predictor:latest"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  throw "Azure CLI is required. Install it from https://aka.ms/installazurecliwindows"
}

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $separator = $line.IndexOf("=")
    if ($separator -lt 1) { return }
    $name = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim().Trim('"').Trim("'")
    if (-not [Environment]::GetEnvironmentVariable($name, "Process")) {
      [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }
}

if (-not $env:AUTH_SECRET -or $env:AUTH_SECRET.Length -lt 32) {
  throw "Set AUTH_SECRET in .env to a random value of at least 32 characters."
}
if (-not $env:FOOTBALL_DATA_TOKEN) {
  throw "Set FOOTBALL_DATA_TOKEN in .env before deploying."
}

if ($SubscriptionId) {
  az account set --subscription $SubscriptionId
}

az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.DocumentDB --wait
az group create --name $ResourceGroup --location $Location --output none

$deployment = az deployment group create `
  --resource-group $ResourceGroup `
  --template-file (Join-Path $root "infra\main.bicep") `
  --parameters `
    location=$Location `
    containerAppName=$ContainerAppName `
    containerImage=$ContainerImage `
    authSecret=$env:AUTH_SECRET `
    footballDataToken=$env:FOOTBALL_DATA_TOKEN `
  --query "properties.outputs" `
  --output json

if ($LASTEXITCODE -ne 0) {
  $failedOperations = az deployment operation group list `
    --resource-group $ResourceGroup `
    --name main `
    --query "[?properties.provisioningState=='Failed'].properties.statusMessage.error.message" `
    --output tsv 2>$null

  if ($failedOperations -match "CapacityHeavyUsage|heavy usage") {
    throw "Azure has no Container Apps capacity in '$Location' right now. Retry later, or remove the failed resource group and deploy in another region such as northeurope."
  }
  throw "Azure deployment failed. Review the deployment named 'main' in resource group '$ResourceGroup'."
}

$outputs = $deployment | ConvertFrom-Json
Write-Host ""
Write-Host "Deployment complete."
Write-Host "Application: $($outputs.applicationUrl.value)"
Write-Host "Container App: $($outputs.containerAppName.value)"
Write-Host "Cosmos DB account: $($outputs.cosmosAccountName.value)"
