"""Export all data: a zip with one CSV per table."""

import csv
import io
import zipfile

from sqlalchemy.orm import Session

from app import clock
from app.models import Base


def export_zip(session: Session) -> tuple[str, bytes]:
    """The file name (life-os-2026-11-18.zip) and the zip. Empty cells are NULLs."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for table in Base.metadata.sorted_tables:
            rows = session.execute(table.select().order_by(*table.primary_key.columns)).all()
            text = io.StringIO(newline="")
            writer = csv.writer(text)
            writer.writerow(column.name for column in table.columns)
            writer.writerows(rows)
            archive.writestr(f"{table.name}.csv", text.getvalue())
    return f"life-os-{clock.today().isoformat()}.zip", buffer.getvalue()
