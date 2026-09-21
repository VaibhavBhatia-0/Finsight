"""Canonical backtesting engine shared by Analyze and Lab Backtest Strategy."""

import json
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from analytics.common.metrics import (
    calculate_cagr,
    calculate_max_drawdown,
    calculate_sharpe_ratio,
    calculate_volatility,
    calculate_xirr,
)


def rate(rows, target, asset_currency, base_currency):
    if asset_currency == base_currency:
        return 1.0
    eligible = sorted((row for row in rows if row["date"] <= target), key=lambda row: row["date"], reverse=True)
    if not eligible:
        raise ValueError(f"Missing FX for {asset_currency}/{base_currency}")
    return float(eligible[0]["rate"])


def _row_at_or_before(rows, target):
    eligible = [row for row in rows if row["date"] <= target]
    return eligible[-1] if eligible else None


def _benchmark_series(benchmark, dates, initial, base_currency):
    if not benchmark:
        return [], None, None
    rows = sorted(benchmark.get("price_history", []), key=lambda row: row["date"])
    if len(rows) < 2:
        raise ValueError("Insufficient benchmark history")
    aligned = []
    for day in dates:
        row = _row_at_or_before(rows, day)
        if row:
            unit_value = float(row["close"]) * rate(
                benchmark.get("exchange_rates", []), day,
                benchmark["asset_currency"], base_currency,
            )
            aligned.append((day, unit_value))
    if len(aligned) < 2 or aligned[0][1] <= 0:
        raise ValueError("Benchmark does not overlap the strategy period")
    start_unit = aligned[0][1]
    series = [{"date": day, "value": round(initial * unit / start_unit, 8)} for day, unit in aligned]
    final = series[-1]["value"]
    benchmark_return = round((final / initial - 1) * 100, 8)
    benchmark_cagr = calculate_cagr(initial, final, series[0]["date"], series[-1]["date"])
    return series, benchmark_return, benchmark_cagr


def run(payload):
    if payload.get("strategy_type") != "BUY_AND_HOLD":
        raise ValueError("Only BUY_AND_HOLD is currently supported")
    initial = float(payload["initial_amount"])
    assets = payload.get("assets", [])
    fee_rate = float(payload.get("fee_rate", 0))
    fixed_fee = float(payload.get("fixed_fee", 0))
    if initial <= 0 or not assets or abs(sum(float(item["weight"]) for item in assets) - 1) > 1e-8:
        raise ValueError("A positive amount and asset weights summing to 1 are required")
    if fee_rate < 0 or fee_rate > 0.1 or fixed_fee < 0:
        raise ValueError("Trading fees must be non-negative and percentage fees cannot exceed 10%")

    positions = []
    common_dates = None
    for asset in assets:
        rows = sorted(asset["price_history"], key=lambda row: row["date"])
        if len(rows) < 2:
            raise ValueError(f"Insufficient history for {asset['symbol']}")
        dates = {row["date"] for row in rows}
        common_dates = dates if common_dates is None else common_dates.intersection(dates)
        positions.append({**asset, "rows": {row["date"]: row for row in rows}})

    dates = sorted(common_dates or [])
    if len(dates) < 2:
        raise ValueError("Assets do not share enough dated observations")
    entry_fees = 0.0
    entry_transaction_value = 0.0
    for position in positions:
        allocation = initial * float(position["weight"])
        entry_day = dates[0]
        entry_unit = float(position["rows"][entry_day]["close"]) * rate(position["exchange_rates"], entry_day, position["asset_currency"], payload["base_currency"])
        if allocation <= fixed_fee or entry_unit <= 0:
            raise ValueError(f"Trading fees consume the allocation for {position['symbol']}")
        position["shares"] = (allocation - fixed_fee) / (entry_unit * (1 + fee_rate))
        trade_value = position["shares"] * entry_unit
        entry_fee = trade_value * fee_rate + fixed_fee
        entry_fees += entry_fee
        entry_transaction_value += trade_value
        position["no_fee_shares"] = allocation / entry_unit
    series = []
    gross_series = []
    exit_fee_series = []
    for day in dates:
        gross = sum(
            position["shares"] * float(position["rows"][day]["close"])
            * rate(position["exchange_rates"], day, position["asset_currency"], payload["base_currency"])
            for position in positions
        )
        exit_fee = gross * fee_rate + fixed_fee * len(positions)
        value = max(0.0, gross - exit_fee)
        no_fee_value = sum(
            position["no_fee_shares"] * float(position["rows"][day]["close"])
            * rate(position["exchange_rates"], day, position["asset_currency"], payload["base_currency"])
            for position in positions
        )
        series.append({"date": day, "value": round(value, 8)})
        gross_series.append(no_fee_value)
        exit_fee_series.append(exit_fee)

    final = series[-1]["value"]
    absolute = final - initial
    gross_final = round(gross_series[-1], 8)
    fees_paid = round(entry_fees + exit_fee_series[-1], 8)
    fee_impact = round(gross_final - final, 8)
    benchmark_series, benchmark_return, benchmark_cagr = _benchmark_series(payload.get("benchmark"), dates, initial, payload["base_currency"])
    benchmark_by_date = {row["date"]: row["value"] for row in benchmark_series}
    chart = [
        {
            "date": row["date"],
            "value": row["value"],
            "strategy_value": row["value"],
            "benchmark_value": benchmark_by_date.get(row["date"]),
        }
        for row in series
    ]
    strategy_return = round(absolute / initial * 100, 8)
    strategy_cagr = calculate_cagr(initial, final, dates[0], dates[-1])
    difference = None if benchmark_return is None else round(strategy_return - benchmark_return, 8)
    relative = None if not benchmark_series or benchmark_series[-1]["value"] <= 0 else round((final / benchmark_series[-1]["value"] - 1) * 100, 8)
    return {
        "strategy_type": "BUY_AND_HOLD",
        "total_invested": initial,
        "final_value": final,
        "gross_final_value": gross_final,
        "absolute_return": round(absolute, 8),
        "return_percentage": strategy_return,
        "strategy_return": strategy_return,
        "cagr": strategy_cagr,
        "strategy_cagr": strategy_cagr,
        "xirr": calculate_xirr([(dates[0], -initial), (dates[-1], final)]),
        "volatility": calculate_volatility([row["value"] for row in series]),
        "max_drawdown": calculate_max_drawdown([row["value"] for row in series]),
        "sharpe_ratio": calculate_sharpe_ratio([row["value"] for row in series], float(payload.get("risk_free_rate", 0.065))),
        "benchmark_return": benchmark_return,
        "benchmark_cagr": benchmark_cagr,
        "benchmark_difference": difference,
        "relative_performance": relative,
        "fees_paid": fees_paid,
        "transaction_values": {"entry": round(entry_transaction_value, 8), "exit": round(final + exit_fee_series[-1], 8)},
        "attribution": {
            "gross_market_profit": round(gross_final - initial, 8),
            "fee_impact": fee_impact,
            "net_profit": round(absolute, 8),
        },
        "time_series": chart,
    }


if __name__ == "__main__":
    try:
        print(json.dumps(run(json.loads(sys.stdin.read())), separators=(",", ":")))
    except Exception as error:
        sys.stderr.write(str(error))
        sys.exit(1)
