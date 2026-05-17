"""
AMFI TER Data Pipeline
======================
Downloads TER Excel from AMFI, processes data,
generates JSON files for the website.
Runs daily via GitHub Actions.
"""

import os
import json
import pandas as pd
from datetime import datetime, timedelta
from amfipy import AMFIClient

# Paths
DATA_DIR = "data"
DOCS_DATA_DIR = os.path.join("docs", "data")
DAILY_DIR = os.path.join(DOCS_DATA_DIR, "daily")

# Create folders
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(DAILY_DIR, exist_ok=True)


def get_months_list():
    """Generate list of months from March 2026 to current month"""
    months = []
    year, month = 2026, 3  # Start: March 2026
    now = datetime.now()

    while (year, month) <= (now.year, now.month):
        months.append(f"{month:02d}-{year}")
        month += 1
        if month > 12:
            month = 1
            year += 1
    return months


def find_column(columns, *keywords):
    """Find a column name that contains ALL given keywords (case-insensitive)"""
    for col in columns:
        col_lower = col.lower()
        if all(kw.lower() in col_lower for kw in keywords):
            return col
    return None


def download_excels():
    """Download TER Excels from AMFI"""
    client = AMFIClient()
    current_month = datetime.now().strftime("%m-%Y")
    months = get_months_list()

    for month in months:
        file_path = os.path.join(DATA_DIR, f"TER_{month}.xlsx")

        # Always re-download current month; skip past months if file exists
        if month != current_month and os.path.exists(file_path):
            size = os.path.getsize(file_path)
            if size > 1000:
                print(f"  Skipping {month} (already exists, {size} bytes)")
                continue

        print(f"  Downloading {month}...")
        try:
            excel_bytes = client.ter.download_excel(month=month)
            if excel_bytes and len(excel_bytes) > 500:
                with open(file_path, "wb") as f:
                    f.write(excel_bytes)
                size_kb = round(len(excel_bytes) / 1024, 1)
                print(f"    Saved: {file_path} ({size_kb} KB)")
            else:
                print(f"    No data for {month}")
        except Exception as e:
            print(f"    Error: {e}")


def process_data():
    """Read all Excels, compute averages, generate JSON files for website"""

    # --- Read all Excel files ---
    all_dfs = []
    for file in sorted(os.listdir(DATA_DIR)):
        if file.endswith(".xlsx"):
            path = os.path.join(DATA_DIR, file)
            try:
                df = pd.read_excel(path, sheet_name=0)
                if len(df) > 0:
                    all_dfs.append(df)
                    print(f"  Read {file}: {len(df)} rows")
            except Exception as e:
                print(f"  Error reading {file}: {e}")

    if not all_dfs:
        print("  No data files found!")
        return

    combined = pd.concat(all_dfs, ignore_index=True)
    print(f"\n  Combined: {len(combined)} total rows")

    # --- Map columns ---
    cols = combined.columns.tolist()
    col_scheme_code = find_column(cols, "nsdl", "scheme", "code") or find_column(cols, "scheme", "code")
    col_scheme_name = find_column(cols, "scheme", "name")
    col_scheme_type = find_column(cols, "scheme", "type")
    col_category = find_column(cols, "scheme", "category") or find_column(cols, "category")
    col_date = find_column(cols, "ter", "date") or find_column(cols, "date")
    col_ber = find_column(cols, "direct", "ber") or find_column(cols, "direct", "base")
    col_brokerage = find_column(cols, "direct", "brokerage")
    col_transaction = find_column(cols, "direct", "transaction")
    col_statutory = find_column(cols, "direct", "statutory")
    col_total_ter = find_column(cols, "direct", "total", "ter")

    print(f"\n  Column mapping:")
    print(f"    Scheme Code : {col_scheme_code}")
    print(f"    Scheme Name : {col_scheme_name}")
    print(f"    Category    : {col_category}")
    print(f"    Date        : {col_date}")
    print(f"    BER         : {col_ber}")
    print(f"    Brokerage   : {col_brokerage}")
    print(f"    Transaction : {col_transaction}")
    print(f"    Statutory   : {col_statutory}")
    print(f"    Total TER   : {col_total_ter}")

    # --- Rename for consistency ---
    rename_map = {}
    if col_scheme_code: rename_map[col_scheme_code] = "scheme_code"
    if col_scheme_name: rename_map[col_scheme_name] = "scheme_name"
    if col_scheme_type: rename_map[col_scheme_type] = "scheme_type"
    if col_category: rename_map[col_category] = "category"
    if col_date: rename_map[col_date] = "date"
    if col_ber: rename_map[col_ber] = "ber"
    if col_brokerage: rename_map[col_brokerage] = "brokerage"
    if col_transaction: rename_map[col_transaction] = "transaction"
    if col_statutory: rename_map[col_statutory] = "statutory"
    if col_total_ter: rename_map[col_total_ter] = "total_ter"

    combined = combined.rename(columns=rename_map)

    # --- Parse dates ---
    combined["date"] = pd.to_datetime(combined["date"], dayfirst=True, errors="coerce")
    combined = combined.dropna(subset=["date", "scheme_code"])

    # Convert numeric columns
    for col in ["ber", "brokerage", "transaction", "statutory", "total_ter"]:
        if col in combined.columns:
            combined[col] = pd.to_numeric(combined[col], errors="coerce").fillna(0)

    # Remove duplicates
    combined = combined.drop_duplicates(subset=["scheme_code", "date"], keep="last")
    combined = combined.sort_values(["scheme_code", "date"])

    # --- Rolling 365-day window ---
    today = pd.Timestamp.now()
    cutoff = today - pd.Timedelta(days=365)
    data_start = combined["date"].min()

    # If less than 365 days of data, use all data
    if data_start > cutoff:
        cutoff = data_start

    recent = combined[combined["date"] >= cutoff].copy()
    print(f"\n  Data after cutoff ({cutoff.strftime('%Y-%m-%d')}): {len(recent)} rows")

    # --- Generate per-scheme data ---
    numeric_cols = ["ber", "brokerage", "transaction", "statutory", "total_ter"]
    summary_list = []
    scheme_count = 0

    for code, group in recent.groupby("scheme_code"):
        scheme_id = str(code).replace("/", "_").replace(" ", "_")

        # Summary entry
        entry = {
            "id": scheme_id,
            "scheme_code": str(code),
            "scheme_name": str(group["scheme_name"].iloc[0]) if "scheme_name" in group else "",
            "scheme_type": str(group["scheme_type"].iloc[0]) if "scheme_type" in group else "",
            "category": str(group["category"].iloc[0]) if "category" in group else "",
            "data_points": int(len(group)),
            "date_from": group["date"].min().strftime("%Y-%m-%d"),
            "date_to": group["date"].max().strftime("%Y-%m-%d"),
        }

        for col in numeric_cols:
            if col in group.columns:
                entry[f"avg_{col}"] = round(float(group[col].mean()), 4)
            else:
                entry[f"avg_{col}"] = 0

        summary_list.append(entry)

        # Daily data JSON for this scheme
        daily_data = []
        for _, row in group.iterrows():
            day_entry = {"date": row["date"].strftime("%Y-%m-%d")}
            for col in numeric_cols:
                if col in row and pd.notna(row[col]):
                    day_entry[col] = round(float(row[col]), 4)
                else:
                    day_entry[col] = 0
            daily_data.append(day_entry)

        daily_path = os.path.join(DAILY_DIR, f"{scheme_id}.json")
        with open(daily_path, "w") as f:
            json.dump(daily_data, f, separators=(",", ":"))

        scheme_count += 1

    # --- Categories list ---
    categories = sorted(set(s["category"] for s in summary_list if s["category"]))

    # --- Save summary.json ---
    summary = {
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M UTC"),
        "total_schemes": len(summary_list),
        "data_from": cutoff.strftime("%Y-%m-%d"),
        "data_to": today.strftime("%Y-%m-%d"),
        "categories": categories,
        "schemes": sorted(summary_list, key=lambda x: x["scheme_name"]),
    }

    summary_path = os.path.join(DOCS_DATA_DIR, "summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, separators=(",", ":"))

    print(f"\n  Generated: summary.json ({len(summary_list)} schemes)")
    print(f"  Generated: {scheme_count} daily data files")
    print(f"  Categories: {len(categories)}")


if __name__ == "__main__":
    print("=" * 50)
    print("AMFI TER Data Pipeline")
    print(f"Run at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)

    print("\n[1/2] Downloading Excel files from AMFI...")
    download_excels()

    print("\n[2/2] Processing data and generating JSON...")
    process_data()

    print("\n" + "=" * 50)
    print("DONE!")
    print("=" * 50)
