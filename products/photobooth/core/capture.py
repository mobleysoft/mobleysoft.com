#!/usr/bin/env python3
"""
core/capture.py - Camera Control & Tethering Engine
Supports Canon EOS Rebel T7 via gphoto2 USB tethering,
hot-folder ingestion, and automated simulated capture for offline testing.
"""

from __future__ import annotations

import os
import sys
import time
import subprocess
import shutil
from pathlib import Path
from datetime import datetime, timezone
from PIL import Image, ImageDraw, ImageFont

class CameraManager:
    def __init__(self, capture_dir: Path):
        self.capture_dir = Path(capture_dir)
        self.capture_dir.mkdir(parents=True, exist_ok=True)
        self.has_gphoto = shutil.which("gphoto2") is not None
        self._camera_detected = False
        self._check_camera()

    def _check_camera(self) -> bool:
        if not self.has_gphoto:
            self._camera_detected = False
            return False
        try:
            res = subprocess.run(["gphoto2", "--auto-detect"], capture_output=True, text=True, timeout=3)
            lines = res.stdout.strip().splitlines()
            # gphoto2 prints header lines; if a model appears below the line, it's detected
            self._camera_detected = len(lines) > 2
            return self._camera_detected
        except Exception:
            self._camera_detected = False
            return False

    @property
    def is_hardware_ready(self) -> bool:
        return self._camera_detected

    def capture_frame(self, session_id: str, pose_idx: int) -> Path:
        """
        Triggers a single camera capture and saves to capture_dir.
        Returns the absolute Path of the captured image.
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        target_path = self.capture_dir / f"{session_id}_pose_{pose_idx}_{timestamp}.jpg"

        if self._check_camera():
            # Real hardware capture via gphoto2
            cmd = [
                "gphoto2",
                "--capture-image-and-download",
                f"--filename={str(target_path)}"
            ]
            try:
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=12)
                if target_path.exists() and target_path.stat().st_size > 0:
                    return target_path
            except Exception as e:
                sys.stderr.write(f"Hardware capture failed, falling back to simulation: {e}\n")

        # Simulated capture mode (Generates authentic 3:2 portrait frame)
        return self._generate_simulated_frame(target_path, session_id, pose_idx)

    def _generate_simulated_frame(self, path: Path, session_id: str, pose_idx: int) -> Path:
        # Standard 3:2 aspect ratio matching Canon Rebel T7 (e.g. 1800x1200 or 1200x800)
        width, height = 1800, 1200
        
        # Color palette varies slightly per pose to simulate real human session
        pose_colors = [
            ("#1e293b", "#334155"), # Pose 1: Midnight slate
            ("#0f172a", "#1e293b"), # Pose 2: Deep studio charcoal
            ("#18181b", "#27272a"), # Pose 3: Rich obsidian
            ("#172554", "#1e3a8a"), # Pose 4: Studio royal
        ]
        bg_col, accent_col = pose_colors[(pose_idx - 1) % len(pose_colors)]

        img = Image.new("RGB", (width, height), color=bg_col)
        draw = ImageDraw.Draw(img)

        # Draw simulated studio strobe vignette & softbox glow
        for r in range(400, 50, -25):
            alpha = int((400 - r) / 400 * 40)
            glow_box = [width // 2 - r * 2, height // 2 - r, width // 2 + r * 2, height // 2 + r]
            draw.ellipse(glow_box, outline=accent_col, width=3)

        # Draw simulated silhouette/subject outline
        center_x, center_y = width // 2, height // 2 + 50
        draw.ellipse([center_x - 120, center_y - 260, center_x + 120, center_y - 20], fill="#f1f5f9") # Head
        draw.polygon([
            (center_x - 300, height),
            (center_x + 300, height),
            (center_x + 180, center_y),
            (center_x - 180, center_y)
        ], fill="#cbd5e1") # Shoulders/torso

        # Technical metadata stamp
        stamp_text = (
            f"MOBLEY PHOTO BOOTH CO. // LIVE SIMULATED TETHER\n"
            f"Canon EOS Rebel T7 | Godox MS300-V Strobe (1/160s, f/8, ISO 100)\n"
            f"Session: {session_id} | Pose: {pose_idx} | {datetime.now().strftime('%b %d, %Y %I:%M:%S %p')}"
        )
        draw.text((40, height - 90), stamp_text, fill="#94a3b8")

        img.save(path, format="JPEG", quality=95)
        return path
