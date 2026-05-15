#!/usr/bin/env python3

import os
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from pdf2image import convert_from_path
from PIL import Image
import pytesseract
import re
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


def extract_text_from_file(file_path):
    """
    Convert PDF or image to text using OCR.
    Returns: tuple (text, None) on success, (None, error_msg) on failure
    """
    try:
        if file_path.lower().endswith('.pdf'):
            # Convert PDF to images
            images = convert_from_path(file_path, dpi=150)
            text = ""
            for image in images[:5]:  # Limit to first 5 pages for speed
                text += pytesseract.image_to_string(image) + "\n"
            return text, None
        else:
            # Process image directly
            image = Image.open(file_path)
            return pytesseract.image_to_string(image), None
    except Exception as e:
        return None, str(e)


def extract_invoice_data(file_path, location):
    """
    Extract structured invoice data from OCR text.
    Returns: dict with extracted fields or None if extraction fails
    """
    text, error = extract_text_from_file(file_path)
    
    if error or text is None:
        return None

    # Initialize data structure
    data = {
        "file_path": file_path,
        "location": location,
        "date": None,
        "supplier_name": None,
        "invoice_no": None,
        "quantity": None,
        "taxable_amount": None,
        "vat_percent": None,
        "vat_amount": None,
        "total_amount": None,
        "raw_text": text[:500]  # Store first 500 chars for debugging
    }

    # Extract Invoice Number (common patterns)
    invoice_patterns = [
        r'INV[^0-9]*(\d+)',
        r'Invoice\s*#?\s*(\d+)',
        r'Invoice\s*No\.?\s*(\d+)',
        r'GD-PI-(\d+)'
    ]
    for pattern in invoice_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            data["invoice_no"] = match.group(1)
            break

    # Extract Date (patterns: DD-MM-YY, DD/MM/YYYY, etc.)
    date_patterns = [
        r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
        r'Date[^0-9]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})'
    ]
    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            data["date"] = match.group(1)
            break

    # Extract Total Amount (look for "Total", "Grand Total", "Amount Due")
    total_patterns = [
        r'[Gg]rand\s+[Tt]otal\s*:?\s*([0-9,]+\.?\d*)',
        r'[Tt]otal\s+[Aa]mount\s*:?\s*([0-9,]+\.?\d*)',
        r'[Aa]mount\s+[Dd]ue\s*:?\s*([0-9,]+\.?\d*)',
        r'TOTAL\s*:?\s*([0-9,]+\.?\d*)'
    ]
    for pattern in total_patterns:
        match = re.search(pattern, text)
        if match:
            amount_str = match.group(1).replace(',', '')
            data["total_amount"] = amount_str
            break

    # Extract VAT % and VAT Amount
    vat_patterns = [
        r'VAT\s*(\d+)\s*%',
        r'TAX\s*(\d+)\s*%'
    ]
    for pattern in vat_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            data["vat_percent"] = match.group(1)
            break

    vat_amount_patterns = [
        r'VAT\s+Amount\s*:?\s*([0-9,]+\.?\d*)',
        r'Tax\s+Amount\s*:?\s*([0-9,]+\.?\d*)'
    ]
    for pattern in vat_amount_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount_str = match.group(1).replace(',', '')
            data["vat_amount"] = amount_str
            break

    # Extract Taxable Amount (Subtotal before VAT)
    taxable_patterns = [
        r'[Ss]ubtotal\s*:?\s*([0-9,]+\.?\d*)',
        r'[Tt]axable\s+[Aa]mount\s*:?\s*([0-9,]+\.?\d*)',
        r'Before\s+TAX\s*:?\s*([0-9,]+\.?\d*)'
    ]
    for pattern in taxable_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount_str = match.group(1).replace(',', '')
            data["taxable_amount"] = amount_str
            break

    # Extract Supplier Name (often near top or after company name)
    supplier_patterns = [
        r'From\s*:?\s*([A-Za-z0-9\s&\-\.(),/]+)',
        r'Supplier\s*:?\s*([A-Za-z0-9\s&\-\.(),/]+)',
        r'Vendor\s*:?\s*([A-Za-z0-9\s&\-\.(),/]+)'
    ]
    for pattern in supplier_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            if len(name) > 3 and len(name) < 100:
                data["supplier_name"] = name
                break

    # If supplier not found, try to extract company name from top lines
    if not data["supplier_name"]:
        lines = text.split('\n')
        for line in lines[:10]:
            line = line.strip()
            if len(line) > 5 and len(line) < 100:
                data["supplier_name"] = line
                break

    return data


def process_all_invoices():
    """
    Process all invoice files and store data in JSON.
    """
    # Validate output directory
    if not os.path.isdir(INVOICE_DIR):
        print(f"ERROR: Output directory does not exist: {INVOICE_DIR}")
        return None
    if not os.access(INVOICE_DIR, os.W_OK):
        print(f"ERROR: Output directory is not writable: {INVOICE_DIR}")
        return None
    
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
    
    # Save JSON data with error handling
    try:
        json_path = os.path.join(INVOICE_DIR, "invoice_data.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(extracted_data, f, indent=2, ensure_ascii=False)
        print(f"\n✓ Saved {len(extracted_data)} records to {json_path}")
    except Exception as e:
        print(f"✗ ERROR writing JSON: {e}")
        print(f"  Extracted data may be lost!")
        return None
    
    # Save log file with error handling
    try:
        log_path = os.path.join(INVOICE_DIR, "extraction_log.txt")
        with open(log_path, 'w', encoding='utf-8') as f:
            f.write(f"Invoice Extraction Log\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Total files processed: {len(files)}\n")
            f.write(f"Successful extractions: {len(extracted_data)}\n\n")
            for entry in log_entries:
                f.write(entry + "\n")
        print(f"✓ Saved log to {log_path}")
    except Exception as e:
        print(f"✗ ERROR writing log file: {e}")
        print(f"  Log data may be incomplete!")
        return None
    
    return extracted_data


def generate_excel_from_json(json_path, output_path):
    """
    Convert JSON invoice data to formatted Excel file with totals.
    """
    # Load JSON data
    with open(json_path, 'r', encoding='utf-8') as f:
        invoice_data = json.load(f)
    
    # Create workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Invoices"
    
    # Define headers
    headers = ["Date", "Supplier Name", "Invoice No.", "Quantity", 
               "Taxable Amount", "VAT %", "VAT Amount", "Total Amount", "Location"]
    
    # Write headers with formatting
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF")
    border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.border = border
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    
    # Write data rows
    for row_idx, invoice in enumerate(invoice_data, 2):
        ws.cell(row=row_idx, column=1, value=invoice.get("date", ""))
        ws.cell(row=row_idx, column=2, value=invoice.get("supplier_name", ""))
        ws.cell(row=row_idx, column=3, value=invoice.get("invoice_no", ""))
        ws.cell(row=row_idx, column=4, value=invoice.get("quantity", ""))
        
        # Format amounts as numbers
        taxable = invoice.get("taxable_amount", "")
        if taxable:
            try:
                cell = ws.cell(row=row_idx, column=5, value=float(taxable))
                cell.number_format = '#,##0.00'
            except (ValueError, TypeError):
                ws.cell(row=row_idx, column=5, value=taxable)
        
        ws.cell(row=row_idx, column=6, value=invoice.get("vat_percent", ""))
        
        vat_amt = invoice.get("vat_amount", "")
        if vat_amt:
            try:
                cell = ws.cell(row=row_idx, column=7, value=float(vat_amt))
                cell.number_format = '#,##0.00'
            except (ValueError, TypeError):
                ws.cell(row=row_idx, column=7, value=vat_amt)
        
        total = invoice.get("total_amount", "")
        if total:
            try:
                cell = ws.cell(row=row_idx, column=8, value=float(total))
                cell.number_format = '#,##0.00'
            except (ValueError, TypeError):
                ws.cell(row=row_idx, column=8, value=total)
        
        ws.cell(row=row_idx, column=9, value=invoice.get("location", ""))
        
        # Apply borders
        for col in range(1, 10):
            ws.cell(row=row_idx, column=col).border = border
            if col in [5, 7, 8]:  # Numeric columns
                ws.cell(row=row_idx, column=col).alignment = Alignment(horizontal="right")
    
    # Add totals row
    total_row = len(invoice_data) + 2
    ws.cell(row=total_row, column=1, value="TOTALS:")
    ws.cell(row=total_row, column=1).font = Font(bold=True)
    
    # Sum formulas with currency formatting
    cell = ws.cell(row=total_row, column=5, value=f"=SUM(E2:E{len(invoice_data)+1})")
    cell.number_format = '#,##0.00'
    
    cell = ws.cell(row=total_row, column=7, value=f"=SUM(G2:G{len(invoice_data)+1})")
    cell.number_format = '#,##0.00'
    
    cell = ws.cell(row=total_row, column=8, value=f"=SUM(H2:H{len(invoice_data)+1})")
    cell.number_format = '#,##0.00'
    
    # Format totals row
    for col in [1, 5, 7, 8]:
        cell = ws.cell(row=total_row, column=col)
        cell.font = Font(bold=True)
        cell.fill = PatternFill(start_color="E7E6E6", end_color="E7E6E6", fill_type="solid")
        cell.border = border
    
    # Adjust column widths
    ws.column_dimensions['A'].width = 12
    ws.column_dimensions['B'].width = 25
    ws.column_dimensions['C'].width = 15
    ws.column_dimensions['D'].width = 12
    ws.column_dimensions['E'].width = 15
    ws.column_dimensions['F'].width = 10
    ws.column_dimensions['G'].width = 15
    ws.column_dimensions['H'].width = 15
    ws.column_dimensions['I'].width = 15
    
    # Save workbook
    wb.save(output_path)
    print(f"✓ Excel file saved: {output_path}")
    print(f"  - {len(invoice_data)} invoice records")
    print(f"  - Summary row with totals")



# Test the function
if __name__ == "__main__":
    files = find_invoice_files()
    print(f"Found {len(files)} invoice files")

    # Also test extraction
    if files:
        test_file, test_location = files[0]
        print(f"\nTesting extraction on: {os.path.basename(test_file)}")
        data = extract_invoice_data(test_file, test_location)
        if data:
            print(f"Invoice No: {data.get('invoice_no')}")
            print(f"Date: {data.get('date')}")
            print(f"Supplier: {data.get('supplier_name')}")
            print(f"Total: {data.get('total_amount')}")
        else:
            print("Extraction failed")

    data = process_all_invoices()
    
    # Generate Excel
    json_path = os.path.join(INVOICE_DIR, "invoice_data.json")
    excel_path = os.path.join(INVOICE_DIR, "Invoice_Summary.xlsx")
    generate_excel_from_json(json_path, excel_path)
    
    print(f"\n✓ All processing complete!")
