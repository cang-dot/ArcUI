# ArcUI - models.py
"""
Pydantic request/response models for ArcUI backend.
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any, List


class ProxyRequest(BaseModel):
    """Generic API proxy request."""
    url: str
    method: str = "POST"
    headers: Dict[str, str] = {}
    body: Dict[str, Any] = {}


class PluginCallRequest(BaseModel):
    """Request to execute a plugin Python capability."""
    params: Dict[str, Any] = {}
    api_key: Optional[str] = None


class ImageToBase64Request(BaseModel):
    """Request to process an image file."""
    image_data: str  # base64 encoded image data
    max_width: int = 2048


class ImageToBase64Response(BaseModel):
    """Response with processed image base64."""
    base64: str
    mime_type: str
    width: int
    height: int


class TranscribeRequest(BaseModel):
    """Request to transcribe audio."""
    audio_data: str  # base64 encoded audio
    mime_type: str = "audio/webm"


class TranscribeResponse(BaseModel):
    """Response with transcribed text."""
    text: str
    language: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str = "ArcUI Backend"
    version: str = "1.0.0"
    has_identity: bool = False
    plugins_loaded: List[str] = []


class PluginInfo(BaseModel):
    """Information about a loaded plugin."""
    id: str
    name: str
    name_en: str
    version: str
    author: str
    capabilities: List[str]


class PluginsListResponse(BaseModel):
    """Response listing all loaded plugins."""
    plugins: List[PluginInfo] = []


class CapabilityResponse(BaseModel):
    """Generic response from a plugin capability call."""
    result: Any = None
    error: Optional[str] = None
