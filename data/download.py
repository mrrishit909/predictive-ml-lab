"""Download the public IBM Telco Customer Churn dataset.

Source: IBM Developer / Watson Studio sample dataset, mirrored publicly at
https://github.com/IBM/telco-customer-churn-on-icp4d (Apache-2.0 repo, data is
IBM's public sample dataset used in many tutorials). 7,043 customers, one row
per customer, no PII (customerID is a synthetic identifier).
"""
import sys
import urllib.request
from pathlib import Path

URL = "https://raw.githubusercontent.com/IBM/telco-customer-churn-on-icp4d/master/data/Telco-Customer-Churn.csv"
OUT = Path(__file__).parent / "raw" / "Telco-Customer-Churn.csv"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    try:
        urllib.request.urlretrieve(URL, OUT)
        print(f"Downloaded {OUT} ({OUT.stat().st_size} bytes)")
    except Exception as e:
        print(f"Download failed ({e}); run ml/train.py with --synthetic instead", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
