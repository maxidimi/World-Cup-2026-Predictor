@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Public container image, normally the latest GHCR image.')
param containerImage string

@description('Container App name.')
param containerAppName string = 'world-cup-predictor'

@description('MongoDB database name used by the application.')
param databaseName string = 'world_cup_predictor'

@secure()
@description('Long random value used to sign authentication tokens.')
param authSecret string

@secure()
@description('football-data.org API token.')
param footballDataToken string

@description('Minutes between automatic football-data.org refreshes.')
@minValue(1)
param matchSyncIntervalMinutes int = 5

var resourceSuffix = uniqueString(subscription().subscriptionId, resourceGroup().id)
var environmentName = '${containerAppName}-env'
var cosmosAccountName = 'wcp${take(toLower(replace('${containerAppName}-${resourceSuffix}', '_', '-')), 41)}'

resource containerEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  properties: {}
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosAccountName
  location: location
  kind: 'MongoDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableFreeTier: true
    publicNetworkAccess: 'Enabled'
    minimalTlsVersion: 'Tls12'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      {
        name: 'EnableMongo'
      }
    ]
    apiProperties: {
      serverVersion: '4.2'
    }
  }
}

resource mongoDatabase 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
    options: {
      throughput: 400
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  properties: {
    managedEnvironmentId: containerEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'mongodb-uri'
          value: cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString
        }
        {
          name: 'auth-secret'
          value: authSecret
        }
        {
          name: 'football-data-token'
          value: footballDataToken
        }
      ]
    }
    template: {
      terminationGracePeriodSeconds: 15
      containers: [
        {
          name: 'web'
          image: containerImage
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'HOST'
              value: '0.0.0.0'
            }
            {
              name: 'PORT'
              value: '8000'
            }
            {
              name: 'MONGODB_URI'
              secretRef: 'mongodb-uri'
            }
            {
              name: 'MONGODB_DB'
              value: databaseName
            }
            {
              name: 'AUTH_SECRET'
              secretRef: 'auth-secret'
            }
            {
              name: 'FOOTBALL_DATA_TOKEN'
              secretRef: 'football-data-token'
            }
            {
              name: 'MATCH_SYNC_INTERVAL_MINUTES'
              value: string(matchSyncIntervalMinutes)
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/healthz'
                port: 8000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 2
              periodSeconds: 3
              timeoutSeconds: 2
              failureThreshold: 20
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/healthz'
                port: 8000
                scheme: 'HTTP'
              }
              periodSeconds: 30
              timeoutSeconds: 3
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/readyz'
                port: 8000
                scheme: 'HTTP'
              }
              periodSeconds: 15
              timeoutSeconds: 5
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
        rules: [
          {
            name: 'http-requests'
            http: {
              metadata: {
                concurrentRequests: '20'
              }
            }
          }
        ]
      }
    }
  }
  dependsOn: [
    mongoDatabase
  ]
}

output applicationUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output containerAppName string = containerApp.name
output cosmosAccountName string = cosmosAccount.name
