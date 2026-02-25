# Manual Installation Guide

If you prefer to install manually or the automated script doesn't work, follow these steps:

## Option 1: Automated Installation (Recommended)

```bash
cd /home/jack/.openclaw/workspace/diagram-tool
sudo ./install-all.sh
```

This will install everything automatically.

---

## Option 2: Manual Step-by-Step Installation

### Step 1: Install E2E Test Dependencies

```bash
cd /home/jack/.openclaw/workspace/diagram-tool

# Install Playwright system dependencies
sudo npx playwright install-deps chromium
```

This installs these system packages:
- libatk1.0-0
- libatk-bridge2.0-0
- libcups2
- libdrm2
- libxkbcommon0
- libxcomposite1
- libxdamage1
- libxfixes3
- libxrandr2
- libgbm1
- libasound2
- And other Chromium dependencies

### Step 2: Install the Service

```bash
# Copy service file to systemd
sudo cp diagram-tool.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service (starts on boot)
sudo systemctl enable diagram-tool

# Start service now
sudo systemctl start diagram-tool

# Check status
sudo systemctl status diagram-tool
```

### Step 3: Verify Everything Works

```bash
# Test the application
curl http://localhost:8888

# Run E2E tests
npm run test:e2e
```

---

## Option 3: Quick Commands (Copy-Paste)

Just run all commands at once:

```bash
cd /home/jack/.openclaw/workspace/diagram-tool && \
sudo npx playwright install-deps chromium && \
sudo cp diagram-tool.service /etc/systemd/system/ && \
sudo systemctl daemon-reload && \
sudo systemctl enable diagram-tool && \
sudo systemctl start diagram-tool && \
sudo systemctl status diagram-tool
```

---

## Troubleshooting

### Service won't start
```bash
# Check detailed logs
sudo journalctl -u diagram-tool -n 100 --no-pager

# Check if port is in use
sudo lsof -i :8888

# Verify build exists
ls -la /home/jack/.openclaw/workspace/diagram-tool/dist/
```

### E2E tests still fail
```bash
# Reinstall Playwright browsers
npx playwright install chromium

# Check browser binary
ls -la ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome

# Test manually
npx playwright --version
```

### Permission issues
```bash
# Fix ownership
sudo chown -R jack:jack /home/jack/.openclaw/workspace/diagram-tool

# Make scripts executable
chmod +x /home/jack/.openclaw/workspace/diagram-tool/*.sh
```

---

## What Gets Installed

### Service
- **Location:** `/etc/systemd/system/diagram-tool.service`
- **User:** jack (runs as non-root)
- **Port:** 8888
- **Auto-start:** Yes (on boot)
- **Auto-restart:** Yes (on failure)

### E2E Dependencies
- **Browsers:** Chromium 145.x (in ~/.cache/ms-playwright/)
- **System libs:** ~50 packages for headless Chrome
- **Size:** ~280 MB total

---

## Verification Checklist

After installation, verify:

- [ ] Service is running: `sudo systemctl status diagram-tool`
- [ ] Application loads: Visit http://localhost:8888
- [ ] E2E tests work: `npm run test:e2e`
- [ ] Auto-start enabled: `sudo systemctl is-enabled diagram-tool`

---

## Uninstallation

To remove everything:

```bash
# Stop and disable service
sudo systemctl stop diagram-tool
sudo systemctl disable diagram-tool

# Remove service file
sudo rm /etc/systemd/system/diagram-tool.service

# Reload systemd
sudo systemctl daemon-reload

# (Optional) Remove Playwright browsers
rm -rf ~/.cache/ms-playwright/
```
