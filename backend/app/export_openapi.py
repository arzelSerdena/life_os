"""Write the OpenAPI schema to a file so the frontend client can be generated from it."""

import json
import sys
from pathlib import Path

from app.main import app


def main(output_path: str) -> None:
    Path(output_path).write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
