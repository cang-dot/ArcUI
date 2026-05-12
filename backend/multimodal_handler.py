# ArcUI - multimodal_handler.py
"""
Multimodal file processing: image to base64, audio transcription (placeholder).
"""
import base64
import io
from PIL import Image


def resize_image_base64(image_b64: str, max_width: int = 2048) -> tuple:
    """
    Decode a base64 image, optionally resize if width exceeds max_width,
    and return (resized_base64, mime_type, width, height).
    """
    # Defaults
    data = image_b64
    mime_type = "image/png"

    # Strip data URI prefix if present
    if image_b64 and "," in image_b64:
        try:
            header, data = image_b64.split(",", 1)
            if ":" in header and ";" in header:
                mime_type = header.split(":")[1].split(";")[0]
            elif ":" in header:
                mime_type = header.split(":")[1]
        except (ValueError, IndexError):
            pass

    # Validate base64 data
    data = (data or "").strip()
    if not data:
        raise ValueError("Empty image data after stripping prefix")

    img_bytes = base64.b64decode(data)
    img = Image.open(io.BytesIO(img_bytes))

    # Convert to RGB for JPEG-saving if needed
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGBA")

    orig_width, orig_height = img.size
    if orig_width > max_width:
        ratio = max_width / orig_width
        new_height = int(orig_height * ratio)
        img = img.resize((max_width, new_height), Image.LANCZOS)

    buf = io.BytesIO()
    # Derive format from mime_type, default to PNG
    try:
        fmt = mime_type.split("/")[-1].upper() if "/" in mime_type else "PNG"
    except (ValueError, IndexError, AttributeError):
        fmt = "PNG"

    if fmt not in ("JPEG", "PNG", "WEBP", "GIF"):
        fmt = "PNG"

    # JPEG doesn't support alpha channel
    if fmt == "JPEG" and img.mode == "RGBA":
        img = img.convert("RGB")

    img.save(buf, format=fmt)
    resized_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return resized_b64, mime_type, img.width, img.height


async def image_to_base64(request_data: dict) -> dict:
    """Process image upload: resize and re-encode as base64."""
    image_data = request_data.get("image_data", "")
    max_width = request_data.get("max_width", 2048)
    if not image_data:
        raise ValueError("No image_data provided")

    b64, mime, w, h = resize_image_base64(image_data, max_width)
    return {
        "base64": b64,
        "mime_type": mime,
        "width": w,
        "height": h,
    }


async def transcribe(request_data: dict) -> dict:
    """
    Audio transcription placeholder.
    In production, this would call Whisper or another STT API.
    """
    audio_data = request_data.get("audio_data", "")
    if not audio_data:
        raise ValueError("No audio_data provided")

    # Placeholder: return empty text
    return {
        "text": "",
        "language": None,
    }
