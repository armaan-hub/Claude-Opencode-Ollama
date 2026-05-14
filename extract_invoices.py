import os
import json
from pathlib import Path
from datetime import datetime

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


# Test the function
if __name__ == "__main__":
    files = find_invoice_files()
    print(f"Found {len(files)} invoice files:")
    for fpath, loc in files[:5]:
        print(f"  {loc}: {os.path.basename(fpath)}")
