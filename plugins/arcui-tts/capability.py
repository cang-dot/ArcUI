# ArcUI - plugins/tts/capability.py
# TTS Python capabilities: call TTS API, fetch voices

import os
import httpx
import base64
from typing import Optional


async def tts_speak(
    text: str,
    voice: str = "alloy",
    api_endpoint: Optional[str] = None,
    api_key: Optional[str] = None,
) -> dict:
    """
    Generate speech audio from text via a TTS API.
    If api_endpoint is not provided, defaults to OpenAI TTS endpoint.

    Args:
        text: Text to convert to speech
        voice: Voice ID to use (e.g., alloy, echo, fable, onyx, nova, shimmer)
        api_endpoint: TTS API endpoint URL
        api_key: API key for the TTS service (injected by engine from global config)

    Returns:
        dict with audio_base64 (base64-encoded audio data)
    """
    if not text or not text.strip():
        raise ValueError("Text is required for TTS")

    if not api_endpoint:
        # Default to OpenAI TTS endpoint
        api_endpoint = "https://api.openai.com/v1/audio/speech"

    if not api_key:
        raise ValueError("API key is required for TTS (injected from global config)")

    request_body = {
        "model": "tts-1",
        "input": text[:4096],  # OpenAI TTS has a 4096 character limit
        "voice": voice,
        "response_format": "mp3",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            api_endpoint,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=request_body,
        )

        if response.status_code != 200:
            error_text = response.text[:500]
            raise Exception(f"TTS API returned {response.status_code}: {error_text}")

        audio_bytes = response.content
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
        mime_type = response.headers.get("content-type", "audio/mpeg")

        return {
            "audio_base64": f"data:{mime_type};base64,{audio_base64}",
        }


async def tts_fetch_voices(
    api_endpoint: Optional[str] = None,
    api_key: Optional[str] = None,
) -> dict:
    """
    Fetch available voices from a TTS API.
    For OpenAI, this returns the known voice list.

    Args:
        api_endpoint: TTS API base URL (optional)
        api_key: API key (injected by engine)

    Returns:
        dict with voices list
    """
    # OpenAI TTS has a fixed set of voices (no listing API as of 2025)
    # Return the known standard voices
    voices = [
        {"id": "alloy", "label": "Alloy", "gender": "neutral"},
        {"id": "echo", "label": "Echo", "gender": "male"},
        {"id": "fable", "label": "Fable", "gender": "neutral"},
        {"id": "onyx", "label": "Onyx", "gender": "male"},
        {"id": "nova", "label": "Nova", "gender": "female"},
        {"id": "shimmer", "label": "Shimmer", "gender": "female"},
    ]

    # If a custom endpoint is provided, try to fetch voices from it
    if api_endpoint and api_endpoint != "https://api.openai.com/v1/audio/speech":
        try:
            voices_url = api_endpoint.rstrip("/") + "/voices"
            if api_key:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(
                        voices_url,
                        headers={"Authorization": f"Bearer {api_key}"},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        if "voices" in data:
                            voices = data["voices"]
                        elif isinstance(data, list):
                            voices = data
            else:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(voices_url)
                    if resp.status_code == 200:
                        data = resp.json()
                        if "voices" in data:
                            voices = data["voices"]
                        elif isinstance(data, list):
                            voices = data
        except Exception as e:
            # Fall back to default voices on error
            pass

    return {"voices": voices}
