#!/usr/bin/env python3
"""JobSpy aggregation CLI bridge for Indeed, Glassdoor, Google Jobs, and ZipRecruiter.

Runs JobSpy via a lightweight subprocess without Docker, returning standardized JSON.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any


def _find_jobspy_interpreter() -> str | None:
    """Find a Python interpreter that has python-jobspy installed."""
    # 1. Check if current interpreter has jobspy
    try:
        import jobspy  # noqa: F401
        return sys.executable
    except ImportError:
        pass

    # 2. Check known venv locations
    candidates = [
        os.path.expanduser("~/.ai-job-search/jobspy-env/bin/python3"),
        os.path.expanduser("~/.ai-job-search/jobspy-env/bin/python"),
        os.path.expanduser("~/.ai-job-search/venv/bin/python3"),
        os.path.expanduser("~/.venv/bin/python3"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".venv", "bin", "python3"),
    ]

    for cand in candidates:
        if os.path.isfile(cand) and os.access(cand, os.X_OK):
            # Test if candidate can import jobspy
            import subprocess
            try:
                res = subprocess.run([cand, "-c", "import jobspy"], capture_output=True, timeout=5)
                if res.returncode == 0:
                    return cand
            except Exception:
                continue

    return None


def format_salary(min_amt: Any, max_amt: Any, currency: Any, interval: Any) -> str | None:
    """Format salary range into human-readable string."""
    try:
        min_val = float(min_amt) if min_amt is not None and str(min_amt).lower() != "none" else None
    except (ValueError, TypeError):
        min_val = None

    try:
        max_val = float(max_amt) if max_amt is not None and str(max_amt).lower() != "none" else None
    except (ValueError, TypeError):
        max_val = None

    if min_val is None and max_val is None:
        return None

    curr = str(currency or "GBP").strip().upper()
    curr_symbol = "£" if curr == "GBP" else "$" if curr == "USD" else "€" if curr == "EUR" else f"{curr} "
    
    interval_str = f"/{interval}" if interval and str(interval).lower() not in ("none", "yearly", "year") else ""

    if min_val is not None and max_val is not None and min_val != max_val:
        return f"{curr_symbol}{min_val:,.0f} - {curr_symbol}{max_val:,.0f}{interval_str}"
    val = min_val if min_val is not None else max_val
    return f"{curr_symbol}{val:,.0f}{interval_str}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape jobs via JobSpy without Docker")
    parser.add_argument("--query", required=True, help="Job title or search keyword")
    parser.add_argument("--location", default="", help="Location or city name")
    parser.add_argument("--country", default="uk", help="Country for Indeed (e.g. uk, usa, denmark, germany)")
    parser.add_argument("--limit", type=int, default=10, help="Max jobs per site")
    parser.add_argument("--hours-old", type=int, default=168, help="Max listing age in hours")
    parser.add_argument("--sites", default="indeed,glassdoor,google,zip_recruiter", help="Comma-separated sites")

    args = parser.parse_args()

    # Re-exec under virtualenv interpreter if current Python lacks jobspy
    interpreter = _find_jobspy_interpreter()
    if interpreter and interpreter != sys.executable:
        os.execv(interpreter, [interpreter, os.path.abspath(__file__)] + sys.argv[1:])

    try:
        from jobspy import scrape_jobs
    except ImportError:
        output = {
            "success": False,
            "error": "jobspy_not_installed",
            "message": (
                "python-jobspy is not installed. Run: "
                "mkdir -p ~/.ai-job-search && ~/.local/share/uv/python/cpython-3.13-macos-aarch64-none/bin/python3 -m venv ~/.ai-job-search/jobspy-env "
                "&& ~/.ai-job-search/jobspy-env/bin/pip install python-jobspy"
            ),
            "jobs": [],
        }
        print(json.dumps(output))
        return 0

    sites_requested = [s.strip().lower() for s in args.sites.split(",") if s.strip()]
    if not sites_requested:
        sites_requested = ["indeed", "glassdoor", "google", "zip_recruiter"]

    results = []
    # Scrape sites individually or grouped to prevent one failing site from blocking others
    for site in sites_requested:
        try:
            df = scrape_jobs(
                site_name=[site],
                search_term=args.query,
                google_search_term=f"{args.query} jobs {args.location}".strip() if site == "google" else None,
                location=args.location,
                results_wanted=args.limit,
                hours_old=args.hours_old,
                country_indeed=args.country.lower() if args.country else "uk",
                verbose=0,
            )
            if df is not None and not df.empty:
                results.append(df)
        except Exception as e:
            # Silently degrade for individual site errors (e.g. Google changing HTML structure)
            sys.stderr.write(f"JobSpy warning for {site}: {e}\n")

    if not results:
        print(json.dumps({"success": True, "found": 0, "jobs": []}))
        return 0

    import pandas as pd
    combined = pd.concat(results, ignore_index=True)

    jobs = []
    for idx, row in combined.iterrows():
        raw_site = str(row.get("site") or "jobspy").lower()
        site_label = {
            "indeed": "Indeed",
            "glassdoor": "Glassdoor",
            "google": "Google",
            "zip_recruiter": "ZipRecruiter",
        }.get(raw_site, raw_site.capitalize())

        raw_id = str(row.get("id") or f"{raw_site}_{idx}").strip()
        job_url = str(row.get("job_url_direct") or row.get("job_url") or "").strip()
        if not job_url:
            continue

        title = str(row.get("title") or "").strip()
        company = str(row.get("company") or "").strip()
        if not title or not company:
            continue

        location = str(row.get("location") or args.location or "").strip()
        date_posted = str(row.get("date_posted") or "").strip()
        if date_posted and date_posted.lower() != "nat" and date_posted.lower() != "none":
            posted_date = date_posted[:10]
        else:
            from datetime import date
            posted_date = date.today().isoformat()

        salary = format_salary(
            row.get("min_amount"),
            row.get("max_amount"),
            row.get("currency"),
            row.get("interval"),
        )

        desc = str(row.get("description") or "").strip()
        if desc.lower() == "none":
            desc = ""

        jobs.append({
            "id": f"jobspy_{raw_site}_{raw_id}",
            "externalId": raw_id,
            "title": title,
            "company": company,
            "location": location,
            "url": job_url,
            "postedDate": posted_date,
            "description": desc,
            "salary": salary or "Not advertised",
            "portal": "jobspy",
            "site": raw_site,
            "sourceLabel": f"JobSpy ({site_label})",
            "source": "jobspy",
        })

    print(json.dumps({"success": True, "found": len(jobs), "jobs": jobs}))
    return 0


if __name__ == "__main__":
    sys.exit(main())

