# ArcUI - server.py
"""
FastAPI entry point for ArcUI backend. Runs on port 1011.
Registers all routes: health, proxy, plugin, multimodal.
"""
import json
import time
import webbrowser
from pathlib import Path

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import uvicorn

from models import (
    ProxyRequest,
    PluginCallRequest,
    ImageToBase64Request,
    TranscribeRequest,
    HealthResponse,
    PluginInfo,
    PluginsListResponse,
    CapabilityResponse,
)
from proxy import proxy_request, proxy_stream, fetch_models
from plugin_engine import engine
from multimodal_handler import image_to_base64, transcribe

# ---------------------------------------------------------------------------
# Lifespan: auto-load plugins on startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Auto-discover and load all plugins on startup."""
    plugin_ids = engine.discover_plugins()
    for pid in plugin_ids:
        success = engine.load_plugin(pid)
        status = "loaded" if success else "FAILED"
        print(f"[ArcUI] Plugin '{pid}' {status}")
    yield

app = FastAPI(title="ArcUI Backend", version="1.0.0", lifespan=lifespan)

# CORS: allow all origins for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint. Returns plugin list and identity status."""
    plugin_ids = engine.discover_plugins()
    return HealthResponse(
        status="ok",
        service="ArcUI Backend",
        version="1.0.0",
        has_identity=False,  # Fact-ARC identity is handled by the original Fact-ARC backend
        plugins_loaded=plugin_ids,
    )


# ---------------------------------------------------------------------------
# API Proxy - non-streaming
# ---------------------------------------------------------------------------
@app.post("/api/proxy")
async def api_proxy(req: ProxyRequest):
    """Forward a non-streaming request to the target API."""
    try:
        result = await proxy_request(
            url=req.url,
            method=req.method,
            headers=req.headers,
            body=req.body,
        )
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=502,
        )


# ---------------------------------------------------------------------------
# API Proxy - streaming (SSE)
# ---------------------------------------------------------------------------
@app.post("/api/proxy/stream")
async def api_proxy_stream(req: ProxyRequest):
    """Forward a streaming SSE request to the target API."""
    try:
        async def event_generator():
            async for chunk in proxy_stream(
                url=req.url,
                headers=req.headers,
                body=req.body,
            ):
                yield chunk

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=502,
        )


# ---------------------------------------------------------------------------
# Models fetching
# ---------------------------------------------------------------------------
@app.post("/api/proxy/models")
async def api_fetch_models(req: ProxyRequest):
    """Fetch available models from the configured base URL."""
    base_url = req.body.get("baseUrl") or req.body.get("base_url", "")
    api_key = req.body.get("apiKey") or req.body.get("api_key", "")
    try:
        models = await fetch_models(base_url, api_key)
        return JSONResponse(content={"models": models})
    except Exception as e:
        return JSONResponse(
            content={"error": str(e), "models": []},
            status_code=502,
        )


# ---------------------------------------------------------------------------
# Plugin capabilities
# ---------------------------------------------------------------------------
@app.get("/api/plugins", response_model=PluginsListResponse)
async def list_plugins():
    """Return all discovered plugins and their capabilities."""
    plugins = []
    for pid in engine.discover_plugins():
        # Try to load plugin.json metadata
        meta_file = engine.plugins_dir / pid / "plugin.json"
        meta = {}
        if meta_file.exists():
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
            except Exception:
                pass

        plugins.append(
            PluginInfo(
                id=pid,
                name=meta.get("name", pid),
                name_en=meta.get("name_en", pid),
                version=meta.get("version", "0.0.0"),
                author=meta.get("author", "Unknown"),
                capabilities=engine.get_plugin_capabilities(pid) if pid in engine.loaded_plugins else [],
            )
        )
    return PluginsListResponse(plugins=plugins)


@app.post("/api/plugin/{plugin_id}/{capability}")
async def call_plugin_capability(plugin_id: str, capability: str, req: PluginCallRequest):
    """Execute a plugin's Python capability."""
    try:
        # Ensure plugin is loaded
        if plugin_id not in engine.loaded_plugins:
            if not engine.load_plugin(plugin_id):
                return JSONResponse(
                    content=CapabilityResponse(error=f"Plugin '{plugin_id}' could not be loaded").model_dump(),
                    status_code=404,
                )

        result = await engine.call_capability(plugin_id, capability, req.params)
        return JSONResponse(content=CapabilityResponse(result=result).model_dump())
    except ValueError as e:
        return JSONResponse(
            content=CapabilityResponse(error=str(e)).model_dump(),
            status_code=404,
        )
    except RuntimeError as e:
        return JSONResponse(
            content=CapabilityResponse(error=str(e)).model_dump(),
            status_code=500,
        )
    except Exception as e:
        return JSONResponse(
            content=CapabilityResponse(error=str(e)).model_dump(),
            status_code=500,
        )


# ---------------------------------------------------------------------------
# Multimodal processing
# ---------------------------------------------------------------------------
@app.post("/api/multimodal/image-to-base64")
async def image_to_base64_endpoint(req: ImageToBase64Request):
    """Process and resize an uploaded image."""
    try:
        result = await image_to_base64({
            "image_data": req.image_data,
            "max_width": req.max_width,
        })
        return JSONResponse(content=result)
    except ValueError as e:
        return JSONResponse(content={"error": str(e)}, status_code=400)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.post("/api/multimodal/transcribe")
async def transcribe_endpoint(req: TranscribeRequest):
    """Transcribe audio to text (placeholder)."""
    try:
        result = await transcribe({
            "audio_data": req.audio_data,
            "mime_type": req.mime_type,
        })
        return JSONResponse(content=result)
    except ValueError as e:
        return JSONResponse(content={"error": str(e)}, status_code=400)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import threading
    import httpx

    PORT = 1011
    FRONTEND_PATH = Path(__file__).resolve().parent.parent / "index.html"
    FRONTEND_URL = f"file:///{FRONTEND_PATH.as_posix()}"

    def self_check_and_open():
        """Run a self-check then auto-open the frontend in the default browser."""
        health_url = f"http://127.0.0.1:{PORT}/health"
        for i in range(30):  # wait up to 15 seconds
            try:
                r = httpx.get(health_url, timeout=2)
                if r.status_code == 200:
                    print(f"\n[ArcUI] Self-check PASSED ({health_url})")
                    print(f"[ArcUI] Opening frontend: {FRONTEND_URL}")
                    time.sleep(0.5)
                    webbrowser.open(FRONTEND_URL)
                    return
            except Exception:
                pass
            time.sleep(0.5)
        print(f"\n[ArcUI] Self-check TIMEOUT — backend may still be starting.")

    # Start self-check in a background thread after a short delay
    threading.Thread(target=self_check_and_open, daemon=True).start()

    uvicorn.run(app, host="127.0.0.1", port=PORT)
