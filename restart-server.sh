#!/bin/bash
pkill -f "python3 server_8888.py" 2>/dev/null || true
sleep 1
cd /home/jack/.openclaw/workspace/diagram-tool
nohup python3 server_8888.py > /tmp/diagram-server.log 2>&1 &
sleep 2
echo "Server restarted on port 8888"
