#!/usr/bin/env python3
"""
core/delivery.py - Instant Digital Delivery & QR Generator
Generates on-screen guest QR codes and serves a local micro-gallery
for instant camera-roll downloads over venue Wi-Fi / hotspot.
"""

from __future__ import annotations

import os
import json
import socket
from pathlib import Path
from typing import Optional, List
import qrcode
from PIL import Image

class DeliveryManager:
    def __init__(self, qr_dir: Path, gallery_dir: Path, base_url: Optional[str] = None):
        self.qr_dir = Path(qr_dir)
        self.gallery_dir = Path(gallery_dir)
        self.qr_dir.mkdir(parents=True, exist_ok=True)
        self.gallery_dir.mkdir(parents=True, exist_ok=True)
        self.base_url = base_url or self._detect_local_ip_url()

    def _detect_local_ip_url(self) -> str:
        """Detects machine LAN IP for venue Wi-Fi direct guest connection."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return f"http://{ip}:8080"
        except Exception:
            return "http://localhost:8080"

    def create_session_qr(self, session_id: str, strip_path: Path) -> tuple[Path, str]:
        """
        Creates a high-resolution QR code pointing to the session's delivery URL.
        Returns (qr_image_path, target_url).
        """
        target_url = f"{self.base_url}/s/{session_id}"
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
        )
        qr.add_data(target_url)
        qr.make(fit=True)

        qr_img = qr.make_image(fill_color="#0f172a", back_color="#ffffff").convert("RGB")
        qr_file = self.qr_dir / f"qr_{session_id}.png"
        qr_img.save(qr_file)

        # Generate the mobile-friendly HTML landing page for this session
        self._build_session_html(session_id, strip_path, target_url)

        return qr_file, target_url

    def _build_session_html(self, session_id: str, strip_path: Path, share_url: str):
        session_folder = self.gallery_dir / session_id
        session_folder.mkdir(parents=True, exist_ok=True)

        # Copy strip to session folder for serving
        local_strip = session_folder / "strip.jpg"
        if strip_path.exists():
            import shutil
            shutil.copy2(strip_path, local_strip)

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Photos // Mobley Photo Booth Co.</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
        body {{ background: #09090b; color: #f8fafc; display: flex; flex-direction: column; align-items: center; min-height: 100vh; padding: 24px 16px; text-align: center; }}
        .header {{ margin-bottom: 24px; }}
        .brand {{ font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; }}
        .title {{ font-size: 22px; font-weight: 700; color: #f1f5f9; }}
        .strip-card {{ background: #18181b; padding: 12px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 360px; width: 100%; margin-bottom: 24px; }}
        .strip-card img {{ width: 100%; height: auto; border-radius: 8px; display: block; }}
        .actions {{ display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 360px; }}
        .btn {{ display: block; width: 100%; padding: 14px 20px; font-size: 16px; font-weight: 600; text-align: center; text-decoration: none; border-radius: 8px; cursor: pointer; transition: 0.2s; }}
        .btn-primary {{ background: #f8fafc; color: #09090b; }}
        .btn-secondary {{ background: #27272a; color: #f8fafc; }}
        .footer {{ margin-top: auto; padding-top: 32px; font-size: 12px; color: #64748b; }}
    </style>
</head>
<body>
    <div class="header">
        <div class="brand">Mobley Photo Booth Co.</div>
        <h1 class="title">Your Keepsake Photo Strip</h1>
    </div>
    
    <div class="strip-card">
        <img src="strip.jpg" alt="Your Photo Strip">
    </div>

    <div class="actions">
        <a href="strip.jpg" download="MobleyPhotoBooth_{session_id}.jpg" class="btn btn-primary">Save to Camera Roll</a>
        <button onclick="navigator.share({{ title: 'My Photo Strip', url: window.location.href }})" class="btn btn-secondary">Share Photo</button>
    </div>

    <div class="footer">
        Studio-Grade Portrait Activations • Richmond, Virginia
    </div>
</body>
</html>
"""
        index_file = session_folder / "index.html"
        with open(index_file, "w", encoding="utf-8") as f:
            f.write(html_content)
