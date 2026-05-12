# ArcUI - plugin_engine.py
"""
Plugin Python capability execution engine.
Loads capability.py files from plugin directories and executes their async functions.
"""
import importlib.util
import asyncio
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional


class PluginEngine:
    """Loads and executes Python capabilities from plugin directories."""

    def __init__(self, plugins_dir: str = None):
        if plugins_dir is None:
            # Default: plugins directory relative to backend/
            plugins_dir = str(Path(__file__).parent.parent / "plugins")
        self.plugins_dir = Path(plugins_dir)
        self.loaded_plugins: Dict[str, Dict[str, Any]] = {}
        # Store global API key for auto-injection
        self._api_key: Optional[str] = None

    def set_api_key(self, key: Optional[str]):
        """Set the global API key for injection into capability calls."""
        self._api_key = key

    def discover_plugins(self) -> List[str]:
        """Discover all plugin directories containing capability.py."""
        plugin_ids = []
        if not self.plugins_dir.exists():
            return plugin_ids
        for item in self.plugins_dir.iterdir():
            if item.is_dir():
                cap_file = item / "capability.py"
                if cap_file.exists():
                    plugin_ids.append(item.name)
        return plugin_ids

    def load_plugin(self, plugin_id: str) -> bool:
        """Load a plugin's capability module."""
        cap_file = self.plugins_dir / plugin_id / "capability.py"
        if not cap_file.exists():
            return False

        try:
            module_name = f"arcui_plugin_{plugin_id}"
            # Remove cached module if it was previously loaded
            if module_name in sys.modules:
                del sys.modules[module_name]

            spec = importlib.util.spec_from_file_location(module_name, cap_file)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            # Discover non-private async functions
            capabilities = {}
            for name in dir(module):
                if name.startswith("_"):
                    continue
                obj = getattr(module, name)
                if asyncio.iscoroutinefunction(obj):
                    capabilities[name] = obj

            self.loaded_plugins[plugin_id] = {
                "module": module,
                "capabilities": capabilities,
            }
            return True
        except Exception as e:
            print(f"[PluginEngine] Failed to load plugin '{plugin_id}': {e}")
            return False

    def unload_plugin(self, plugin_id: str) -> bool:
        """Unload a plugin's capability module."""
        if plugin_id in self.loaded_plugins:
            module_name = f"arcui_plugin_{plugin_id}"
            if module_name in sys.modules:
                del sys.modules[module_name]
            del self.loaded_plugins[plugin_id]
            return True
        return False

    def get_plugin_capabilities(self, plugin_id: str) -> List[str]:
        """Get the list of capability names for a loaded plugin."""
        if plugin_id in self.loaded_plugins:
            return list(self.loaded_plugins[plugin_id]["capabilities"].keys())
        return []

    def get_all_plugins_info(self) -> List[Dict[str, Any]]:
        """Get info about all loaded plugins."""
        info_list = []
        for pid, data in self.loaded_plugins.items():
            info_list.append({
                "id": pid,
                "capabilities": list(data["capabilities"].keys()),
            })
        return info_list

    async def call_capability(
        self, plugin_id: str, capability: str, params: Dict[str, Any] = None
    ) -> Any:
        """
        Execute a plugin's Python capability.
        Auto-injects api_key if the function signature accepts it.
        """
        if plugin_id not in self.loaded_plugins:
            raise ValueError(f"Plugin '{plugin_id}' is not loaded")

        capabilities = self.loaded_plugins[plugin_id]["capabilities"]
        if capability not in capabilities:
            raise ValueError(
                f"Capability '{capability}' not found in plugin '{plugin_id}'"
            )

        fn = capabilities[capability]
        params = params or {}

        # Auto-inject api_key if the function accepts it
        import inspect
        sig = inspect.signature(fn)
        if "api_key" in sig.parameters:
            params["api_key"] = params.get("api_key", self._api_key) if self._api_key else params.get("api_key", "")

        try:
            result = await fn(**params)
            return result
        except Exception as e:
            raise RuntimeError(
                f"Capability '{capability}' in plugin '{plugin_id}' failed: {e}"
            )


# Singleton instance
engine = PluginEngine()
