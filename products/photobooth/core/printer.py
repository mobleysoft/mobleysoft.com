#!/usr/bin/env python3
"""
core/printer.py - CUPS Dye-Sublimation Print Spooler
Interfaces with macOS CUPS print subsystem for DNP DS620A / RX1HS / Citizen printers.
Handles 2-inch cut options, print queuing, and simulated print logging.
"""

from __future__ import annotations

import os
import sys
import subprocess
import shutil
from pathlib import Path
from typing import Optional, List
from datetime import datetime

class PrintSpooler:
    def __init__(self, default_printer: Optional[str] = None, dry_run: bool = False):
        self.default_printer = default_printer or self._detect_cups_printer()
        self.dry_run = dry_run
        self.print_log: List[dict] = []

    def _detect_cups_printer(self) -> Optional[str]:
        """Detects available CUPS printers matching photo or dye-sub brands."""
        if not shutil.which("lpstat"):
            return None
        try:
            res = subprocess.run(["lpstat", "-p"], capture_output=True, text=True, timeout=3)
            for line in res.stdout.splitlines():
                if "printer" in line:
                    parts = line.split()
                    if len(parts) >= 2:
                        p_name = parts[1]
                        # Prioritize dedicated dye-sub brands if found
                        if any(b in p_name.lower() for b in ["dnp", "ds620", "rx1", "citizen", "hiti", "photo"]):
                            return p_name
            # Fallback to system default printer
            res_def = subprocess.run(["lpstat", "-d"], capture_output=True, text=True, timeout=3)
            if "destination:" in res_def.stdout:
                return res_def.stdout.split("destination:")[1].strip()
        except Exception:
            pass
        return None

    @property
    def is_hardware_available(self) -> bool:
        return self.default_printer is not None

    def print_strip(self, strip_path: Path, copies: int = 1, cut_2inch: bool = True) -> dict:
        """
        Dispatches a 4x6 composite strip to the printer.
        With cut_2inch=True, the printer automatically splits the 4x6 into two 2x6 strips.
        """
        timestamp = datetime.now().isoformat()
        job_info = {
            "timestamp": timestamp,
            "file": str(strip_path),
            "copies": copies,
            "cut_2inch": cut_2inch,
            "printer": self.default_printer or "VIRTUAL_DYESUB_SIMULATOR",
            "status": "QUEUED"
        }

        if self.dry_run or not self.default_printer:
            job_info["status"] = "SIMULATED_DISPENSE"
            job_info["notes"] = "Dry-run / Virtual dye-sub spooler (no physical media consumed)"
            self.print_log.append(job_info)
            return job_info

        # Real hardware dispatch via lp / lpr
        cmd = ["lp", "-d", self.default_printer, "-n", str(copies)]
        if cut_2inch:
            # Common CUPS parameter for DNP DS620 / RX1 2-inch slitter
            cmd.extend(["-o", "CutMode=2InchCut"])
        cmd.append(str(strip_path))

        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=8)
            if res.returncode == 0:
                job_info["status"] = "PRINTED"
                job_info["cups_output"] = res.stdout.strip()
            else:
                job_info["status"] = "ERROR"
                job_info["error"] = res.stderr.strip()
        except Exception as e:
            job_info["status"] = "FAILED"
            job_info["error"] = str(e)

        self.print_log.append(job_info)
        return job_info
