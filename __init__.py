import json
import os
import tempfile
import threading

import folder_paths
from aiohttp import web
from server import PromptServer

import nodes as comfy_nodes

RATINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ratings.json")
_lock = threading.Lock()


def _unet_list():
    names = []
    for folder in ("diffusion_models", "unet"):
        try:
            names += folder_paths.get_filename_list(folder)
        except Exception:
            pass
    return sorted(set(names)) or ["(cap model trobat)"]


def _load_ratings():
    try:
        with open(RATINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_ratings(data):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(RATINGS_FILE), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, RATINGS_FILE)


class UNETLoaderRated:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "unet_name": (_unet_list(),),
                "weight_dtype": (["default", "fp8_e4m3fn", "fp8_e4m3fn_fast", "fp8_e5m2"],),
            }
        }

    RETURN_TYPES = ("MODEL",)
    FUNCTION = "load_unet"
    CATEGORY = "advanced/loaders"

    def load_unet(self, unet_name, weight_dtype):
        return comfy_nodes.UNETLoader().load_unet(unet_name, weight_dtype)


@PromptServer.instance.routes.get("/unet_rating/ratings")
async def get_ratings(request):
    with _lock:
        return web.json_response(_load_ratings())


@PromptServer.instance.routes.post("/unet_rating/rate")
async def set_rating(request):
    body = await request.json()
    name = body.get("name")
    rating = body.get("rating")
    if not isinstance(name, str) or not isinstance(rating, int) or not 0 <= rating <= 5:
        return web.json_response({"error": "dades invalides"}, status=400)
    with _lock:
        data = _load_ratings()
        if rating == 0:
            data.pop(name, None)
        else:
            data[name] = rating
        _save_ratings(data)
    return web.json_response({"name": name, "rating": rating})


NODE_CLASS_MAPPINGS = {"UNETLoaderRated": UNETLoaderRated}
NODE_DISPLAY_NAME_MAPPINGS = {"UNETLoaderRated": "Load UNET (Rated ★)"}
WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
