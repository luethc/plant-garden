#!/usr/bin/env bash
# Push the latest app to GitHub Pages. Usage: ./deploy.sh "what changed"
set -e
MSG="${1:-update my garden}"
git add -A
git commit -m "$MSG" || { echo "Nothing to commit."; exit 0; }
git push
echo "Pushed. GitHub Pages will rebuild in ~1 min. Reopen the app on your phone (while online) to get it."
