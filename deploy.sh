#!/bin/bash
# Deploy Depot Flow Dashboard on Koyeb using Dockerfile

APP_NAME="depot-flow-dashboard"
REPO="github.com/jasonolh/Depot_Flow_Dashboard"

echo "🚀 Deploying $APP_NAME from $REPO (branch main)"

koyeb service update $APP_NAME   --git $REPO   --branch main   --dockerfile Dockerfile   --context backend   --name api   --port 8080   --env NAVIXY_API_URL=https://api.eu.navixy.com/v2   --env NAVIXY_API_KEY=$NAVIXY_API_KEY   --env CACHE_INTERVAL=30
