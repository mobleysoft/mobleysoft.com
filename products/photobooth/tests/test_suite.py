#!/usr/bin/env python3
"""
tests/test_suite.py - End-to-End Automated Test Suite for Mobley Photo Booth Co.
Tests capture, 300 DPI 2x6 composition, 4x6 postcard rendering, QR delivery, and CUPS spooler.
"""

from __future__ import annotations

import sys
import unittest
import tempfile
import shutil
from pathlib import Path
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from core.capture import CameraManager
from core.compositor import LayoutCompositor
from core.delivery import DeliveryManager
from core.printer import PrintSpooler

class TestMobleyPhotoBooth(unittest.TestCase):
    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp())
        self.captures_dir = self.test_dir / "captures"
        self.rendered_dir = self.test_dir / "rendered"
        self.qr_dir = self.test_dir / "qr"
        self.gallery_dir = self.test_dir / "gallery"

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_camera_manager_simulated_capture(self):
        cam = CameraManager(self.captures_dir)
        frame = cam.capture_frame("TEST-01", 1)
        self.assertTrue(frame.exists())
        self.assertGreater(frame.stat().st_size, 1000)

        img = Image.open(frame)
        self.assertEqual(img.size, (1800, 1200)) # 3:2 ratio

    def test_compositor_2x6_dual_strip(self):
        cam = CameraManager(self.captures_dir)
        frames = [cam.capture_frame("TEST-02", i) for i in range(1, 4)]
        
        comp = LayoutCompositor(self.rendered_dir)
        strip = comp.build_2x6_strip(
            frames=frames,
            event_name="GALA ATELIER",
            event_date="October 2026",
            venue="The Jefferson Hotel",
            filter_name="glam_bw"
        )
        self.assertTrue(strip.exists())
        
        strip_img = Image.open(strip)
        # Must be 1200 x 1800 (standard 4x6 at 300 DPI containing 2 strips)
        self.assertEqual(strip_img.size, (1200, 1800))

    def test_compositor_4x6_postcard(self):
        cam = CameraManager(self.captures_dir)
        frames = [cam.capture_frame("TEST-03", 1)]

        comp = LayoutCompositor(self.rendered_dir)
        postcard = comp.build_4x6_postcard(
            frames=frames,
            event_name="EXECUTIVE RECEPTION",
            event_date="October 2026",
            venue="VMFA"
        )
        self.assertTrue(postcard.exists())
        postcard_img = Image.open(postcard)
        self.assertEqual(postcard_img.size, (1800, 1200))

    def test_delivery_qr_generation(self):
        cam = CameraManager(self.captures_dir)
        frames = [cam.capture_frame("TEST-04", 1)]
        comp = LayoutCompositor(self.rendered_dir)
        strip = comp.build_2x6_strip(frames, "TEST EVENT", "2026", "RICHMOND")

        delivery = DeliveryManager(self.qr_dir, self.gallery_dir, base_url="http://test.local")
        qr_file, url = delivery.create_session_qr("TEST-04", strip)

        self.assertTrue(qr_file.exists())
        self.assertTrue(url.startswith("http://test.local/s/TEST-04"))
        
        # Check that session micro-gallery HTML was compiled
        index_html = self.gallery_dir / "TEST-04" / "index.html"
        self.assertTrue(index_html.exists())
        with open(index_html, "r") as f:
            content = f.read()
            self.assertIn("Mobley Photo Booth Co.", content)

    def test_print_spooler_virtual_dispatch(self):
        spooler = PrintSpooler(dry_run=True)
        dummy_file = self.test_dir / "dummy.jpg"
        dummy_file.write_text("fake print")
        
        job = spooler.print_strip(dummy_file, copies=2, cut_2inch=True)
        self.assertEqual(job["status"], "SIMULATED_DISPENSE")
        self.assertEqual(job["copies"], 2)

if __name__ == "__main__":
    unittest.main()
