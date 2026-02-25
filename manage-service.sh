#!/bin/bash

# DiagramTool Service Management Script
# Usage: ./manage-service.sh [install|uninstall|start|stop|restart|status]

set -e

SERVICE_NAME="diagram-tool"
SERVICE_FILE="/home/jack/.openclaw/workspace/diagram-tool/diagram-tool.service"
SYSTEM_SERVICE="/etc/systemd/system/${SERVICE_NAME}.service"

case "$1" in
    install)
        echo "📦 Installing DiagramTool service..."
        sudo cp "$SERVICE_FILE" "$SYSTEM_SERVICE"
        sudo systemctl daemon-reload
        sudo systemctl enable ${SERVICE_NAME}
        echo "✅ Service installed and enabled"
        echo "🚀 Run 'sudo systemctl start ${SERVICE_NAME}' to start the service"
        ;;
    
    uninstall)
        echo "🗑️  Uninstalling DiagramTool service..."
        sudo systemctl stop ${SERVICE_NAME} 2>/dev/null || true
        sudo systemctl disable ${SERVICE_NAME} 2>/dev/null || true
        sudo rm -f "$SYSTEM_SERVICE"
        sudo systemctl daemon-reload
        echo "✅ Service uninstalled"
        ;;
    
    start)
        echo "🚀 Starting DiagramTool service..."
        sudo systemctl start ${SERVICE_NAME}
        sudo systemctl status ${SERVICE_NAME} --no-pager
        ;;
    
    stop)
        echo "🛑 Stopping DiagramTool service..."
        sudo systemctl stop ${SERVICE_NAME}
        echo "✅ Service stopped"
        ;;
    
    restart)
        echo "🔄 Restarting DiagramTool service..."
        sudo systemctl restart ${SERVICE_NAME}
        sudo systemctl status ${SERVICE_NAME} --no-pager
        ;;
    
    status)
        sudo systemctl status ${SERVICE_NAME} --no-pager
        ;;
    
    logs)
        echo "📋 Showing logs (Ctrl+C to exit)..."
        sudo journalctl -u ${SERVICE_NAME} -f
        ;;
    
    *)
        echo "Usage: $0 {install|uninstall|start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  install   - Install as systemd service"
        echo "  uninstall - Remove systemd service"
        echo "  start     - Start the service"
        echo "  stop      - Stop the service"
        echo "  restart   - Restart the service"
        echo "  status    - Check service status"
        echo "  logs      - View service logs"
        exit 1
        ;;
esac
