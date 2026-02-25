# 🚀 Quick Start - Install DiagramTool

## One Command Installation

Run this single command to install everything (service + E2E test dependencies):

```bash
cd /home/jack/.openclaw/workspace/diagram-tool && sudo ./install-all.sh
```

That's it! The script will:
1. ✅ Install Playwright system dependencies for E2E tests
2. ✅ Install the DiagramTool as a systemd service
3. ✅ Start the service automatically
4. ✅ Configure it to start on boot

---

## After Installation

### Access the Application
Open your browser to: **http://localhost:8888**

### Service Management
```bash
# Check status
sudo systemctl status diagram-tool

# View logs
sudo journalctl -u diagram-tool -f

# Restart
sudo systemctl restart diagram-tool

# Stop
sudo systemctl stop diagram-tool
```

### Run E2E Tests
```bash
cd /home/jack/.openclaw/workspace/diagram-tool
npm run test:e2e
```

---

## Need Help?

- **Detailed guide:** See [INSTALL-GUIDE.md](./INSTALL-GUIDE.md)
- **Deployment:** See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **QA results:** See [QA-REPORT.md](./QA-REPORT.md)

---

## What's Installed

| Component | Location | Status |
|-----------|----------|--------|
| Application | `/home/jack/.openclaw/workspace/diagram-tool/dist/` | ✅ Built |
| Service | `/etc/systemd/system/diagram-tool.service` | ⏳ Pending install |
| E2E Browsers | `~/.cache/ms-playwright/` | ⏳ Pending install |
| System Dependencies | Various (libatk, etc.) | ⏳ Pending install |

Run the installation command above to complete setup!
