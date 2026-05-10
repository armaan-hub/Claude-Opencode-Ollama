import csv

import pytest

from universal_llm.document_processor import process_batch


def test_process_csv_batch(tmp_path):
    csv_path = tmp_path / "test.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["id", "name"])
        writer.writeheader()
        writer.writerow({"id": "1", "name": "Alice"})
        writer.writerow({"id": "2", "name": "Bob"})

    processor = lambda row: {"processed": row}
    results = process_batch(str(csv_path), processor)

    assert len(results) > 0
    assert all("processed" in r or "error" in r for r in results)


def test_process_excel_with_ocr(tmp_path):
    openpyxl = pytest.importorskip("openpyxl")
    excel_path = tmp_path / "test.xlsx"

    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(["id", "name"])
    sheet.append([1, "Alice"])
    sheet.append([2, "Bob"])
    workbook.save(excel_path)

    processor = lambda row: {"processed": row}
    results = process_batch(str(excel_path), processor, ocr_enabled=True)

    assert all(isinstance(r, dict) for r in results)


def test_batch_error_handling():
    processor = lambda row: {"processed": row}
    results = process_batch("/nonexistent.csv", processor)
    assert "error" in results[0]
