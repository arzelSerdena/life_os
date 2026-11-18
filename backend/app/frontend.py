"""Serves the built frontend (`frontend/dist`), so one server runs the whole app.

In development Vite serves the frontend and proxies `/api` here; this only matters once
`pnpm build` has run. Every path outside `/api` that isn't a file in `dist` gets
`index.html`, so React Router handles it. Paths under `/api` never fall back: an unknown
one is the usual JSON 404.
"""

from pathlib import Path

from fastapi import FastAPI, Request, status
from starlette.responses import FileResponse, JSONResponse, PlainTextResponse, Response

from app.config import get_settings

# Vite puts a content hash in every file name under assets/, so they never change.
_IMMUTABLE = "public, max-age=31536000, immutable"
# index.html names the current assets, so the browser checks it every time.
_REVALIDATE = "no-cache"

NOT_BUILT = "The frontend isn't built. Run `just build`, or use the Vite dev server."


def _is_api(path: str) -> bool:
    return path == "api" or path.startswith("api/")


def _file_in(dist: Path, path: str) -> Path | None:
    """The file `path` names inside `dist`, or None. Never leaves `dist`."""
    if not path:
        return None
    candidate = (dist / path).resolve()
    if candidate.is_relative_to(dist) and candidate.is_file():
        return candidate
    return None


async def serve_frontend(request: Request) -> Response:
    path: str = request.path_params["path"]
    if _is_api(path):
        return JSONResponse({"detail": "Not Found"}, status_code=status.HTTP_404_NOT_FOUND)

    dist = get_settings().frontend_dist.resolve()
    file = _file_in(dist, path)
    if file is not None:
        cache = _IMMUTABLE if file.parent == dist / "assets" else _REVALIDATE
        return FileResponse(file, headers={"Cache-Control": cache})

    # A missing file (an old hashed chunk, say) is a 404, not the page, so it fails clearly.
    if "." in path.rsplit("/", 1)[-1]:
        return PlainTextResponse("Not Found", status_code=status.HTTP_404_NOT_FOUND)

    index = dist / "index.html"
    if not index.is_file():
        return PlainTextResponse(NOT_BUILT, status_code=status.HTTP_404_NOT_FOUND)
    return FileResponse(index, headers={"Cache-Control": _REVALIDATE})


def add_frontend_route(app: FastAPI) -> None:
    """Add the catch-all last, so every API route matches first.

    It's a plain Starlette route for GET and HEAD only: it skips the app's dependencies
    (which read the database), and a wrong method on an API path still gets that route's 405.
    """
    app.router.add_route(
        "/{path:path}", serve_frontend, methods=["GET", "HEAD"], include_in_schema=False
    )
