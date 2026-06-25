# Deploy "My Garden" to GitHub Pages (same URL every update)

This publishes the app to a stable https URL like `https://YOURNAME.github.io/plant-garden/`.
After this one-time setup, **every future tweak is just `./deploy.sh`** — same URL, your phone picks it up on next open.

## ⚠️ First: revoke the token you pasted in chat
Pasting a personal access token exposes it. Go to **GitHub → Settings → Developer settings → Personal access tokens** and **delete** that token now. We never need a pasted token — `gh` logs you in securely.

## One-time setup (run in this folder)
```bash
cd "Plants/PlantApp"

# 1. Log in to GitHub securely (opens a browser; no token pasting)
gh auth login

# 2. Create the repo and push (public is required for free Pages)
gh repo create plant-garden --public --source=. --push

# 3. Turn on GitHub Pages from the main branch
gh api -X POST "repos/{owner}/plant-garden/pages" -f "source[branch]=main" -f "source[path]=/" 2>/dev/null \
  || echo "If that errored, enable it in the web UI: repo → Settings → Pages → Source: main /(root)"
```
Your app will be live in ~1 minute at: **https://YOURNAME.github.io/plant-garden/**
Open it on your phone → Share → **Add to Home Screen**.

## Every time you (or Claude) tweak the app
```bash
./deploy.sh "what changed"
```
That commits and pushes; Pages rebuilds automatically. On your phone, just reopen the app — the new version loads when you're online (the service worker is network-first), your plant data is untouched.

## Notes
- **Public repo:** the *code* is public, but it has no personal data — your watering dates, notes, and photos live only on your phone, never in the repo.
- Want it private instead? Private repos can use Pages on paid plans, or use Netlify/Cloudflare Pages (free private). Ask Claude to set that up instead.
