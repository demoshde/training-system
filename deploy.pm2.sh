#!/bin/bash
#
# Production deploy for training.outboundlogistic.com
#
# The live server does NOT use Docker. The frontend is static files served by the
# host (CloudPanel) nginx from client/dist, and the API runs under pm2.
# This script pulls the latest code, rebuilds the frontend, and reloads the API.
#
# Usage (on the VPS):
#   cd /root/training-mern && ./deploy.pm2.sh
#
# Optional overrides:
#   BRANCH=main PM2_APP=training-server API_PORT=3001 ./deploy.pm2.sh

set -euo pipefail

BRANCH="${BRANCH:-main}"
PM2_APP="${PM2_APP:-training-server}"
API_PORT="${API_PORT:-3001}"

# Always operate from the repo this script lives in
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Deploying $(basename "$SCRIPT_DIR")  (branch: $BRANCH, pm2 app: $PM2_APP)"
echo "================================================================"

echo "1/4  Pulling latest code..."
# A deploy server should mirror origin exactly. dist/ and node_modules/ are
# gitignored, so a hard reset only discards stray tracked-file drift (e.g. lockfile).
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
echo "     now at: $(git log --oneline -1)"

echo "2/4  Building frontend (client/dist)..."
cd client
npm install --no-audit --no-fund
npm run build
cd ..

echo "3/4  Reloading API via pm2 ($PM2_APP)..."
pm2 restart "$PM2_APP" --update-env
pm2 save

echo "4/4  Verifying API on port $API_PORT..."
sleep 2
CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  "http://127.0.0.1:${API_PORT}/api/pvt/tests/guest" \
  -H 'Content-Type: application/json' -d '{}' || echo 000)"
if [ "$CODE" = "400" ] || [ "$CODE" = "201" ]; then
  echo "     API responding (HTTP $CODE) ✅"
else
  echo "     ⚠️  API check returned HTTP $CODE — inspect: pm2 logs $PM2_APP"
fi

echo "================================================================"
echo "✅ Deploy complete."
echo "   Logs:    pm2 logs $PM2_APP"
echo "   Status:  pm2 status"
