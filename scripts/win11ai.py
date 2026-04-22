#!/usr/bin/env python3
"""
Windows 11 AI Runtime wrapper.
Provides on-device OCR, image description, text summarization, and generation.

Commands:
  ocr <image_path>              - Extract text from image
  summarize                     - Summarize text from stdin
  describe <image_path>         - Describe image content
  generate <prompt>             - Generate text from prompt

Exit codes:
  0 = success
  1 = error (check stderr or output.error)
  2 = unsupported platform/build
"""

import sys
import json
import platform
import subprocess
from pathlib import Path
from typing import Any

def check_platform() -> dict[str, Any]:
    """Check if Windows 11 AI runtime is available."""
    # Check Windows version
    if platform.system() != "Windows":
        return {"error": "not_available", "detail": f"Unsupported OS: {platform.system()}"}

    release = platform.release()
    if release != "11":
        return {"error": "not_available", "detail": f"Requires Windows 11, got {release}"}

    # Check Windows build (need 26100+)
    try:
        version_output = subprocess.run(
            ["cmd", "/c", "ver"],
            capture_output=True,
            text=True,
            timeout=5
        )
        # Parse build number from version string (e.g., "10.0.26100")
        # If build < 26100, return error
        if "26100" not in version_output.stdout and "26200" not in version_output.stdout:
            # Simplified check - just see if we can detect a newer build
            # In production, parse the actual build number
            pass
    except Exception:
        pass

    return {"available": True}

def ocr_image(image_path: str) -> dict[str, Any]:
    """Extract text from image using Windows OCR."""
    try:
        from pathlib import Path
        path = Path(image_path)
        if not path.exists():
            return {"error": "file_not_found", "detail": f"Image not found: {image_path}"}

        # Try using Windows.Media.Ocr via WinRT
        try:
            import winrt
            from winrt.windows.media import Ocr
            from winrt.windows.media.ocr import OcrEngine
            from winrt.windows.graphics.imaging import SoftwareBitmap, BitmapDecoder
            from winrt.windows.storage.streams import RandomAccessFile
            import asyncio

            async def extract_text():
                # Load image file
                file = await RandomAccessFile.open_async(image_path)
                decoder = await BitmapDecoder.create_async(file)
                bitmap = await decoder.get_software_bitmap_async()

                # Get OCR engine (default language)
                engine = OcrEngine.try_create_from_user_profile()
                if not engine:
                    return {"error": "engine_not_available", "detail": "OCR engine unavailable"}

                # Recognize text
                result = await engine.recognize_async(bitmap)

                lines = []
                text_parts = []
                for line in result.lines:
                    line_text = " ".join(word.text for word in line.words)
                    text_parts.append(line_text)
                    lines.append({"text": line_text, "bbox": None})

                return {
                    "text": "\n".join(text_parts),
                    "lines": lines
                }

            return asyncio.run(extract_text())

        except (ImportError, ModuleNotFoundError):
            # WinRT not available, return stub
            return {
                "error": "winrt_not_available",
                "detail": "Windows.Media.Ocr not accessible (requires Python 3.8+ and winrt package)",
                "text": "",
                "lines": []
            }

    except Exception as e:
        return {"error": "ocr_failed", "detail": str(e)}

def summarize_text(text: str) -> dict[str, Any]:
    """Summarize text using Windows 11 AI (Phi Silica)."""
    try:
        # Try using Phi Silica via Windows.AI.Extensions
        try:
            import winrt
            from winrt.windows.ai import Extensions

            # Check if Phi Silica is available
            try:
                # This is a simplified approach - real implementation would check availability
                # and use the proper API
                prompt = f"Summarize the following text in 200 words or less:\n\n{text}"

                # For now, return a stub indicating the feature would work
                return {
                    "error": "not_implemented",
                    "detail": "Phi Silica API requires more complex WinRT bindings",
                    "summary": ""
                }
            except Exception as e:
                return {"error": "phi_not_available", "detail": str(e)}

        except (ImportError, ModuleNotFoundError):
            return {
                "error": "winrt_not_available",
                "detail": "Windows.AI.Extensions not accessible",
                "summary": ""
            }

    except Exception as e:
        return {"error": "summarize_failed", "detail": str(e)}

def describe_image(image_path: str) -> dict[str, Any]:
    """Describe image content using Windows 11 AI."""
    try:
        from pathlib import Path
        path = Path(image_path)
        if not path.exists():
            return {"error": "file_not_found", "detail": f"Image not found: {image_path}"}

        # Try using Image Captioning via Windows.AI.Extensions
        try:
            import winrt
            # This would use Windows.AI.Extensions for image description
            # For now, return stub
            return {
                "error": "not_implemented",
                "detail": "Image description requires Windows.AI.Extensions bindings",
                "description": ""
            }

        except (ImportError, ModuleNotFoundError):
            return {
                "error": "winrt_not_available",
                "detail": "Windows.AI.Extensions not accessible",
                "description": ""
            }

    except Exception as e:
        return {"error": "describe_failed", "detail": str(e)}

def generate_text(prompt: str) -> dict[str, Any]:
    """Generate text using Windows 11 AI (Phi Silica)."""
    try:
        # Try using Phi Silica via Windows.AI.Extensions
        try:
            import winrt
            from winrt.windows.ai import Extensions

            return {
                "error": "not_implemented",
                "detail": "Text generation requires Phi Silica API bindings",
                "text": ""
            }

        except (ImportError, ModuleNotFoundError):
            return {
                "error": "winrt_not_available",
                "detail": "Windows.AI.Extensions not accessible",
                "text": ""
            }

    except Exception as e:
        return {"error": "generate_failed", "detail": str(e)}

def main():
    """Main CLI entry point."""
    if len(sys.argv) < 2:
        result = {"error": "no_command", "detail": "Usage: win11ai.py <command> [args...]"}
        print(json.dumps(result))
        sys.exit(1)

    command = sys.argv[1]

    # Check platform availability first
    platform_check = check_platform()
    if "error" in platform_check:
        print(json.dumps(platform_check))
        sys.exit(2)

    try:
        if command == "ocr":
            if len(sys.argv) < 3:
                result = {"error": "missing_argument", "detail": "Usage: win11ai.py ocr <image_path>"}
            else:
                result = ocr_image(sys.argv[2])

        elif command == "summarize":
            try:
                text = sys.stdin.read()
                result = summarize_text(text)
            except Exception as e:
                result = {"error": "stdin_read_failed", "detail": str(e)}

        elif command == "describe":
            if len(sys.argv) < 3:
                result = {"error": "missing_argument", "detail": "Usage: win11ai.py describe <image_path>"}
            else:
                result = describe_image(sys.argv[2])

        elif command == "generate":
            if len(sys.argv) < 3:
                result = {"error": "missing_argument", "detail": "Usage: win11ai.py generate <prompt>"}
            else:
                prompt = " ".join(sys.argv[2:])
                result = generate_text(prompt)

        else:
            result = {"error": "unknown_command", "detail": f"Unknown command: {command}"}

        print(json.dumps(result))

        # Exit code 0 unless there's an error
        if "error" in result:
            sys.exit(1)
        sys.exit(0)

    except Exception as e:
        result = {"error": "unexpected_error", "detail": str(e)}
        print(json.dumps(result))
        sys.exit(1)

if __name__ == "__main__":
    main()
