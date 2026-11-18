from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.frontend import NOT_BUILT

INDEX = "<!doctype html><title>Life OS</title>"


@pytest.fixture
def dist(tmp_path: Path) -> Iterator[Path]:
    """A built frontend in a temporary folder, served in place of `frontend/dist`."""
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text(INDEX, encoding="utf-8")
    (dist / "assets" / "index-abc123.js").write_text("console.log(1)", encoding="utf-8")
    (dist / "favicon.svg").write_text("<svg/>", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("outside dist", encoding="utf-8")

    settings = get_settings()
    original = settings.frontend_dist
    settings.frontend_dist = dist
    yield dist
    settings.frontend_dist = original


@pytest.mark.usefixtures("dist")
def test_root_serves_index(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.text == INDEX
    assert response.headers["content-type"].startswith("text/html")
    assert response.headers["cache-control"] == "no-cache"


@pytest.mark.usefixtures("dist")
@pytest.mark.parametrize("path", ["/home", "/areas/projects/12", "/settings?tab=backups"])
def test_app_routes_fall_back_to_index(client: TestClient, path: str) -> None:
    response = client.get(path)

    assert response.status_code == 200
    assert response.text == INDEX


@pytest.mark.usefixtures("dist")
def test_hashed_assets_are_cached_for_good(client: TestClient) -> None:
    response = client.get("/assets/index-abc123.js")

    assert response.status_code == 200
    assert response.text == "console.log(1)"
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"


@pytest.mark.usefixtures("dist")
def test_other_files_are_served_and_revalidated(client: TestClient) -> None:
    response = client.get("/favicon.svg")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-cache"


@pytest.mark.usefixtures("dist")
def test_a_missing_file_is_a_404_not_the_page(client: TestClient) -> None:
    response = client.get("/assets/index-old999.js")

    assert response.status_code == 404
    assert response.text != INDEX


@pytest.mark.usefixtures("dist")
def test_paths_never_leave_dist(client: TestClient) -> None:
    for path in ["/../secret.txt", "/%2e%2e/secret.txt", "/assets/..%2f..%2fsecret.txt"]:
        response = client.get(path)
        assert "outside dist" not in response.text


@pytest.mark.usefixtures("dist")
@pytest.mark.parametrize("path", ["/api", "/api/", "/api/nope", "/api/tasks/999999/nope"])
def test_unknown_api_paths_stay_json_404s(client: TestClient, path: str) -> None:
    response = client.get(path)

    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}


@pytest.mark.usefixtures("dist")
def test_api_routes_still_answer(client: TestClient) -> None:
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/api/life-areas/999999").status_code == 404


@pytest.mark.usefixtures("dist")
def test_a_wrong_method_on_an_api_route_is_still_405(client: TestClient) -> None:
    assert client.delete("/api/health").status_code == 405
    assert client.post("/api/health").status_code == 405


@pytest.mark.usefixtures("dist")
def test_head_works_for_pages(client: TestClient) -> None:
    assert client.head("/home").status_code == 200


def test_without_a_build_pages_say_how_to_build(client: TestClient, tmp_path: Path) -> None:
    settings = get_settings()
    original = settings.frontend_dist
    settings.frontend_dist = tmp_path / "missing"
    try:
        response = client.get("/home")
    finally:
        settings.frontend_dist = original

    assert response.status_code == 404
    assert response.text == NOT_BUILT


def test_the_catch_all_is_not_in_the_api_schema(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]

    assert all(path.startswith("/api/") for path in paths)
