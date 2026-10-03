#!/usr/bin/env python3
"""
kiosk/server.py - Kiosk Backend Server & API Controller
Lightweight, zero-dependency HTTP server handling the touchscreen UI,
capture orchestration, 300 DPI strip composition, and print spooling.
"""

from __future__ import annotations

import os
import sys
import json
import uuid
import mimetypes
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

# Add parent dir to import core modules
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from core.capture import CameraManager
from core.compositor import LayoutCompositor
from core.delivery import DeliveryManager
from core.printer import PrintSpooler

# Directory Paths
DATA_DIR = BASE_DIR / "data"
CAPTURES_DIR = DATA_DIR / "captures"
RENDERED_DIR = DATA_DIR / "rendered"
QR_DIR = DATA_DIR / "qrcodes"
GALLERY_DIR = DATA_DIR / "gallery"
CONFIG_FILE = BASE_DIR / "config" / "default_event.json"

# Initialize Core Services
camera = CameraManager(CAPTURES_DIR)
compositor = LayoutCompositor(RENDERED_DIR)
delivery = DeliveryManager(QR_DIR, GALLERY_DIR)
printer = PrintSpooler(dry_run=True)

# In-memory session tracking
active_sessions = {}

def load_event_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "title": "GALA PORTRAIT ATELIER",
        "date": "October 2026",
        "venue": "The Jefferson Hotel • Richmond, VA",
        "default_filter": "clean_color"
    }

class KioskHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Clean terminal logging
        sys.stdout.write(f"[Kiosk] {self.command} {self.path} - {args[1]}\n")

    def _send_json(self, data: dict, status: int = 200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _serve_file(self, filepath: Path):
        if not filepath.exists() or filepath.is_dir():
            self.send_error(404, "File Not Found")
            return
        mime, _ = mimetypes.guess_type(str(filepath))
        mime = mime or "application/octet-stream"
        
        with open(filepath, "rb") as f:
            content = f.read()

        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Root Kiosk App
        if path in ["/", "/index.html"]:
            self._serve_file(BASE_DIR / "kiosk" / "static" / "index.html")
            return

        # Static Assets
        if path.startswith("/static/"):
            rel_path = path.replace("/static/", "")
            self._serve_file(BASE_DIR / "kiosk" / "static" / rel_path)
            return

        # Data Assets (Rendered strips, QR codes)
        if path.startswith("/data/"):
            rel_path = path.replace("/data/", "")
            self._serve_file(DATA_DIR / rel_path)
            return

        # Mobile Guest Gallery Landing Page (/s/<session_id>)
        if path.startswith("/s/"):
            session_id = path.split("/s/")[1].strip("/")
            session_html = GALLERY_DIR / session_id / "index.html"
            if session_html.exists():
                self._serve_file(session_html)
                return
            else:
                self.send_error(404, "Session Not Found")
                return

        # API: Status
        if path == "/api/status":
            self._send_json({
                "status": "ready",
                "camera_connected": camera.is_hardware_ready,
                "printer_available": printer.is_hardware_available,
                "default_printer": printer.default_printer,
                "event": load_event_config()
            })
            return

        self.send_error(404, "Not Found")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length).decode("utf-8")) if length > 0 else {}

        # API: Start Session
        if path == "/api/start_session":
            session_id = f"SES-{uuid.uuid4().hex[:8].upper()}"
            active_sessions[session_id] = {
                "id": session_id,
                "filter": body.get("filter", "clean_color"),
                "frames": []
            }
            self._send_json({"session_id": session_id})
            return

        # API: Capture Single Pose
        if path == "/api/capture_pose":
            session_id = body.get("session_id")
            pose_idx = int(body.get("pose_idx", 1))
            if not session_id or session_id not in active_sessions:
                self._send_json({"error": "Invalid session"}, 400)
                return

            frame_path = camera.capture_frame(session_id, pose_idx)
            active_sessions[session_id]["frames"].append(frame_path)
            self._send_json({
                "session_id": session_id,
                "pose_idx": pose_idx,
                "frame_path": str(frame_path)
            })
            return

        # API: Render Composite Strip
        if path == "/api/render_strip":
            session_id = body.get("session_id")
            if not session_id or session_id not in active_sessions:
                self._send_json({"error": "Invalid session"}, 400)
                return

            session = active_sessions[session_id]
            cfg = load_event_config()

            strip_path = compositor.build_2x6_strip(
                frames=session["frames"],
                event_name=cfg.get("title", "GALA PORTRAIT ATELIER"),
                event_date=cfg.get("date", "October 2026"),
                venue=cfg.get("venue", "Richmond, VA"),
                filter_name=session.get("filter", "clean_color")
            )
            session["rendered_strip"] = strip_path

            # Generate QR Code & Mobile Landing Page
            qr_path, target_url = delivery.create_session_qr(session_id, strip_path)

            rel_strip = f"/data/rendered/{strip_path.name}"
            rel_qr = f"/data/qrcodes/{qr_path.name}"

            self._send_json({
                "session_id": session_id,
                "strip_url": rel_strip,
                "qr_url": rel_qr,
                "share_url": target_url
            })
            return

        # API: Dispatch Print Job
        if path == "/api/print":
            session_id = body.get("session_id")
            copies = int(body.get("copies", 2))
            if not session_id or session_id not in active_sessions:
                self._send_json({"error": "Invalid session"}, 400)
                return

            strip_path = active_sessions[session_id].get("rendered_strip")
            if not strip_path or not Path(strip_path).exists():
                self._send_json({"error": "No rendered strip to print"}, 400)
                return

            print_job = printer.print_strip(Path(strip_path), copies=copies, cut_2inch=True)
            self._send_json(print_job)
            return

        self.send_error(404, "Unknown API Route")

def run_server(port: int = 8080):
    server_address = ("0.0.0.0", port)
    httpd = HTTPServer(server_address, KioskHandler)
    print("=" * 65)
    print(f"  MOBLEY PHOTO BOOTH CO. // TOUCHSCREEN KIOSK SERVER ONLINE")
    print("=" * 65)
    print(f"• Local UI:       http://localhost:{port}")
    print(f"• Network Kiosk:  {delivery.base_url}")
    print(f"• Camera Status:  {'READY' if camera.is_hardware_ready else 'SIMULATION / HOT-FOLDER'}")
    print(f"• Printer Queue:  {printer.default_printer or 'VIRTUAL DYESUB SPOOLER'}")
    print("=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down kiosk server cleanly.")
        httpd.server_close()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run_server(port)
