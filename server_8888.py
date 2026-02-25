#!/usr/bin/env python3
import http.server
import socketserver
import os
from pathlib import Path

PORT = 8888
# Point to the dist folder (standard for Vite apps)
DIRECTORY = str(Path(__file__).parent / "dist")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

if __name__ == "__main__":
    if not os.path.exists(DIRECTORY):
        print(f"⚠️ Warning: {DIRECTORY} not found. Did you run 'npm run build'?")
        os.makedirs(DIRECTORY, exist_ok=True)
        
    os.chdir(DIRECTORY)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"📐 External DiagramTool Server running on port {PORT}")
        httpd.serve_forever()
