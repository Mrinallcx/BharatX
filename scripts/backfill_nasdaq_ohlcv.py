#!/usr/bin/env python3
"""
Backfill daily OHLCV for all Nasdaq-listed symbols into local MongoDB via yfinance.

Default: mongodb://localhost:27017 / groww_market_data (matches BharatX env/server.ts)

Usage:
  python scripts/backfill_nasdaq_ohlcv.py              # full backfill
  python scripts/backfill_nasdaq_ohlcv.py --limit 10 # smoke test
  python scripts/backfill_nasdaq_ohlcv.py --update   # refresh latest bars only
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime, timezone
from typing import Iterable

import pandas as pd
import requests
import yfinance as yf
from pymongo import MongoClient, UpdateOne
from pymongo.collection import Collection

NASDAQ_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"
OHLCV_COLLECTION = "NASDAQ"
SYMBOLS_COLLECTION = "nasdaq_symbols"
META_COLLECTION = "backfill_meta"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill Nasdaq daily OHLCV into MongoDB")
    parser.add_argument(
        "--mongo-uri",
        default=os.environ.get("MONGODB_URI", "mongodb://localhost:27017"),
        help="MongoDB connection URI",
    )
    parser.add_argument(
        "--db",
        default=os.environ.get("MONGODB_DB", "groww_market_data"),
        help="MongoDB database name",
    )
    parser.add_argument("--batch-size", type=int, default=40, help="Symbols per yfinance batch")
    parser.add_argument("--limit", type=int, default=0, help="Max symbols (0 = all)")
    parser.add_argument(
        "--include-etfs",
        action="store_true",
        help="Include ETF symbols (default: common stocks only)",
    )
    parser.add_argument(
        "--update",
        action="store_true",
        help="Fetch only recent history (1y) and upsert — for daily cron",
    )
    parser.add_argument("--sleep", type=float, default=0.35, help="Pause between batches (seconds)")
    return parser.parse_args()


def fetch_nasdaq_symbols(include_etfs: bool) -> list[dict[str, str]]:
    response = requests.get(NASDAQ_LISTED_URL, timeout=60)
    response.raise_for_status()

    symbols: list[dict[str, str]] = []
    for line in response.text.splitlines():
        if not line or line.startswith("Symbol|") or line.startswith("File Creation Time"):
            continue

        parts = line.split("|")
        if len(parts) < 8:
            continue

        symbol, name, market_category, test_issue, financial_status, _, etf_flag, _ = parts[:8]
        if test_issue.upper() == "Y":
            continue
        if not include_etfs and etf_flag.upper() == "Y":
            continue
        if not symbol or symbol == "Symbol":
            continue

        symbols.append(
            {
                "symbol": symbol.strip().upper(),
                "name": name.strip(),
                "marketCategory": market_category.strip(),
                "financialStatus": financial_status.strip(),
                "isEtf": etf_flag.strip().upper() == "Y",
            }
        )

    symbols.sort(key=lambda row: row["symbol"])
    return symbols


def ensure_indexes(ohlcv: Collection, symbols: Collection) -> None:
    ohlcv.create_index([("symbol", 1), ("date", 1)], unique=True, name="symbol_date_unique")
    ohlcv.create_index([("date", -1)], name="date_desc")
    symbols.create_index([("symbol", 1)], unique=True, name="symbol_unique")


def frame_to_docs(symbol: str, frame: pd.DataFrame) -> list[dict]:
    if frame.empty:
        return []

    if isinstance(frame.columns, pd.MultiIndex):
        frame = frame.copy()
        frame.columns = frame.columns.get_level_values(0)

    rename_map = {
        "Open": "open",
        "High": "high",
        "Low": "low",
        "Close": "close",
        "Adj Close": "adjClose",
        "Volume": "volume",
    }
    frame = frame.rename(columns=rename_map)
    frame = frame.reset_index()

    date_col = "Date" if "Date" in frame.columns else frame.columns[0]
    docs: list[dict] = []
    now = datetime.now(timezone.utc)

    for row in frame.itertuples(index=False):
        row_dict = row._asdict() if hasattr(row, "_asdict") else dict(zip(frame.columns, row))
        ts = row_dict.get(date_col)
        if ts is None or pd.isna(ts):
            continue

        if hasattr(ts, "to_pydatetime"):
            ts = ts.to_pydatetime()
        if getattr(ts, "tzinfo", None) is not None:
            ts = ts.replace(tzinfo=None)

        docs.append(
            {
                "symbol": symbol,
                "date": ts,
                "open": _num(row_dict.get("open")),
                "high": _num(row_dict.get("high")),
                "low": _num(row_dict.get("low")),
                "close": _num(row_dict.get("close")),
                "adjClose": _num(row_dict.get("adjClose")),
                "volume": _num(row_dict.get("volume")),
                "source": "yfinance",
                "updatedAt": now,
            }
        )

    return docs


def _num(value: object) -> float | int | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if hasattr(value, "item"):
        value = value.item()
    return value  # type: ignore[return-value]


def download_symbol(symbol: str, period: str) -> pd.DataFrame:
    periods = [period] if period != "max" else ["max", "5y", "10y", "1y", "5d"]
    last_error: Exception | None = None

    for candidate in periods:
        try:
            frame = yf.download(
                symbol,
                period=candidate,
                interval="1d",
                auto_adjust=False,
                progress=False,
                threads=False,
            )
            if not frame.empty:
                return frame
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            continue

    if last_error:
        print(f"  skip {symbol}: {last_error}")
    return pd.DataFrame()


def download_batch(symbols: list[str], period: str) -> dict[str, pd.DataFrame]:
    if not symbols:
        return {}

    if len(symbols) == 1:
        return {symbols[0]: download_symbol(symbols[0], period)}

    try:
        frame = yf.download(
            symbols,
            period=period,
            interval="1d",
            auto_adjust=False,
            group_by="ticker",
            progress=False,
            threads=True,
        )
    except Exception:
        frame = pd.DataFrame()

    out: dict[str, pd.DataFrame] = {}
    if frame.empty:
        for symbol in symbols:
            out[symbol] = download_symbol(symbol, period)
        return out

    for symbol in symbols:
        if isinstance(frame.columns, pd.MultiIndex):
            if symbol not in frame.columns.get_level_values(0):
                out[symbol] = download_symbol(symbol, period)
                continue
            symbol_frame = frame[symbol].dropna(how="all")
        else:
            symbol_frame = frame.dropna(how="all")

        if symbol_frame.empty:
            out[symbol] = download_symbol(symbol, period)
        else:
            out[symbol] = symbol_frame

    return out


def upsert_bars(ohlcv: Collection, docs: Iterable[dict]) -> int:
    ops = [
        UpdateOne({"symbol": doc["symbol"], "date": doc["date"]}, {"$set": doc}, upsert=True)
        for doc in docs
    ]
    if not ops:
        return 0
    result = ohlcv.bulk_write(ops, ordered=False)
    return result.upserted_count + result.modified_count


def upsert_symbols(symbols_col: Collection, rows: list[dict[str, str]]) -> None:
    now = datetime.now(timezone.utc)
    ops = [
        UpdateOne(
            {"symbol": row["symbol"]},
            {"$set": {**row, "exchange": "NASDAQ", "updatedAt": now}},
            upsert=True,
        )
        for row in rows
    ]
    if ops:
        symbols_col.bulk_write(ops, ordered=False)


def chunked(items: list[str], size: int) -> Iterable[list[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def main() -> int:
    args = parse_args()
    period = "1y" if args.update else "max"

    print(f"Connecting to MongoDB: {args.mongo_uri} / {args.db}")
    client = MongoClient(args.mongo_uri)
    db = client[args.db]
    ohlcv = db[OHLCV_COLLECTION]
    symbols_col = db[SYMBOLS_COLLECTION]
    meta = db[META_COLLECTION]
    ensure_indexes(ohlcv, symbols_col)

    symbol_rows = fetch_nasdaq_symbols(include_etfs=args.include_etfs)
    if args.limit > 0:
        symbol_rows = symbol_rows[: args.limit]

    tickers = [row["symbol"] for row in symbol_rows]
    upsert_symbols(symbols_col, symbol_rows)

    print(f"Nasdaq symbols to fetch: {len(tickers)} (period={period})")
    started = time.time()
    total_bars = 0
    failed: list[str] = []

    for batch_index, batch in enumerate(chunked(tickers, args.batch_size), start=1):
        try:
            frames = download_batch(batch, period=period)
        except Exception as exc:  # noqa: BLE001
            print(f"Batch {batch_index} download error: {exc}")
            failed.extend(batch)
            time.sleep(args.sleep * 2)
            continue

        batch_bars = 0
        for symbol in batch:
            frame = frames.get(symbol, pd.DataFrame())
            docs = frame_to_docs(symbol, frame)
            if not docs:
                failed.append(symbol)
                continue
            batch_bars += upsert_bars(ohlcv, docs)

        total_bars += batch_bars
        elapsed = time.time() - started
        print(
            f"[{batch_index}/{(len(tickers) + args.batch_size - 1) // args.batch_size}] "
            f"batch={len(batch)} bars={batch_bars} total_bars={total_bars} elapsed={elapsed:.0f}s"
        )
        time.sleep(args.sleep)

    finished = datetime.now(timezone.utc)
    meta.update_one(
        {"_id": "nasdaq_daily_backfill"},
        {
            "$set": {
                "finishedAt": finished,
                "symbolCount": len(tickers),
                "totalBarsUpserted": total_bars,
                "failedSymbols": failed,
                "period": period,
                "source": "yfinance",
            }
        },
        upsert=True,
    )

    print("\nDone.")
    print(f"  Symbols attempted: {len(tickers)}")
    print(f"  Bars upserted:     {total_bars}")
    print(f"  Failed symbols:    {len(failed)}")
    print(f"  Elapsed:           {(time.time() - started) / 60:.1f} min")
    print(f"  DB:                {args.db}.{OHLCV_COLLECTION}")

    client.close()
    return 0 if len(failed) <= max(5, len(tickers) * 0.05) else 1


if __name__ == "__main__":
    sys.exit(main())
