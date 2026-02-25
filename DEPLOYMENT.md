# Deployment Guide - DiagramTool

Quick deployment guide for production environments.

## Prerequisites

- Node.js 18+ 
- Python 3.x (for production server)
- Systemd (for service management)

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/leejpjack-hue/diagram-tool.git
cd diagram-tool

# 2. Install dependencies
npm install

# 3. Build for production
npm run build

# 4. Test the build locally
python3 server_8888.py
# Open http://localhost:8888 in browser

# 5. If everything works, install as service
./manage-service.sh install
./manage-service.sh start
```

## Service Management

```bash
# Check status
./manage-service.sh status

# View logs
./manage-service.sh logs

# Restart service
./manage-service.sh restart

# Stop service
./manage-service.sh stop

# Uninstall service
./manage-service.sh uninstall
```

## Development Mode

For development with hot reload:

```bash
npm run dev
# Opens at http://localhost:5173
```

## Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# E2E tests (requires browser dependencies)
npm run test:e2e
```

## Troubleshooting

### Service won't start
```bash
# Check logs
journalctl -u diagram-tool -n 50

# Verify build exists
ls -la dist/

# Test manually
python3 server_8888.py
```

### Port 8888 already in use
```bash
# Find process using port
sudo lsof -i :8888

# Kill process if needed
sudo kill -9 <PID>
```

### Permission denied
```bash
# Make sure script is executable
chmod +x manage-service.sh

# Check file ownership
ls -la manage-service.sh
```

## Configuration

### Change Port
Edit `server_8888.py`:
```python
PORT = 9000  # Change from 8888 to desired port
```

### Change User
Edit `diagram-tool.service`:
```ini
User=your-username
```

### Change Working Directory
Edit `diagram-tool.service`:
```ini
WorkingDirectory=/path/to/diagram-tool
ExecStart=/usr/bin/python3 /path/to/diagram-tool/server_8888.py
```

## Security Recommendations

1. **Run behind reverse proxy** (nginx, Apache)
2. **Enable HTTPS** with SSL certificates
3. **Firewall configuration** - only expose necessary ports
4. **Regular updates** - keep dependencies updated
5. **Run as non-root user** (already configured)

## Example Nginx Configuration

```nginx
server {
    listen 80;
    server_name diagram.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Monitoring

```bash
# Watch service status
watch -n 1 systemctl status diagram-tool

# Monitor logs in real-time
journalctl -u diagram-tool -f

# Check resource usage
systemctl show diagram-tool
```

## Backup Strategy

```bash
# Backup diagram data (stored in localStorage on client)
# For server backup:
tar -czf diagram-tool-backup-$(date +%Y%m%d).tar.gz \
  diagram-tool/dist/ \
  diagram-tool/package.json \
  diagram-tool/server_8888.py
```

## Updates

```bash
# Pull latest changes
git pull origin main

# Reinstall dependencies if needed
npm install

# Rebuild
npm run build

# Restart service
./manage-service.sh restart
```

---

For detailed QA results, see [QA-REPORT.md](./QA-REPORT.md)
