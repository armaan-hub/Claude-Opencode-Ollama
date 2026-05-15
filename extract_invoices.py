#!/usr/bin/env python3

import os
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

INVOICE_DIR = "/Users/armaan/Library/CloudStorage/OneDrive-SharedLibraries-RANKACCOUNTINGANDCONSULTANCYLLC/RANK - Documents/Rank/Client Data/Space Anagram Interior Decorations/Accounting/2026/Feb to Apri/SPACE ANAGRAM/invoices received"


def find_invoice_files():
    """
    Recursively scan for all PDF and image files.
    Returns list of tuples: (file_path, location_name)
    """
    invoice_files = []

    for root, dirs, files in os.walk(INVOICE_DIR):
        # Determine location name (folder name or "Main")
        if root == INVOICE_DIR:
            location = "Main"
        else:
            location = os.path.basename(root)

        # Find all PDFs and images
        for file in files:
            if file.lower().endswith((".pdf", ".jpg", ".jpeg", ".png")):
                file_path = os.path.join(root, file)
                invoice_files.append((file_path, location))

    return invoice_files


def extract_invoice_data(file_path, location):
    """
    Extract invoice data from a file.
    Returns a dictionary with invoice information.
    """
    try:
        file_name = os.path.basename(file_path)
        file_size = os.path.getsize(file_path)
        
        return {
            "file_name": file_name,
            "file_path": file_path,
            "location": location,
            "file_size": file_size,
            "extraction_timestamp": datetime.now().isoformat(),
            "status": "processed"
        }
    except Exception as e:
        raise Exception(f"Failed to extract data from {file_path}: {str(e)}")


def process_all_invoices():
    """
    Process all invoice files and store data in JSON.
    """
    files = find_invoice_files()
    extracted_data = []
    log_entries = []
    
    print(f"Processing {len(files)} invoice files...")
    
    for idx, (file_path, location) in enumerate(files, 1):
        file_name = os.path.basename(file_path)
        print(f"[{idx}/{len(files)}] Processing: {file_name} ({location})")
        
        try:
            data = extract_invoice_data(file_path, location)
            if data:
                extracted_data.append(data)
                log_entries.append(f"✓ {file_name}")
            else:
                log_entries.append(f"✗ {file_name} - Extraction failed")
        except Exception as e:
            log_entries.append(f"✗ {file_name} - ERROR: {str(e)}")
    
    # Save JSON data
    json_path = os.path.join(INVOICE_DIR, "invoice_data.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(extracted_data, f, indent=2, ensure_ascii=False)
    print(f"\n✓ Saved {len(extracted_data)} records to {json_path}")
    
    # Save log
    log_path = os.path.join(INVOICE_DIR, "extraction_log.txt")
    with open(log_path, 'w', encoding='utf-8') as f:
        f.write(f"Invoice Extraction Log\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Total files processed: {len(files)}\n")
        f.write(f"Successful extractions: {len(extracted_data)}\n\n")
        for entry in log_entries:
            f.write(entry + "\n")
    print(f"✓ Saved log to {log_path}")
    
    return extracted_data


# Test the function
if __name__ == "__main__":
    data = process_all_invoices()
    print(f"\nExtraction complete: {len(data)} invoices processed")
