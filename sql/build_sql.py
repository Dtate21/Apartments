import math
import re
from pathlib import Path

import pandas as pd

# Paths
BASE_DIR = Path(__file__).resolve().parent
XLSX_PATH = BASE_DIR / "apartments_master_with_complexname.xlsx"

# This will write into db/init/02_seed.sql (one level up from project root)
OUT_PATH = BASE_DIR.parent / "db" / "init" / "02_seed.sql"


def to_int_from_range(value, allow_studio=False):
    """
    Convert things like:
      '663–824' -> 663
      '1–2'     -> 1
      'Studio'  -> 0 (if allow_studio=True)
    """
    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isnan(value):
            return None
        return int(value)

    if not isinstance(value, str):
        return None

    s = value.strip()
    if allow_studio and s.lower().startswith("studio"):
        return 0

    # Split on en dash or normal dash
    parts = re.split(r"[–-]", s)
    for p in parts:
        p = p.strip()
        if not p:
            continue
        digits = re.sub(r"[^\d]", "", p)
        if digits:
            return int(digits)

    return None


def parse_price(value):
    """
    Convert price strings like:
      '$1,589–$1,857' -> 1589
      '$1,700'       -> 1700
    """
    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isnan(value):
            return None
        return int(value)

    if not isinstance(value, str):
        return None

    match = re.search(r"([\d,]+)", value)
    if not match:
        return None

    digits = match.group(1).replace(",", "")
    return int(digits)


def escape_sql_literal(s: str) -> str:
    """Escape single quotes for SQL string literals."""
    return s.replace("'", "''")


def main():
    df = pd.read_excel(XLSX_PATH)

    rows_sql = []

    for _, r in df.iterrows():
        name = r["Property"]
        price = parse_price(r["Price_StartingOrExample"])
        sqft = to_int_from_range(r["SqFt"], allow_studio=False)
        beds = to_int_from_range(r["Beds"], allow_studio=True)
        baths = to_int_from_range(r["Baths"], allow_studio=False)

        d1 = None
        if not pd.isna(r["Approx_mi_to_Castle_Rock"]):
            d1 = float(r["Approx_mi_to_Castle_Rock"])

        d2 = None
        if not pd.isna(r["Approx_mi_to_Broomfield"]):
            d2 = float(r["Approx_mi_to_Broomfield"])

        url = r["Link"] if isinstance(r["Link"], str) and r["Link"].strip() else None

        # Fallback if sqft is missing for any row (e.g., Bell Flatirons)
        if sqft is None:
            sqft = 0

        name_sql = f"'{escape_sql_literal(name)}'"
        price_sql = "NULL" if price is None else str(price)
        sqft_sql = "NULL" if sqft is None else str(sqft)
        beds_sql = "NULL" if beds is None else str(beds)
        baths_sql = "NULL" if baths is None else str(baths)
        d1_sql = "NULL" if d1 is None else str(d1)
        d2_sql = "NULL" if d2 is None else str(d2)
        url_sql = "NULL" if url is None else f"'{escape_sql_literal(url)}'"

        rows_sql.append(
            f"  ({name_sql}, {price_sql}, {sqft_sql}, {beds_sql}, {baths_sql}, {d1_sql}, {d2_sql}, {url_sql})"
        )

    insert_block = (
        "INSERT INTO apartments "
        "(name, price, square_footage, bedrooms, bathrooms, distance1, distance2, url) VALUES\n"
        + ",\n".join(rows_sql)
        + ";\n"
    )

    full_sql = (
        "INSERT INTO users (username, password, is_dev) VALUES\n"
        "  ('Tatertot2103','2103', true)\n"
        "ON CONFLICT (username) DO NOTHING;\n\n"
        "-- Auto-generated apartment inserts from apartments_master_with_complexname.xlsx\n"
        + insert_block
    )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(full_sql, encoding="utf-8")

    print(f"Wrote seed file to {OUT_PATH}")


if __name__ == "__main__":
    main()
