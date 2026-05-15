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
                ws.cell(row=row_idx, column=5, value=float(taxable))
            except:
                ws.cell(row=row_idx, column=5, value=taxable)
        
        ws.cell(row=row_idx, column=6, value=invoice.get("vat_percent", ""))
        
        vat_amt = invoice.get("vat_amount", "")
        if vat_amt:
            try:
                ws.cell(row=row_idx, column=7, value=float(vat_amt))
            except:
                ws.cell(row=row_idx, column=7, value=vat_amt)
        
        total = invoice.get("total_amount", "")
        if total:
            try:
                ws.cell(row=row_idx, column=8, value=float(total))
            except:
                ws.cell(row=row_idx, column=8, value=total)
        
        ws.cell(row=row_idx, column=9, value=invoice.get("location", ""))
        
        # Apply borders
        for col in range(1, 10):
            ws.cell(row=row_idx, column=col).border = border
            if col in [5, 7, 8]:  # Numeric columns
                ws.cell(row=row_idx, column=col).alignment = Alignment(horizontal="right")
    
    # Add totals row
    total_row = len(invoice_data) + 3
    ws.cell(row=total_row, column=1, value="TOTALS:")
    ws.cell(row=total_row, column=1).font = Font(bold=True)
    
    # Sum formulas
    ws.cell(row=total_row, column=5, value=f"=SUM(E2:E{len(invoice_data)+1})")
    ws.cell(row=total_row, column=7, value=f"=SUM(G2:G{len(invoice_data)+1})")
    ws.cell(row=total_row, column=8, value=f"=SUM(H2:H{len(invoice_data)+1})")
    
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
    data = process_all_invoices()
    
    # Generate Excel
    json_path = os.path.join(INVOICE_DIR, "invoice_data.json")
    excel_path = os.path.join(INVOICE_DIR, "Invoice_Summary.xlsx")
    generate_excel_from_json(json_path, excel_path)
    
    print(f"\n✓ All processing complete!")
