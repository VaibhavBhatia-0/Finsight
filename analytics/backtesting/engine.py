"""Canonical backtesting engine shared by Analyze and Lab Backtest Strategy."""

import json
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from analytics.common.metrics import calculate_cagr, calculate_max_drawdown, calculate_sharpe_ratio, calculate_volatility


def rate(rows, target, asset_currency, base_currency):
    if asset_currency == base_currency:
        return 1.0
    eligible = sorted((row for row in rows if row["date"] <= target), key=lambda row: row["date"], reverse=True)
    if not eligible:
        raise ValueError(f"Missing FX for {asset_currency}/{base_currency}")
    return float(eligible[0]["rate"])


def run(payload):
    if payload.get("strategy_type") != "BUY_AND_HOLD":
        raise ValueError("Only BUY_AND_HOLD is currently supported")
    initial = float(payload["initial_amount"])
    assets = payload.get("assets", [])
    if initial <= 0 or not assets or abs(sum(float(item["weight"]) for item in assets) - 1) > 1e-8:
        raise ValueError("A positive amount and asset weights summing to 1 are required")
    positions = []
    common_dates = None
    for asset in assets:
        rows = sorted(asset["price_history"], key=lambda row: row["date"])
        if len(rows) < 2:
            raise ValueError(f"Insufficient history for {asset['symbol']}")
        dates = {row["date"] for row in rows}
        common_dates = dates if common_dates is None else common_dates.intersection(dates)
        entry = initial * float(asset["weight"])
        shares = entry / (float(rows[0]["close"]) * rate(asset["exchange_rates"], rows[0]["date"], asset["asset_currency"], payload["base_currency"]))
        positions.append({**asset, "rows": {row["date"]: row for row in rows}, "shares": shares})
    dates = sorted(common_dates or [])
    if len(dates) < 2:
        raise ValueError("Assets do not share enough dated observations")
    series = []
    for day in dates:
        value = sum(position["shares"] * float(position["rows"][day]["close"]) * rate(position["exchange_rates"], day, position["asset_currency"], payload["base_currency"]) for position in positions)
        series.append({"date": day, "value": round(value, 8)})
    final = series[-1]["value"]
    absolute = final - initial
    return {
        "strategy_type": "BUY_AND_HOLD", "total_invested": initial, "final_value": final,
        "absolute_return": round(absolute, 8), "return_percentage": round(absolute / initial * 100, 8),
        "cagr": calculate_cagr(initial, final, dates[0], dates[-1]), "xirr": None,
        "volatility": calculate_volatility([row["value"] for row in series]),
        "max_drawdown": calculate_max_drawdown([row["value"] for row in series]),
        "sharpe_ratio": calculate_sharpe_ratio([row["value"] for row in series], float(payload.get("risk_free_rate", 0.065))),
        "benchmark_return": None, "benchmark_difference": None, "time_series": series,
    }


if __name__ == "__main__":
    try:
        print(json.dumps(run(json.loads(sys.stdin.read())), separators=(",", ":")))
    except Exception as error:
        sys.stderr.write(str(error))
        sys.exit(1)
