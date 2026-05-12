# ArcUI - proxy.py
"""
API proxy: forwards requests to LLM providers, handles SSE streaming transparently.
"""
import httpx
from typing import Dict, Any, Optional, AsyncGenerator


async def proxy_request(
    url: str,
    method: str = "POST",
    headers: Dict[str, str] = None,
    body: Dict[str, Any] = None,
) -> dict:
    """
    Forward a non-streaming request to the target API and return JSON response.
    Strips sensitive headers before forwarding.
    """
    headers = headers or {}
    body = body or {}

    # Sanitize headers: only forward relevant ones
    forward_headers = {}
    for k, v in headers.items():
        if k.lower() in ("content-type", "authorization", "x-factarc-token", "x-request-id"):
            forward_headers[k] = v

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.request(
            method=method,
            url=url,
            headers=forward_headers,
            json=body,
        )
        try:
            return response.json()
        except Exception:
            return {"text": response.text, "status_code": response.status_code}


async def proxy_stream(
    url: str,
    headers: Dict[str, str] = None,
    body: Dict[str, Any] = None,
) -> AsyncGenerator[bytes, None]:
    """
    Forward a streaming SSE request and yield raw bytes.
    Uses httpx.stream() for transparent SSE passthrough.
    """
    headers = headers or {}
    body = body or {}

    # Sanitize headers
    forward_headers = {}
    for k, v in headers.items():
        if k.lower() in ("content-type", "authorization", "x-factarc-token", "x-request-id"):
            forward_headers[k] = v

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST",
            url,
            headers=forward_headers,
            json=body,
        ) as response:
            async for chunk in response.aiter_bytes():
                yield chunk


async def fetch_models(
    base_url: str,
    api_key: str,
) -> list:
    """
    Fetch available models from an OpenAI-compatible /models endpoint.
    Returns a list of model objects.
    """
    models_url = base_url.rstrip("/") + "/models"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(models_url, headers=headers)
            data = response.json()
            # Handle both OpenAI format and common alternatives
            if "data" in data:
                return data["data"]
            elif "models" in data:
                return data["models"]
            else:
                # Fallback: return the whole response
                return [data] if isinstance(data, dict) else data
        except Exception as e:
            # Return empty list on failure; frontend will allow manual input
            print(f"[Proxy] Failed to fetch models: {e}")
            return []
