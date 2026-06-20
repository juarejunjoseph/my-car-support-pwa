# My Car Support PWA

A static, offline-first vehicle monitoring app built with HTML, CSS, and JavaScript.

## Features
- Live GPS speedometer and automatic distance tracking
- Fuel entries and estimated remaining fuel
- Trip and odometer monitoring
- Maintenance records and reminders
- Vehicle issue log
- JSON backup and restore
- Installable PWA
- Local browser storage
- Netlify-ready

## Run locally
Use VS Code Live Server or any static server.

## GitHub
```bash
git init
git add .
git commit -m "Initial My Car Support PWA"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

## Netlify
1. Push the project to GitHub.
2. In Netlify, choose **Add new site > Import an existing project**.
3. Select the repository.
4. Build command: leave blank.
5. Publish directory: `.`

## Important
Data is stored only in the browser through localStorage. Use **Settings > Export JSON Backup** regularly.

## GPS dashboard
Deploy through HTTPS on Netlify. Open **Drive**, mount the phone securely, tap **Start Drive**, and allow precise location access. Keep the app visible for more reliable updates.
