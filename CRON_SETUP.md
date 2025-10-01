# Server Setup Guide - DigitalOcean Ubuntu

## 1. Initial Server Setup

SSH into your server:
```bash
ssh username@your-server-ip
```

### Install Node.js (using nvm)
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell
source ~/.bashrc

# Install Node.js (LTS)
nvm install --lts
nvm use --lts

# Verify
node --version
npm --version
```

### Install build tools (needed for better-sqlite3)
```bash
apt update
apt install -y build-essential python3
```

---

## 2. Deploy Your Code

### Option A: Clone from GitHub
```bash
cd ~
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

### Option B: Upload via SCP
From your local machine:
```bash
scp -r /path/to/your/project root@your-server-ip:~/windborne
```

---

## 3. Install Dependencies

```bash
cd ~/windborne
npm install
```

---

## 4. Setup Environment Variables

Create `.env` file:
```bash
nano .env
```

Add your variables:
```env
BASE_URL=https://a.windbornesystems.com/treasure
FETCHED_DIR=fetchedDataFiles
CURRENT_DIR=current
ARCHIVE_DIR=archive
GITHUB_TOKEN=your_github_token_here
GITHUB_USERNAME=your_username
GITHUB_REPO=your_repo_name
```

Save and exit (Ctrl+X, Y, Enter)

---

## 5. Initialize Database (One-time)

```bash
npm run init-db
```

Verify it worked:
```bash
ls -la database/
# Should see geocache.db
```

---

## 6. Test the Workflow

Run manually to ensure everything works:
```bash
node index.js
```

This should:
- Download 24 files
- Process 00.json and 23.json
- Create processed.json
- Push to GitHub

---

## 7. Setup Cron Job

Edit crontab:
```bash
crontab -e
```

Add this line to run every hour at minute 5:
```cron
5 * * * * cd /root/windborne && /root/.nvm/versions/node/v20.*/bin/node index.js >> /root/windborne/logs/cron.log 2>&1
```

**Explanation:**
- `5 * * * *` = Run at 5 minutes past every hour
- `cd /root/windborne` = Navigate to project directory
- `/root/.nvm/versions/node/v20.*/bin/node` = Full path to node (cron needs absolute paths)
- `index.js` = Your script
- `>> logs/cron.log 2>&1` = Log output to file

### Create logs directory:
```bash
mkdir -p ~/windborne/logs
```

### Find your exact Node path:
```bash
which node
# Use this path in your crontab
```

---

## 8. Alternative: Run at Specific Time

If you want to run at specific times (e.g., every hour on the hour):
```cron
0 * * * * cd /root/windborne && /root/.nvm/versions/node/v20.*/bin/node index.js >> /root/windborne/logs/cron.log 2>&1
```

Or twice daily (midnight and noon):
```cron
0 0,12 * * * cd /root/windborne && /root/.nvm/versions/node/v20.*/bin/node index.js >> /root/windborne/logs/cron.log 2>&1
```

---

## 9. Monitor Cron Jobs

### View cron log:
```bash
tail -f ~/windborne/logs/cron.log
```

### Check if cron is running:
```bash
grep CRON /var/log/syslog
```

### List current cron jobs:
```bash
crontab -l
```

---

## 10. Troubleshooting

### Cron not running?
Check system cron service:
```bash
systemctl status cron
systemctl start cron
```

### Permission issues?
Ensure script is executable:
```bash
chmod +x ~/windborne/index.js
```

### Database locked?
If you get "database is locked" errors:
```bash
# Close any hanging connections
pkill node
```

### Check disk space (1GB server):
```bash
df -h
du -sh ~/windborne/*
```

### Rotate logs to prevent filling disk:
```bash
# Add to crontab to rotate logs weekly
0 0 * * 0 cd /root/windborne/logs && mv cron.log cron.log.old && touch cron.log
```

---

## 11. Memory Optimization (1GB Server)

Add to the top of your crontab:
```bash
# Limit Node.js memory usage
NODE_OPTIONS="--max-old-space-size=512"
```

Full crontab line:
```cron
5 * * * * cd /root/windborne && NODE_OPTIONS="--max-old-space-size=512" /root/.nvm/versions/node/v20.*/bin/node index.js >> /root/windborne/logs/cron.log 2>&1
```

---

## 12. Cloudflare Worker Setup

Your Cloudflare Worker should fetch from GitHub and cache:

```javascript
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/fetchedDataFiles/processed.json';
const CACHE_TTL = 3600; // 60 minutes

async function handleRequest(request) {
  const cache = caches.default;
  let response = await cache.match(request);

  if (!response) {
    response = await fetch(GITHUB_RAW_URL);
    response = new Response(response.body, response);
    response.headers.set('Cache-Control', `s-maxage=${CACHE_TTL}`);
    response.headers.set('Access-Control-Allow-Origin', '*');
    await cache.put(request, response.clone());
  }

  return response;
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
```

---

## Quick Reference

```bash
# SSH to server
ssh root@your-server-ip

# Check if cron job ran recently
tail -20 ~/windborne/logs/cron.log

# Run manually
cd ~/windborne && node index.js

# Check database size
ls -lh ~/windborne/database/geocache.db

# Check processed file
cat ~/windborne/fetchedDataFiles/processed.json | head -50
```

---

## Success Checklist

- [ ] Node.js installed
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` configured
- [ ] Database initialized (`npm run init-db`)
- [ ] Manual test successful (`node index.js`)
- [ ] Cron job added (`crontab -e`)
- [ ] Logs directory created
- [ ] First cron run verified (check logs)
- [ ] Cloudflare Worker configured
- [ ] Frontend receiving data