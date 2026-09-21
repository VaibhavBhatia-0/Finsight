"""Canonical ledger-based portfolio intelligence engine.

The engine accepts dated ledger transactions plus provider price/FX observations.
It never invents observations and returns explicit insufficient-data states.
"""

import json
import math
import os
import sys
from collections import defaultdict

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from analytics.common.metrics import (
    calculate_beta_dated,
    calculate_cagr,
    calculate_max_drawdown,
    calculate_sharpe_ratio,
    calculate_volatility,
    calculate_xirr,
)


def _number(value, default=0.0):
    try:
        parsed = float(value)
        return parsed if math.isfinite(parsed) else default
    except (TypeError, ValueError):
        return default


def _round(value):
    return round(float(value), 8)


def _at_or_before(rows, date_value, field):
    eligible = [row for row in rows if row["date"] <= date_value and _number(row.get(field)) > 0]
    return _number(eligible[-1][field]) if eligible else None


def _unit_value(asset, date_value):
    price = _at_or_before(asset["prices"], date_value, "close")
    if price is None:
        return None
    if asset["currency"] == asset["base_currency"]:
        return price
    fx = _at_or_before(asset["fx_rates"], date_value, "rate")
    return None if fx is None else price * fx


def _returns(values):
    return [current / previous - 1 for previous, current in zip(values, values[1:]) if previous > 0]


def _correlation(left, right):
    count = min(len(left), len(right))
    if count < 2:
        return None
    x, y = left[:count], right[:count]
    x_mean, y_mean = sum(x) / count, sum(y) / count
    numerator = sum((a - x_mean) * (b - y_mean) for a, b in zip(x, y))
    x_sum = sum((a - x_mean) ** 2 for a in x)
    y_sum = sum((b - y_mean) ** 2 for b in y)
    if x_sum <= 0 or y_sum <= 0:
        return None
    return numerator / math.sqrt(x_sum * y_sum)


def _covariance(left, right):
    count = min(len(left), len(right))
    if count < 2:
        return None
    x, y = left[:count], right[:count]
    x_mean, y_mean = sum(x) / count, sum(y) / count
    return sum((a - x_mean) * (b - y_mean) for a, b in zip(x, y)) / (count - 1)


def _group_allocation(holdings, key):
    grouped = defaultdict(float)
    for holding in holdings:
        grouped[holding.get(key) or "Unavailable"] += holding["value"]
    total = sum(grouped.values())
    return [
        {"label": label, "value": _round(value), "percentage": _round(value / total * 100) if total > 0 else 0}
        for label, value in sorted(grouped.items(), key=lambda item: item[1], reverse=True)
    ]


def run(payload):
    base_currency = payload["base_currency"]
    transactions = sorted(payload.get("transactions", []), key=lambda row: (row["date"], str(row.get("id", ""))))
    assets = []
    by_id = {}
    for raw in payload.get("assets", []):
        asset = {
            **raw,
            "stock_id": str(raw["stock_id"]),
            "base_currency": base_currency,
            "prices": sorted(raw.get("prices", []), key=lambda row: row["date"]),
            "fx_rates": sorted(raw.get("fx_rates", []), key=lambda row: row["date"]),
        }
        assets.append(asset)
        by_id[asset["stock_id"]] = asset

    if not transactions:
        return {
            "status": "INSUFFICIENT_DATA",
            "reason": "Portfolio has no ledger transactions",
            "performance": None,
            "risk": {"status": "INSUFFICIENT_HISTORICAL_DATA"},
            "allocation": {"holdings": [], "assetClasses": [], "sectors": [], "geographies": [], "currencies": [], "cash": {"value": 0, "percentage": 0}},
            "attribution": {"holdings": [], "totals": {"priceReturn": 0, "dividends": 0, "fxImpact": 0, "fees": 0, "taxes": 0, "netPnl": 0, "reconciliationDifference": 0}},
        }

    lots = defaultdict(list)
    attribution = defaultdict(lambda: {"priceReturn": 0.0, "dividends": 0.0, "fxImpact": 0.0, "fees": 0.0, "taxes": 0.0})
    cash = 0.0
    deposits = withdrawals = 0.0
    external_flows = defaultdict(float)

    for tx in transactions:
        kind = tx["type"]
        stock_id = str(tx["stock_id"]) if tx.get("stock_id") is not None else None
        fx = _number(tx.get("fx_rate"), 1.0)
        amount = _number(tx.get("amount")) * fx
        fee = _number(tx.get("fee_amount")) * fx
        quantity = _number(tx.get("quantity"))
        price = _number(tx.get("price"))
        bucket = stock_id or "CASH"
        if kind == "DEPOSIT":
            cash += amount - fee
            deposits += amount
            external_flows[tx["date"]] += amount
        elif kind == "WITHDRAWAL":
            cash -= amount + fee
            withdrawals += amount
            external_flows[tx["date"]] -= amount
        elif kind == "BUY" and stock_id:
            cash -= amount + fee
            lots[stock_id].append({"remaining": quantity, "entry_price": price, "entry_fx": fx})
        elif kind == "SELL" and stock_id:
            cash += amount - fee
            remaining = quantity
            for lot in lots[stock_id]:
                used = min(remaining, lot["remaining"])
                if used <= 0:
                    continue
                attribution[stock_id]["priceReturn"] += used * (price - lot["entry_price"]) * lot["entry_fx"]
                attribution[stock_id]["fxImpact"] += used * price * (fx - lot["entry_fx"])
                lot["remaining"] -= used
                remaining -= used
                if remaining <= 1e-12:
                    break
        elif kind == "DIVIDEND":
            cash += amount - fee
            attribution[bucket]["dividends"] += amount
        elif kind == "SPLIT" and stock_id:
            for lot in lots[stock_id]:
                lot["remaining"] *= quantity
                lot["entry_price"] /= quantity
        elif kind == "FEE":
            cash -= amount
            attribution[bucket]["fees"] += amount
        elif kind == "TAX":
            cash -= amount
            attribution[bucket]["taxes"] += amount

        if fee > 0:
            attribution[bucket]["fees"] += fee

    end_date = payload.get("end_date") or max(
        [transactions[-1]["date"]] + [row["date"] for asset in assets for row in asset["prices"]]
    )
    holdings = []
    final_holdings_value = 0.0
    targets = payload.get("allocation_targets") or {}
    for stock_id, asset in by_id.items():
        active_lots = [lot for lot in lots[stock_id] if lot["remaining"] > 1e-12]
        quantity = sum(lot["remaining"] for lot in active_lots)
        if quantity <= 0:
            continue
        price = _at_or_before(asset["prices"], end_date, "close")
        if price is None:
            continue
        fx = 1.0 if asset["currency"] == base_currency else _at_or_before(asset["fx_rates"], end_date, "rate")
        if fx is None:
            continue
        value = quantity * price * fx
        final_holdings_value += value
        for lot in active_lots:
            attribution[stock_id]["priceReturn"] += lot["remaining"] * (price - lot["entry_price"]) * lot["entry_fx"]
            attribution[stock_id]["fxImpact"] += lot["remaining"] * price * (fx - lot["entry_fx"])
        holdings.append({
            "stockId": stock_id, "symbol": asset["symbol"], "name": asset["name"],
            "sector": asset.get("sector"), "geography": asset.get("country"), "currency": asset["currency"],
            "assetClass": asset.get("asset_class", "Equity"), "quantity": _round(quantity),
            "price": _round(price), "fxRate": _round(fx), "value": _round(value),
            "targetPercentage": targets.get(asset["symbol"]),
        })

    final_value = cash + final_holdings_value
    net_contributions = deposits - withdrawals
    net_pnl = final_value - net_contributions
    total_investable = max(0.0, final_value)
    for holding in holdings:
        holding["percentage"] = _round(holding["value"] / total_investable * 100) if total_investable > 0 else 0
        target = holding["targetPercentage"]
        holding["targetDifference"] = None if target is None else _round(holding["percentage"] - _number(target))

    all_dates = sorted(set(
        [tx["date"] for tx in transactions]
        + [row["date"] for asset in assets for row in asset["prices"] if transactions[0]["date"] <= row["date"] <= end_date]
    ))
    quantities = defaultdict(float)
    series_cash = 0.0
    tx_index = 0
    value_series = []
    normalized_series = []
    normalized = 100.0
    previous_value = 0.0
    for date_value in all_dates:
        while tx_index < len(transactions) and transactions[tx_index]["date"] <= date_value:
            tx = transactions[tx_index]
            kind = tx["type"]
            stock_id = str(tx["stock_id"]) if tx.get("stock_id") is not None else None
            fx = _number(tx.get("fx_rate"), 1.0)
            amount = _number(tx.get("amount")) * fx
            fee = _number(tx.get("fee_amount")) * fx
            quantity = _number(tx.get("quantity"))
            if kind == "DEPOSIT": series_cash += amount - fee
            elif kind == "WITHDRAWAL": series_cash -= amount + fee
            elif kind == "BUY" and stock_id: series_cash -= amount + fee; quantities[stock_id] += quantity
            elif kind == "SELL" and stock_id: series_cash += amount - fee; quantities[stock_id] -= quantity
            elif kind == "DIVIDEND": series_cash += amount - fee
            elif kind == "SPLIT" and stock_id: quantities[stock_id] *= quantity
            elif kind in ("FEE", "TAX"): series_cash -= amount
            tx_index += 1
        holdings_value = 0.0
        usable = True
        for stock_id, quantity in quantities.items():
            if quantity <= 1e-12:
                continue
            asset = by_id.get(stock_id)
            unit = _unit_value(asset, date_value) if asset else None
            if unit is None:
                usable = False
                break
            holdings_value += quantity * unit
        if not usable:
            continue
        value = series_cash + holdings_value
        flow = external_flows.get(date_value, 0.0)
        if previous_value > 0:
            normalized *= max(0.0, 1 + (value - flow - previous_value) / previous_value)
        elif flow > 0:
            normalized = max(0.0, value / flow * 100)
        value_series.append({"date": date_value, "value": _round(value)})
        normalized_series.append({"date": date_value, "value": _round(normalized)})
        previous_value = value

    benchmark = payload.get("benchmark")
    benchmark_series = []
    if benchmark and normalized_series:
        benchmark_asset = {
            **benchmark, "base_currency": base_currency,
            "prices": sorted(benchmark.get("prices", []), key=lambda row: row["date"]),
            "fx_rates": sorted(benchmark.get("fx_rates", []), key=lambda row: row["date"]),
        }
        units = [(row["date"], _unit_value(benchmark_asset, row["date"])) for row in normalized_series]
        units = [(date_value, value) for date_value, value in units if value is not None]
        if len(units) >= 2 and units[0][1] > 0:
            benchmark_series = [{"date": date_value, "value": _round(value / units[0][1] * 100)} for date_value, value in units]

    normalized_by_date = {row["date"]: row["value"] for row in normalized_series}
    benchmark_by_date = {row["date"]: row["value"] for row in benchmark_series}
    chart_dates = sorted(set(normalized_by_date).intersection(benchmark_by_date)) if benchmark_series else sorted(normalized_by_date)
    chart = [{
        "date": date_value,
        "portfolioValue": next((row["value"] for row in value_series if row["date"] == date_value), None),
        "portfolioNormalized": normalized_by_date[date_value],
        "benchmarkNormalized": benchmark_by_date.get(date_value),
    } for date_value in chart_dates]

    portfolio_return = _round(normalized_series[-1]["value"] - 100) if len(normalized_series) >= 2 else None
    portfolio_cagr = calculate_cagr(100, normalized_series[-1]["value"], normalized_series[0]["date"], normalized_series[-1]["date"]) if len(normalized_series) >= 2 else None
    benchmark_return = _round(benchmark_series[-1]["value"] - 100) if len(benchmark_series) >= 2 else None
    benchmark_cagr = calculate_cagr(100, benchmark_series[-1]["value"], benchmark_series[0]["date"], benchmark_series[-1]["date"]) if len(benchmark_series) >= 2 else None
    difference = None if portfolio_return is None or benchmark_return is None else _round(portfolio_return - benchmark_return)
    cagr_difference = None if portfolio_cagr is None or benchmark_cagr is None else _round(portfolio_cagr - benchmark_cagr)

    portfolio_returns = _returns([row["value"] for row in normalized_series])
    benchmark_returns = _returns([row["value"] for row in benchmark_series])
    sufficient = len(normalized_series) >= 20
    benchmark_sufficient = len(benchmark_series) >= 20
    downside_count = sum(1 for value in portfolio_returns if value < 0)
    risk = {
        "status": "AVAILABLE" if sufficient else "INSUFFICIENT_HISTORICAL_DATA",
        "observations": len(normalized_series),
        "volatility": calculate_volatility([row["value"] for row in normalized_series]) if sufficient else None,
        "sharpeRatio": calculate_sharpe_ratio([row["value"] for row in normalized_series], _number(payload.get("risk_free_rate"), 0.065)) if sufficient else None,
        "maxDrawdown": calculate_max_drawdown([row["value"] for row in normalized_series]) if len(normalized_series) >= 2 else None,
        "beta": calculate_beta_dated(normalized_series, benchmark_series) if sufficient and benchmark_sufficient else None,
        "correlation": _round(_correlation(portfolio_returns, benchmark_returns)) if sufficient and benchmark_sufficient and _correlation(portfolio_returns, benchmark_returns) is not None else None,
        "downsideObservations": downside_count if portfolio_returns else None,
        "downsidePercentage": _round(downside_count / len(portfolio_returns) * 100) if portfolio_returns else None,
    }

    weights = {holding["stockId"]: holding["percentage"] / 100 for holding in holdings}
    risk_contributions = []
    if sufficient and holdings:
        portfolio_variance = _covariance(portfolio_returns, portfolio_returns)
        for holding in holdings:
            asset = by_id[holding["stockId"]]
            units = [_unit_value(asset, row["date"]) for row in normalized_series]
            if any(value is None for value in units):
                contribution = None
            else:
                covariance = _covariance(_returns(units), portfolio_returns)
                contribution = None if covariance is None or not portfolio_variance else weights[holding["stockId"]] * covariance / portfolio_variance * 100
            risk_contributions.append({"symbol": holding["symbol"], "percentage": None if contribution is None else _round(contribution)})
    risk["riskContribution"] = risk_contributions
    equity_weights = [holding["percentage"] / 100 for holding in holdings]
    cash_percentage = _round(cash / total_investable * 100) if total_investable > 0 else 0
    risk["concentration"] = {
        "herfindahlIndex": _round(sum(weight ** 2 for weight in equity_weights) + (cash_percentage / 100) ** 2),
        "largestHoldingPercentage": _round(max([holding["percentage"] for holding in holdings] + [cash_percentage])),
        "holdingCount": len(holdings),
    }

    attribution_rows = []
    for bucket, values in attribution.items():
        asset = by_id.get(bucket)
        net = values["priceReturn"] + values["fxImpact"] + values["dividends"] - values["fees"] - values["taxes"]
        attribution_rows.append({
            "stockId": None if bucket == "CASH" else bucket,
            "symbol": asset["symbol"] if asset else "Portfolio cash",
            **{key: _round(value) for key, value in values.items()},
            "netContribution": _round(net),
        })
    totals = {
        key: sum(row[key] for row in attribution_rows)
        for key in ("priceReturn", "dividends", "fxImpact", "fees", "taxes")
    }
    attributed_net = totals["priceReturn"] + totals["dividends"] + totals["fxImpact"] - totals["fees"] - totals["taxes"]
    totals.update({"netPnl": net_pnl, "reconciliationDifference": net_pnl - attributed_net})
    cash_allocation = {"value": _round(cash), "percentage": cash_percentage}
    allocation_rows = holdings + [{
        "stockId": None, "symbol": "Cash", "name": "Cash", "sector": None, "geography": None,
        "currency": base_currency, "assetClass": "Cash", "quantity": None, "price": None, "fxRate": 1,
        "value": _round(cash), "percentage": cash_percentage, "targetPercentage": targets.get("CASH"),
        "targetDifference": None if targets.get("CASH") is None else _round(cash_percentage - _number(targets.get("CASH"))),
    }]
    cash_flows = [(tx["date"], -_number(tx["amount"]) * _number(tx.get("fx_rate"), 1)) for tx in transactions if tx["type"] == "DEPOSIT"]
    cash_flows.extend((tx["date"], _number(tx["amount"]) * _number(tx.get("fx_rate"), 1)) for tx in transactions if tx["type"] == "WITHDRAWAL")
    cash_flows.append((end_date, final_value))

    return {
        "status": "AVAILABLE" if value_series else "INSUFFICIENT_DATA",
        "asOfDate": end_date,
        "performance": {
            "startDate": normalized_series[0]["date"] if normalized_series else None,
            "endDate": normalized_series[-1]["date"] if normalized_series else None,
            "currentValue": _round(final_value), "netContributions": _round(net_contributions), "netPnl": _round(net_pnl),
            "portfolioReturn": portfolio_return, "portfolioCagr": portfolio_cagr, "xirr": calculate_xirr(cash_flows),
            "benchmark": None if not benchmark else {"code": benchmark.get("code"), "name": benchmark.get("name")},
            "benchmarkReturn": benchmark_return, "benchmarkCagr": benchmark_cagr,
            "absoluteDifference": difference, "cagrDifference": cagr_difference,
            "series": chart,
            "methodology": "Cash-flow-neutral time-weighted performance. XIRR uses actual dated external cash flows. Benchmark values are FX-normalized to the portfolio base currency.",
        },
        "risk": risk,
        "allocation": {
            "holdings": allocation_rows,
            "assetClasses": _group_allocation(allocation_rows, "assetClass"),
            "sectors": _group_allocation([row for row in holdings if row.get("sector")], "sector"),
            "geographies": _group_allocation([row for row in holdings if row.get("geography")], "geography"),
            "currencies": _group_allocation(allocation_rows, "currency"),
            "cash": cash_allocation,
        },
        "attribution": {
            "holdings": sorted(attribution_rows, key=lambda row: abs(row["netContribution"]), reverse=True),
            "totals": {key: _round(value) for key, value in totals.items()},
            "invariant": "price return + FX impact + dividends - fees - taxes = net P&L",
        },
        "dataQuality": {
            "historicalObservations": len(value_series),
            "benchmarkObservations": len(benchmark_series),
            "missingSectorCount": sum(1 for holding in holdings if not holding.get("sector")),
            "source": payload.get("source", "PROVIDER_HISTORY"),
        },
    }


if __name__ == "__main__":
    try:
        print(json.dumps(run(json.loads(sys.stdin.read())), separators=(",", ":")))
    except Exception as error:
        sys.stderr.write(str(error))
        sys.exit(1)
