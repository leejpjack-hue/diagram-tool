#!/bin/bash

# Complete Installation Script for DiagramTool
# This script installs both the service and E2E test dependencies
# Run with: sudo ./install-all.sh

set -e

echo "========================================="
echo "  DiagramTool Complete Installation"
echo "========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root: sudo ./install-all.sh"
    exit 1
fi

# Get the actual user (even when run with sudo)
ACTUAL_USER=${SUDO_USER:-$USER}
ACTUAL_HOME=$(getent passwd "$ACTUAL_USER" | cut -d: -f6)
PROJECT_DIR="$ACTUAL_HOME/.openclaw/workspace/diagram-tool"

echo "📁 Project directory: $PROJECT_DIR"
echo "👤 Installing for user: $ACTUAL_USER"
echo ""

# Step 1: Install Playwright system dependencies
echo "📦 Step 1: Installing E2E test dependencies..."
echo ""
cd "$PROJECT_DIR"

# Install Playwright browser dependencies
su - "$ACTUAL_USER" -c "cd '$PROJECT_DIR' && npx playwright install-deps chromium" || {
    echo "⚠️  Playwright dependencies installation had issues, continuing..."
}

echo ""
echo "✅ E2E dependencies installed"
echo ""

# Step 2: Install systemd service
echo "⚙️  Step 2: Installing DiagramTool service..."
echo ""

SERVICE_NAME="diagram-tool"
SERVICE_FILE="$PROJECT_DIR/diagram-tool.service"
SYSTEM_SERVICE="/etc/systemd/system/${SERVICE_NAME}.service"

# Copy service file
cp "$SERVICE_FILE" "$SYSTEM_SERVICE"

# Update service file with correct user
sed -i "s/User=jack/User=$ACTUAL_USER/g" "$SYSTEM_SERVICE"
sed -i "s|WorkingDirectory=.*|WorkingDirectory=$PROJECT_DIR|g" "$SYSTEM_SERVICE"
sed -i "s|ExecStart=.*|ExecStart=/usr/bin/python3 $PROJECT_DIR/server_8888.py|g" "$SYSTEM_SERVICE"

# Reload systemd
systemctl daemon-reload

# Enable service
systemctl enable ${SERVICE_NAME}

echo "✅ Service installed and enabled"
echo ""

# Step 3: Start the service
echo "🚀 Step 3: Starting DiagramTool service..."
echo ""

systemctl start ${SERVICE_NAME}
sleep 2

# Check status
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo "✅ Service is running!"
    echo ""
    systemctl status ${SERVICE_NAME} --no-pager
else
    echo "❌ Service failed to start. Check logs:"
    echo "   sudo journalctl -u ${SERVICE_NAME} -n 50"
fi

echo ""
echo "========================================="
echo "  Installation Complete!"
echo "========================================="
echo ""
echo "📊 Access the application at: http://localhost:8888"
echo ""
echo "📝 Useful commands:"
echo "   Check status:  sudo systemctl status ${SERVICE_NAME}"
echo "   View logs:     sudo journalctl -u ${SERVICE_NAME} -f"
echo "   Restart:       sudo systemctl restart ${SERVICE_NAME}"
echo "   Stop:          sudo systemctl stop ${SERVICE_NAME}"
echo ""
echo "🧪 Run E2E tests:"
echo "   cd $PROJECT_DIR"
echo "   npm run test:e2e"
echo ""
