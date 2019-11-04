#!/bin/ash
# shellcheck shell=dash

echo ==============================
echo Starting Zeebe Cloud Canary at "$(date)"
# To handle 'not get uid/gid'
# See: https://stackoverflow.com/questions/52196518/could-not-get-uid-gid-when-building-node-docker
npm config set unsafe-perm true
# Start the endpoint
cd /server/
npm i
npm rebuild
npm run compile
cd scripts
node index.js | pino-pretty
