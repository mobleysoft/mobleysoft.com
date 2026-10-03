#!/usr/bin/env python3
"""
core/compositor.py - 300 DPI Image Processing & Layout Compositor
Generates industry-standard 2x6 double strips and 4x6 postcards
with custom event branding, typography, and professional color/B&W filters.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter

class LayoutCompositor:
    DPI = 300
    # Standard 4x6 inches at 300 DPI = 1200 x 1800 pixels
    CANVAS_WIDTH = 1200
    CANVAS_HEIGHT = 1800

    def __init__(self, output_dir: Path):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def apply_filter(self, img: Image.Image, filter_name: str = "clean_color") -> Image.Image:
        """
        Applies photographic processing:
        - clean_color: balanced studio strobe look
        - glam_bw: high-contrast celebrity gala black and white with soft highlight roll-off
        - vintage: warm tonal warmth
        """
        filter_name = filter_name.lower()
        if filter_name in ["glam_bw", "bw", "black_and_white"]:
            # Convert to grayscale
            gray = ImageOps.grayscale(img)
            # Enhance contrast for high-end glam look
            contrasted = ImageOps.autocontrast(gray, cutoff=2)
            # Slight tone curve push for rich deep blacks
            lut = [int(pow(i / 255.0, 1.15) * 255.0) for i in range(256)]
            contrasted = contrasted.point(lut)
            # Convert back to RGB
            return ImageOps.colorize(contrasted, black="#09090b", white="#fcfcfc")
        elif filter_name == "vintage":
            gray = ImageOps.grayscale(img)
            return ImageOps.colorize(gray, black="#291c10", white="#fef8eb")
        else:
            # Default clean color: slight contrast and saturation boost
            return ImageOps.autocontrast(img, cutoff=1)

    def build_2x6_strip(
        self,
        frames: List[Path],
        event_name: str,
        event_date: str,
        venue: str = "Richmond, VA",
        filter_name: str = "clean_color",
        custom_logo_path: Optional[Path] = None
    ) -> Path:
        """
        Builds a 1200x1800 px canvas containing TWO identical 600x1800 px 2x6 strips
        side-by-side, formatted for DNP/Citizen/HiTi 2-inch dye-sub cutting.
        """
        single_strip = self._build_single_2x6_strip(frames, event_name, event_date, venue, filter_name, custom_logo_path)
        
        # Create dual-strip 4x6 canvas (1200 x 1800 px)
        canvas = Image.new("RGB", (self.CANVAS_WIDTH, self.CANVAS_HEIGHT), color="#ffffff")
        # Paste left strip
        canvas.paste(single_strip, (0, 0))
        # Paste right strip
        canvas.paste(single_strip, (600, 0))

        # Thin 1px cutter guide line down the exact center
        draw = ImageDraw.Draw(canvas)
        draw.line([(600, 0), (600, self.CANVAS_HEIGHT)], fill="#e2e8f0", width=1)

        filename = f"strip_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        out_path = self.output_dir / filename
        canvas.save(out_path, format="JPEG", quality=98, dpi=(self.DPI, self.DPI))
        return out_path

    def _build_single_2x6_strip(
        self,
        frames: List[Path],
        event_name: str,
        event_date: str,
        venue: str,
        filter_name: str,
        custom_logo_path: Optional[Path] = None
    ) -> Image.Image:
        strip_w, strip_h = 600, 1800
        strip = Image.new("RGB", (strip_w, strip_h), color="#ffffff")
        draw = ImageDraw.Draw(strip)

        # Layout parameters for 3-photo classic vertical format
        margin_x = 35
        margin_top = 40
        photo_w = strip_w - (margin_x * 2) # 530 px
        photo_h = int(photo_w * (2.0 / 3.0)) # 353 px (authentic 3:2 ratio)
        spacing = 30

        # Place 3 photos
        for i, frame_path in enumerate(frames[:3]):
            if frame_path.exists():
                raw_img = Image.open(frame_path).convert("RGB")
                processed = self.apply_filter(raw_img, filter_name)
                # Crop to 3:2 ratio and resize
                fitted = ImageOps.fit(processed, (photo_w, photo_h), Image.Resampling.LANCZOS)
                
                pos_y = margin_top + i * (photo_h + spacing)
                # Draw subtle photo border/shadow
                draw.rectangle([margin_x - 1, pos_y - 1, margin_x + photo_w, pos_y + photo_h], outline="#e2e8f0", width=1)
                strip.paste(fitted, (margin_x, pos_y))

        # Footer Branding Section
        footer_top = margin_top + 3 * (photo_h + spacing) + 15
        
        # If custom logo exists, composite it; otherwise render clean typography
        if custom_logo_path and custom_logo_path.exists():
            try:
                logo = Image.open(custom_logo_path).convert("RGBA")
                logo.thumbnail((400, 140), Image.Resampling.LANCZOS)
                logo_x = (strip_w - logo.width) // 2
                strip.paste(logo, (logo_x, footer_top + 10), mask=logo)
            except Exception:
                self._draw_default_footer(draw, strip_w, footer_top, event_name, event_date, venue)
        else:
            self._draw_default_footer(draw, strip_w, footer_top, event_name, event_date, venue)

        return strip

    def _draw_default_footer(self, draw: ImageDraw.ImageDraw, strip_w: int, y: int, event_name: str, event_date: str, venue: str):
        # Event Name
        draw.text((strip_w // 2, y + 25), event_name.upper(), fill="#0f172a", anchor="mm", font_size=28)
        # Venue & City
        draw.text((strip_w // 2, y + 65), venue, fill="#475569", anchor="mm", font_size=18)
        # Date
        draw.text((strip_w // 2, y + 95), event_date, fill="#64748b", anchor="mm", font_size=16)
        
        # Subtle craftsman signature
        draw.text((strip_w // 2, y + 160), "MOBLEY PHOTO BOOTH CO.", fill="#94a3b8", anchor="mm", font_size=13)
        draw.text((strip_w // 2, y + 180), "STUDIO-GRADE PORTRAITS", fill="#cbd5e1", anchor="mm", font_size=11)

    def build_4x6_postcard(
        self,
        frames: List[Path],
        event_name: str,
        event_date: str,
        venue: str = "Richmond, VA",
        filter_name: str = "clean_color"
    ) -> Path:
        """
        Builds an 1800x1200 px landscape postcard (single hero shot or 2-up grid).
        """
        canvas = Image.new("RGB", (self.CANVAS_HEIGHT, self.CANVAS_WIDTH), color="#ffffff") # 1800 x 1200
        draw = ImageDraw.Draw(canvas)

        if frames and frames[0].exists():
            hero = Image.open(frames[0]).convert("RGB")
            hero = self.apply_filter(hero, filter_name)
            hero_fitted = ImageOps.fit(hero, (1700, 1000), Image.Resampling.LANCZOS)
            canvas.paste(hero_fitted, (50, 40))

        # Bottom banner
        draw.text((900, 1070), event_name.upper(), fill="#0f172a", anchor="mm", font_size=32)
        draw.text((900, 1115), f"{venue} • {event_date}", fill="#64748b", anchor="mm", font_size=20)
        draw.text((900, 1155), "MOBLEY PHOTO BOOTH CO.", fill="#94a3b8", anchor="mm", font_size=14)

        filename = f"postcard_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        out_path = self.output_dir / filename
        canvas.save(out_path, format="JPEG", quality=98, dpi=(self.DPI, self.DPI))
        return out_path
