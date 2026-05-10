import csv
import logging
import re
from pathlib import Path
from typing import Callable, Iterable, List

logger = logging.getLogger(__name__)

CHUNK_SIZE = 1000
PROGRESS_INTERVAL = 100


def process_batch(file_path: str, processor: Callable, ocr_enabled: bool = False) -> List[dict]:
    """Process batch of files (CSV, Excel, PDFs)."""
    path = Path(file_path)
    if not path.exists():
        return [{"error": f"File not found: {file_path}"}]

    try:
        suffix = path.suffix.lower()
        if suffix == ".csv":
            rows = _read_csv_rows(path)
        elif suffix == ".xlsx":
            rows = _read_excel_rows(path, ocr_enabled=ocr_enabled)
        elif suffix == ".pdf":
            rows = _read_pdf_rows(path, ocr_enabled=ocr_enabled)
        else:
            return [{"error": f"Unsupported file type: {suffix or 'unknown'}"}]
    except Exception as exc:
        return [{"error": f"Failed to parse {file_path}: {exc}"}]

    return _process_rows(rows, processor)


def _read_csv_rows(path: Path) -> List[dict]:
    with path.open("r", newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _read_excel_rows(path: Path, ocr_enabled: bool = False) -> List[dict]:
    try:
        import openpyxl
    except ModuleNotFoundError as exc:
        raise RuntimeError("openpyxl is required to process Excel files") from exc

    if ocr_enabled:
        logger.info("OCR requested for Excel; OCR support is future work. Processing cell values only.")

    workbook = openpyxl.load_workbook(path, data_only=True, read_only=True)
    try:
        sheet = workbook.active
        iterator = sheet.iter_rows(values_only=True)
        headers_row = next(iterator, None)
        if headers_row is None:
            return []

        headers = [
            str(value).strip() if value is not None and str(value).strip() else f"column_{idx + 1}"
            for idx, value in enumerate(headers_row)
        ]

        rows: List[dict] = []
        for values in iterator:
            if not values or all(value is None for value in values):
                continue
            row = {headers[idx]: value for idx, value in enumerate(values)}
            rows.append(row)
        return rows
    finally:
        workbook.close()


def _read_pdf_rows(path: Path, ocr_enabled: bool = False) -> List[dict]:
    if ocr_enabled:
        logger.info("OCR requested for PDF; OCR support is future work. Using basic text extraction.")

    content = path.read_bytes()
    snippets = re.findall(rb"[A-Za-z0-9][A-Za-z0-9 \t,.\-_/]{3,}", content)
    lines = [snippet.decode("latin-1", errors="ignore").strip() for snippet in snippets]
    cleaned = [line for line in lines if line]

    if not cleaned:
        return [{"text": ""}]
    return [{"text": line} for line in cleaned]


def _process_rows(rows: Iterable[dict], processor: Callable) -> List[dict]:
    if not isinstance(rows, list):
        rows = list(rows)

    total = len(rows)
    results: List[dict] = []
    for chunk_start in range(0, total, CHUNK_SIZE):
        chunk_end = min(chunk_start + CHUNK_SIZE, total)
        if total > CHUNK_SIZE:
            logger.info("Processing chunk %s-%s/%s", chunk_start + 1, chunk_end, total)

        for index, row in enumerate(rows[chunk_start:chunk_end], start=chunk_start + 1):
            try:
                processed = processor(row)
                if isinstance(processed, dict):
                    results.append(processed)
                else:
                    results.append({"processed": processed})
            except Exception as exc:
                results.append({"error": str(exc), "row": index})

            if index % PROGRESS_INTERVAL == 0 or index == total:
                logger.info("Processed %s/%s rows", index, total)

    return results
