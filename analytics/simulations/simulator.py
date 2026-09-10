"""FinSight Lab scenario engine. This is intentionally separate from backtesting."""

import calendar
import json
import os
import sys
from datetime import date, datetime
from typing import Any, Dict, List, Optional

try:
    from analytics.common.metrics import (
        calculate_beta_dated,
        calculate_cagr,
        calculate_max_drawdown,
        calculate_sharpe_ratio,
        calculate_volatility,
        calculate_xirr,
    )
except ImportError:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
    from analytics.common.metrics import (
        calculate_beta_dated,
        calculate_cagr,
        calculate_max_drawdown,
        calculate_sharpe_ratio,
        calculate_volatility,
        calculate_xirr,
    )


def _round(value: float) -> float:
    return round(value, 8)


def _prices(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(rows, key=lambda row: row["date"])


def price_on_or_after(rows: List[Dict[str, Any]], target: str) -> Optional[Dict[str, Any]]:
    return next((row for row in _prices(rows) if row["date"] >= target), None)


def price_on_or_before(rows: List[Dict[str, Any]], target: str) -> Optional[Dict[str, Any]]:
    return next((row for row in reversed(_prices(rows)) if row["date"] <= target), None)


def fx_rate(rows: List[Dict[str, Any]], target: str, asset_currency: str, base_currency: str) -> float:
    if asset_currency == base_currency:
        return 1.0
    eligible = sorted((row for row in rows if row.get("date", "") <= target), key=lambda row: row["date"], reverse=True)
    if not eligible:
        eligible = sorted(rows, key=lambda row: row.get("date", ""))
    for row in eligible:
        source, quote, rate = row.get("base_currency"), row.get("quote_currency"), float(row.get("rate", 0))
        if rate <= 0:
            continue
        if source == asset_currency and quote == base_currency:
            return rate
        if source == base_currency and quote == asset_currency:
            return 1 / rate
    raise ValueError(f"No FX rate for {asset_currency}/{base_currency} on or before {target}")


def split_events(rows: List[Dict[str, Any]], start: str, end: str) -> List[Dict[str, Any]]:
    return sorted([
        row for row in rows
        if start < row.get("action_date", "") <= end
        and str(row.get("action_type", "SPLIT")).upper() in {"SPLIT", "BONUS"}
        and float(row.get("ratio", 0)) > 0
    ], key=lambda row: row["action_date"])


def adjusted_shares(initial_shares: float, splits: List[Dict[str, Any]], start: str, target: str) -> float:
    shares = initial_shares
    for event in splits:
        if start < event["action_date"] <= target:
            shares *= float(event["ratio"])
    return shares


def dividends_for_lots(lots: List[Dict[str, Any]], dividends: List[Dict[str, Any]], splits: List[Dict[str, Any]], end: str, fx_rows: List[Dict[str, Any]], asset_currency: str, base_currency: str):
    total = 0.0
    dated_flows: List[Dict[str, Any]] = []
    for dividend in sorted(dividends, key=lambda row: row.get("ex_date", "")):
        event_date = dividend.get("ex_date", "")
        if not event_date or event_date > end:
            continue
        shares = sum(adjusted_shares(lot["shares"], splits, lot["date"], event_date) for lot in lots if lot["date"] < event_date)
        amount = shares * float(dividend.get("amount", 0)) * fx_rate(fx_rows, event_date, asset_currency, base_currency)
        if amount:
            total += amount
            dated_flows.append({"date": event_date, "amount": amount})
    return total, dated_flows


def risk_metrics(values: List[Dict[str, Any]], benchmark_rows: List[Dict[str, Any]], start_value: float, end_value: float, start: str, end: str, risk_free_rate: float):
    series = [row["value"] for row in values]
    benchmark_values = [{"date": row["date"], "value": float(row["close"])} for row in _prices(benchmark_rows)]
    beta = calculate_beta_dated(values, benchmark_values) if benchmark_values else None
    benchmark_return = 0.0
    if benchmark_values and benchmark_values[0]["value"] > 0:
        benchmark_return = (benchmark_values[-1]["value"] / benchmark_values[0]["value"] - 1) * 100
    net_return = (end_value / start_value - 1) * 100 if start_value > 0 else 0.0
    return {
        "cagr": calculate_cagr(start_value, end_value, start, end),
        "xirr": None,
        "volatility": calculate_volatility(series),
        "sharpe_ratio": calculate_sharpe_ratio(series, risk_free_rate),
        "max_drawdown": calculate_max_drawdown(series),
        "beta": beta,
        "benchmark_return": _round(benchmark_return),
        "benchmark_difference": _round(net_return - benchmark_return),
    }


def simulate_single(payload: Dict[str, Any]) -> Dict[str, Any]:
    amount = float(payload["initial_amount"])
    if amount <= 0:
        raise ValueError("initial_amount must be positive")
    start, end = payload["start_date"], payload["end_date"]
    if start >= end:
        raise ValueError("start_date must be before end_date")
    rows = _prices(payload.get("price_history", []))
    buy, sell = price_on_or_after(rows, start), price_on_or_before(rows, end)
    if not buy or not sell or buy["date"] > sell["date"]:
        raise ValueError("No usable price observations in the requested date range")
    base_currency, asset_currency = payload["base_currency"], payload["asset_currency"]
    fx_rows = payload.get("exchange_rates", [])
    buy_fx = fx_rate(fx_rows, buy["date"], asset_currency, base_currency)
    sell_fx = fx_rate(fx_rows, sell["date"], asset_currency, base_currency)
    initial_shares = amount / buy_fx / float(buy["close"])
    splits = split_events(payload.get("corporate_actions", []), buy["date"], sell["date"])
    final_shares = adjusted_shares(initial_shares, splits, buy["date"], sell["date"])
    lots = [{"date": buy["date"], "shares": initial_shares, "entry_fx": buy_fx, "amount": amount}]
    dividend_amount, dividend_flows = dividends_for_lots(lots, payload.get("dividends", []), splits, sell["date"], fx_rows, asset_currency, base_currency)
    final_equity_asset = final_shares * float(sell["close"])
    final_equity = final_equity_asset * sell_fx
    gross_value = final_equity + dividend_amount
    asset_return = final_equity_asset * buy_fx - amount
    fx_impact = final_equity_asset * (sell_fx - buy_fx)
    fee_rate = float(payload.get("fee_rate", 0))
    fees = amount * fee_rate + gross_value * fee_rate
    gross_profit = asset_return + fx_impact + dividend_amount
    estimated_tax = max(0.0, gross_profit - fees) * float(payload.get("tax_rate", 0))
    net_value = gross_value - fees - estimated_tax
    net_profit = asset_return + fx_impact + dividend_amount - fees - estimated_tax

    values = []
    for row in rows:
        if buy["date"] <= row["date"] <= sell["date"]:
            shares = adjusted_shares(initial_shares, splits, buy["date"], row["date"])
            accrued = sum(flow["amount"] for flow in dividend_flows if flow["date"] <= row["date"])
            values.append({"date": row["date"], "value": shares * float(row["close"]) * fx_rate(fx_rows, row["date"], asset_currency, base_currency) + accrued})
    metrics = risk_metrics(values, payload.get("benchmark_price_history", []), amount, net_value, buy["date"], sell["date"], float(payload.get("risk_free_rate", 0.065)))
    metrics["xirr"] = calculate_xirr([(buy["date"], -(amount + amount * fee_rate)), (sell["date"], net_value + amount * fee_rate)])
    return result("SINGLE_INVESTMENT", amount, gross_value, dividend_amount, fees, estimated_tax, asset_return, fx_impact, net_profit, metrics, {
        "actual_buy_date": buy["date"], "actual_sell_date": sell["date"], "buy_price": float(buy["close"]), "sell_price": float(sell["close"]), "initial_shares": initial_shares, "adjusted_shares": final_shares,
    })


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year, month = value.year + month_index // 12, month_index % 12 + 1
    return date(year, month, min(value.day, calendar.monthrange(year, month)[1]))


def contribution_dates(start: str, end: str, frequency: str) -> List[str]:
    step = {"MONTHLY": 1, "QUARTERLY": 3, "ANNUALLY": 12}.get(frequency)
    if not step:
        raise ValueError("contribution_frequency must be MONTHLY, QUARTERLY, or ANNUALLY")
    current, finish = datetime.strptime(start, "%Y-%m-%d").date(), datetime.strptime(end, "%Y-%m-%d").date()
    values = []
    while current <= finish:
        values.append(current.isoformat())
        current = add_months(current, step)
    return values


def simulate_recurring(payload: Dict[str, Any]) -> Dict[str, Any]:
    contribution = float(payload["initial_amount"])
    if contribution <= 0:
        raise ValueError("initial_amount (the recurring contribution) must be positive")
    start, end = payload["start_date"], payload["end_date"]
    rows = _prices(payload.get("price_history", []))
    sell = price_on_or_before(rows, end)
    if not sell:
        raise ValueError("No usable terminal price")
    base_currency, asset_currency = payload["base_currency"], payload["asset_currency"]
    fx_rows = payload.get("exchange_rates", [])
    lots = []
    for scheduled in contribution_dates(start, end, payload.get("contribution_frequency", "MONTHLY")):
        buy = price_on_or_after(rows, scheduled)
        if not buy or buy["date"] > sell["date"]:
            continue
        entry_fx = fx_rate(fx_rows, buy["date"], asset_currency, base_currency)
        lots.append({"date": buy["date"], "scheduled_date": scheduled, "shares": contribution / entry_fx / float(buy["close"]), "entry_fx": entry_fx, "amount": contribution})
    if not lots:
        raise ValueError("No contribution dates resolved to trading observations")
    splits = split_events(payload.get("corporate_actions", []), lots[0]["date"], sell["date"])
    sell_price = float(sell["close"])
    sell_fx = fx_rate(fx_rows, sell["date"], asset_currency, base_currency)
    final_lot_assets = [adjusted_shares(lot["shares"], splits, lot["date"], sell["date"]) * sell_price for lot in lots]
    final_equity = sum(final_lot_assets) * sell_fx
    dividends, dividend_flows = dividends_for_lots(lots, payload.get("dividends", []), splits, sell["date"], fx_rows, asset_currency, base_currency)
    invested = contribution * len(lots)
    asset_return = sum(asset * lot["entry_fx"] - contribution for asset, lot in zip(final_lot_assets, lots))
    fx_impact = sum(asset * (sell_fx - lot["entry_fx"]) for asset, lot in zip(final_lot_assets, lots))
    gross_value = final_equity + dividends
    gross_profit = asset_return + fx_impact + dividends
    fee_rate = float(payload.get("fee_rate", 0))
    fees = invested * fee_rate + gross_value * fee_rate
    tax = max(0.0, gross_profit - fees) * float(payload.get("tax_rate", 0))
    net_value, net_profit = gross_value - fees - tax, gross_profit - fees - tax
    flows = [(lot["date"], -(contribution * (1 + fee_rate))) for lot in lots]
    flows.extend((flow["date"], flow["amount"]) for flow in dividend_flows)
    flows.append((sell["date"], final_equity - gross_value * fee_rate - tax))
    metrics = {"cagr": None, "xirr": calculate_xirr(flows), "volatility": None, "sharpe_ratio": None, "max_drawdown": None, "beta": None, "benchmark_return": None, "benchmark_difference": None}
    output = result("RECURRING_INVESTMENT", invested, gross_value, dividends, fees, tax, asset_return, fx_impact, net_profit, metrics, {"actual_sell_date": sell["date"], "contribution_count": len(lots), "contribution_amount": contribution, "final_shares": sum(asset / sell_price for asset in final_lot_assets)})
    output["contributions"] = [{"scheduled_date": lot["scheduled_date"], "trade_date": lot["date"], "amount": contribution, "shares": _round(lot["shares"]), "fx_rate": _round(lot["entry_fx"])} for lot in lots]
    return output


def simulate_portfolio(payload: Dict[str, Any]) -> Dict[str, Any]:
    assets = payload.get("assets", [])
    amount = float(payload["initial_amount"])
    if not assets or amount <= 0:
        raise ValueError("Portfolio scenarios require assets and a positive initial_amount")
    weights = [float(asset.get("weight", 0)) for asset in assets]
    if any(weight < 0 for weight in weights) or abs(sum(weights) - 1) > 1e-8:
        raise ValueError("Portfolio asset weights must be non-negative and sum to 1")
    component_results = []
    for asset, weight in zip(assets, weights):
        component_payload = {**payload, **asset, "initial_amount": amount * weight, "fee_rate": 0, "tax_rate": 0, "mode": "SINGLE_INVESTMENT"}
        component_results.append(simulate_single(component_payload))
    gross_value = sum(item["financials"]["gross_value"] for item in component_results)
    dividends = sum(item["financials"]["dividends"] for item in component_results)
    asset_return = sum(item["attribution"]["asset_return_amount"] for item in component_results)
    fx_impact = sum(item["attribution"]["fx_impact_amount"] for item in component_results)
    gross_profit = asset_return + fx_impact + dividends
    fee_rate = float(payload.get("fee_rate", 0))
    fees = amount * fee_rate + gross_value * fee_rate
    tax = max(0.0, gross_profit - fees) * float(payload.get("tax_rate", 0))
    net_profit = gross_profit - fees - tax
    metrics = {"cagr": calculate_cagr(amount, gross_value - fees - tax, payload["start_date"], payload["end_date"]), "xirr": calculate_xirr([(payload["start_date"], -(amount + amount * fee_rate)), (payload["end_date"], gross_value - gross_value * fee_rate - tax)]), "volatility": None, "sharpe_ratio": None, "max_drawdown": None, "beta": None, "benchmark_return": None, "benchmark_difference": None}
    output = result("PORTFOLIO_SCENARIO", amount, gross_value, dividends, fees, tax, asset_return, fx_impact, net_profit, metrics, {"asset_count": len(assets)})
    output["assets"] = [{"symbol": asset.get("symbol"), "weight": weight, "result": item} for asset, weight, item in zip(assets, weights, component_results)]
    return output


def result(mode: str, invested: float, gross_value: float, dividends: float, fees: float, tax: float, asset_return: float, fx_impact: float, net_profit: float, metrics: Dict[str, Any], details: Dict[str, Any]) -> Dict[str, Any]:
    gross_profit = asset_return + fx_impact + dividends
    return {
        "mode": mode,
        "details": {key: _round(value) if isinstance(value, float) else value for key, value in details.items()},
        "financials": {"initial_investment": _round(invested), "gross_value": _round(gross_value), "gross_profit": _round(gross_profit), "gross_return_percentage": _round(gross_profit / invested * 100), "dividends": _round(dividends), "fees": _round(fees), "estimated_tax": _round(tax), "net_value": _round(invested + net_profit), "net_profit": _round(net_profit), "net_return_percentage": _round(net_profit / invested * 100)},
        "attribution": {"asset_return_amount": _round(asset_return), "fx_impact_amount": _round(fx_impact), "dividend_amount": _round(dividends), "fees_amount": _round(-fees), "tax_amount": _round(-tax), "net_profit": _round(net_profit), "reconciliation_difference": _round(net_profit - (asset_return + fx_impact + dividends - fees - tax))},
        "risk_metrics": metrics,
        "assumptions": ["FX rates are base-currency units per asset-currency unit.", "Corporate actions and dividends are processed by effective date.", "Taxes are educational estimates, not tax advice."],
    }


def main() -> None:
    try:
        payload = json.loads(sys.stdin.read())
        mode = payload.get("mode", "SINGLE_INVESTMENT")
        engines = {"SINGLE_INVESTMENT": simulate_single, "RECURRING_INVESTMENT": simulate_recurring, "PORTFOLIO_SCENARIO": simulate_portfolio}
        if mode not in engines:
            raise ValueError(f"Unsupported scenario mode: {mode}")
        print(json.dumps(engines[mode](payload), separators=(",", ":")))
    except Exception as error:
        sys.stderr.write(str(error))
        sys.exit(1)


if __name__ == "__main__":
    main()
