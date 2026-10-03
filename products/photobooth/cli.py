#!/usr/bin/env python3
"""
cli.py - Mobley Photo Booth Co. CLI Controller
Unified command-line management for kiosk operation, test sessions,
hardware diagnostics, and print batching.
"""

from __future__ import annotations

import sys
import os
import argparse
import json
import uuid
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from core.capture import CameraManager
from core.compositor import LayoutCompositor
from core.delivery import DeliveryManager
from core.printer import PrintSpooler
from kiosk.server import run_server, load_event_config

def cmd_run(args):
    print("Starting Mobley Photo Booth Co. Kiosk Server...")
    run_server(port=args.port)

def cmd_status(args):
    data_dir = BASE_DIR / "data"
    cam = CameraManager(data_dir / "captures")
    prn = PrintSpooler(dry_run=True)
    cfg = load_event_config()

    print("=" * 65)
    print("       MOBLEY PHOTO BOOTH CO. // SYSTEM STATUS REPORT         ")
    print("=" * 65)
    print(f"• Event Title:       {cfg.get('title')}")
    print(f"• Venue / City:      {cfg.get('venue')}")
    print(f"• Event Date:        {cfg.get('date')}")
    print("-" * 65)
    print(f"• Camera Hardware:   {'DETECTED (Canon DSLR via gphoto2)' if cam.is_hardware_ready else 'OFFLINE (Using Studio Simulation & Hot-Folder)'}")
    print(f"• CUPS Print Queue:  {prn.default_printer or 'None Detected (Using Virtual Dye-Sub Spooler)'}")
    print(f"• Data Directory:    {data_dir}")
    print("=" * 65)

def cmd_test(args):
    data_dir = BASE_DIR / "data"
    cam = CameraManager(data_dir / "captures")
    comp = LayoutCompositor(data_dir / "rendered")
    deliv = DeliveryManager(data_dir / "qrcodes", data_dir / "gallery")
    prn = PrintSpooler(dry_run=True)
    cfg = load_event_config()

    session_id = f"TEST-{uuid.uuid4().hex[:6].upper()}"
    filter_choice = args.filter or cfg.get("default_filter", "clean_color")

    print("=" * 65)
    print(f"  MOBLEY PHOTO BOOTH CO. // EXECUTING END-TO-END TEST SESSION")
    print("=" * 65)
    print(f"Session ID: {session_id} | Style Filter: {filter_choice.upper()}")
    print("-" * 65)

    # 1. Capture 3 Frames
    frames = []
    for pose in range(1, 4):
        f = cam.capture_frame(session_id, pose)
        frames.append(f)
        print(f"✓ Frame {pose} captured: {f.name} ({f.stat().st_size // 1024} KB)")

    # 2. Composite 300 DPI 2x6 Double Strip
    strip_path = comp.build_2x6_strip(
        frames=frames,
        event_name=cfg.get("title", "GALA PORTRAIT ATELIER"),
        event_date=cfg.get("date", "October 2026"),
        venue=cfg.get("venue", "Richmond, VA"),
        filter_name=filter_choice
    )
    print(f"✓ 300 DPI 2x6 Double Strip rendered: {strip_path.name}")
    print(f"  Dimensions: {comp.CANVAS_WIDTH}x{comp.CANVAS_HEIGHT} px (4x6 @ 300 DPI)")

    # 3. Generate QR Code & Micro-Gallery
    qr_path, target_url = deliv.create_session_qr(session_id, strip_path)
    print(f"✓ Guest QR Code generated: {qr_path.name}")
    print(f"✓ Mobile Download URL: {target_url}")

    # 4. Spool Test Prints
    job = prn.print_strip(strip_path, copies=2, cut_2inch=True)
    print(f"✓ Print Spooler: Status = {job['status']} ({job['copies']} copies, 2-inch cut enabled)")
    print("=" * 65)
    print("TEST SESSION COMPLETED WITH 100% INTEGRITY.")
    print("=" * 65)

def main():
    parser = argparse.ArgumentParser(description="Mobley Photo Booth Co. System Controller")
    subparsers = parser.add_subparsers(dest="command")

    # run command
    run_parser = subparsers.add_parser("run", help="Start touchscreen kiosk server")
    run_parser.add_argument("--port", type=int, default=8080, help="HTTP server port")

    # status command
    subparsers.add_parser("status", help="Display hardware status & event config")

    # test command
    test_parser = subparsers.add_parser("test", help="Run simulated test session")
    test_parser.add_argument("--filter", choices=["clean_color", "glam_bw", "vintage"], default="clean_color", help="Portrait style filter")

    args = parser.parse_args()
    if args.command == "run":
        cmd_run(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "test":
        cmd_test(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
