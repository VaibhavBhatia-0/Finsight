"""
FinSight Analytics - Investment Simulation Engine (FinSight Lab)
Handles Single Investment, Recurring Investment (DCA), and Portfolio Scenarios.
Performs deterministic financial math, corporate actions, dividends, dynamic FX separation,
fees, estimated educational taxes, risk metrics, and benchmark comparisons.
"""

import sys
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

try:
    from analytics.common.metrics import (
        calculate_returns, calculate_cagr, calculate_xirr,
        calculate_volatility, calculate_sharpe_ratio, calculate_max_drawdown, calculate_beta
    )
except ImportError:
    # Direct execution support
    import os
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
    from analytics.common.metrics import (
        calculate_returns, calculate_cagr, calculate_xirr,
        calculate_volatility, calculate_sharpe_ratio, calculate_max_drawdown, calculate_beta
    )

def resolve_price_on_or_after(prices: List[Dict[str, Any]], target_date: str) -> Optional[Dict[str, Any]]:
    """Find the first trading day on or after target_date."""
    sorted_p = sorted(prices, key=lambda x: x["date"])
    for p in sorted_p:
        if p["date"] >= target_date:
            return p
    return sorted_p[-1] if sorted_p else None

def resolve_price_on_or_before(prices: List[Dict[str, Any]], target_date: str) -> Optional[Dict[str, Any]]:
    """Find the latest trading day on or before target_date."""
    sorted_p = sorted(prices, key=lambda x: x["date"], reverse=True)
    for p in sorted_p:
        if p["date"] <= target_date:
            return p
    return sorted_p[0] if sorted_p else None

def resolve_fx_rate(fx_rates: List[Dict[str, Any]], target_date: str, base_curr: str, quote_curr: str) -> float:
    """Find applicable FX rate for base_curr -> quote_curr."""
    if base_curr == quote_curr:
        return 1.0

    # Look for direct match or inverse match
    sorted_fx = sorted(fx_rates, key=lambda x: x.get("date", ""), reverse=True)
    for fx in sorted_fx:
        d = fx.get("date", "")
        if d <= target_date:
            b = fx.get("base_currency", "")
            q = fx.get("quote_currency", "")
            rate = float(fx.get("rate", 1.0))
            if b == base_curr and q == quote_curr:
                return rate
            elif b == quote_curr and q == base_curr and rate > 0:
                return 1.0 / rate

    # Fallback to earliest available or 1.0
    if sorted_fx:
        b = sorted_fx[-1].get("base_currency", "")
        q = sorted_fx[-1].get("quote_currency", "")
        rate = float(sorted_fx[-1].get("rate", 1.0))
        if b == base_curr and q == quote_curr:
            return rate
        elif b == quote_curr and q == base_curr and rate > 0:
            return 1.0 / rate

    return 1.0

def simulate_single_investment(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Single lump sum investment simulation."""
    initial_amount = float(payload.get("initial_amount", 10000.0))
    base_currency = payload.get("base_currency", "INR")
    asset_currency = payload.get("asset_currency", "USD")
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    prices = payload.get("price_history", [])
    fx_rates = payload.get("exchange_rates", [])
    dividends = payload.get("dividends", [])
    corp_actions = payload.get("corporate_actions", [])
    benchmark_prices = payload.get("benchmark_price_history", [])
    fee_rate = float(payload.get("fee_rate", 0.001))  # 0.1% default
    tax_rate = float(payload.get("tax_rate", 0.125))  # 12.5% default LTCG

    if not prices or not start_date or not end_date:
        raise ValueError("Missing required price data or date range for simulation.")

    buy_bar = resolve_price_on_or_after(prices, start_date)
    sell_bar = resolve_price_on_or_before(prices, end_date)

    if not buy_bar or not sell_bar:
        raise ValueError(f"Unable to resolve trading days between {start_date} and {end_date}.")

    actual_buy_date = buy_bar["date"]
    actual_sell_date = sell_bar["date"]
    buy_price = float(buy_bar["close"])
    sell_price = float(sell_bar["close"])

    # FX conversion on buy date (e.g. INR to USD: 1 / (USD/INR))
    # fx_rate represents (Asset Currency / Base Currency) or standard pair (USD/INR)
    # If base is INR and asset is USD, rate USD/INR = 83.0 -> 1 INR = 1/83 USD
    usd_inr_buy = resolve_fx_rate(fx_rates, actual_buy_date, "USD", "INR")
    usd_inr_sell = resolve_fx_rate(fx_rates, actual_sell_date, "USD", "INR")

    if base_currency == "INR" and asset_currency == "USD":
        start_fx_to_asset = 1.0 / usd_inr_buy if usd_inr_buy > 0 else 1.0
        exit_fx_to_base = usd_inr_sell
    elif base_currency == "USD" and asset_currency == "INR":
        start_fx_to_asset = usd_inr_buy
        exit_fx_to_base = 1.0 / usd_inr_sell if usd_inr_sell > 0 else 1.0
    else:
        start_fx_to_asset = 1.0
        exit_fx_to_base = 1.0

    # Buying power in asset currency
    invest_in_asset_curr = initial_amount * start_fx_to_asset
    shares = invest_in_asset_curr / buy_price

    # Apply corporate actions (Splits / Bonuses)
    adjusted_shares = shares
    for ca in sorted(corp_actions, key=lambda x: x.get("action_date", "")):
        ca_date = ca.get("action_date", "")
        if actual_buy_date < ca_date <= actual_sell_date:
            ratio = float(ca.get("ratio", 1.0))
            if ratio > 0:
                adjusted_shares *= ratio

    # Accumulate dividends
    total_dividend_asset_curr = 0.0
    for div in sorted(dividends, key=lambda x: x.get("ex_date", "")):
        div_date = div.get("ex_date", "")
        if actual_buy_date < div_date <= actual_sell_date:
            div_amount = float(div.get("amount", 0.0))
            total_dividend_asset_curr += div_amount * adjusted_shares

    # Gross value at exit in asset currency
    equity_exit_asset_curr = adjusted_shares * sell_price
    gross_proceeds_asset_curr = equity_exit_asset_curr + total_dividend_asset_curr

    # Convert back to base currency
    gross_value_base_curr = gross_proceeds_asset_curr * exit_fx_to_base
    dividends_base_curr = total_dividend_asset_curr * exit_fx_to_base

    # Return Attribution: Asset Return vs FX Impact
    # Asset return: return of the stock in local currency converted at initial FX
    local_gain_asset_curr = gross_proceeds_asset_curr - invest_in_asset_curr
    asset_return_in_base = local_gain_asset_curr / start_fx_to_asset if start_fx_to_asset > 0 else local_gain_asset_curr

    # FX impact: difference caused by currency change on total asset value
    fx_impact_in_base = gross_proceeds_asset_curr * (exit_fx_to_base - (1.0 / start_fx_to_asset if start_fx_to_asset > 0 else 1.0))

    gross_profit_base_curr = gross_value_base_curr - initial_amount
    gross_return_pct = (gross_profit_base_curr / initial_amount) * 100.0 if initial_amount > 0 else 0.0

    # Fees & Taxes
    buy_fee = initial_amount * fee_rate
    sell_fee = gross_value_base_curr * fee_rate
    total_fees = buy_fee + sell_fee

    taxable_gain = max(0.0, gross_profit_base_curr - total_fees)
    estimated_tax = taxable_gain * tax_rate

    # Net Return
    net_value_base_curr = gross_value_base_curr - total_fees - estimated_tax
    net_profit_base_curr = net_value_base_curr - initial_amount
    net_return_pct = (net_profit_base_curr / initial_amount) * 100.0 if initial_amount > 0 else 0.0

    # Risk Metrics over holding period
    period_prices = [float(p["close"]) for p in prices if actual_buy_date <= p["date"] <= actual_sell_date]
    volatility = calculate_volatility(period_prices)
    max_drawdown = calculate_max_drawdown(period_prices)
    sharpe_ratio = calculate_sharpe_ratio(period_prices)
    cagr = calculate_cagr(initial_amount, net_value_base_curr, actual_buy_date, actual_sell_date)

    # Benchmark comparison
    benchmark_return = 0.0
    benchmark_difference = 0.0
    if benchmark_prices:
        b_buy = resolve_price_on_or_after(benchmark_prices, start_date)
        b_sell = resolve_price_on_or_before(benchmark_prices, end_date)
        if b_buy and b_sell and float(b_buy["close"]) > 0:
            b_p_buy = float(b_buy["close"])
            b_p_sell = float(b_sell["close"])
            benchmark_return = round(((b_p_sell - b_p_buy) / b_p_buy) * 100.0, 4)
            benchmark_difference = round(net_return_pct - benchmark_return, 4)

    return {
        "mode": "SINGLE_INVESTMENT",
        "dates": {
            "requested_start_date": start_date,
            "requested_end_date": end_date,
            "actual_buy_date": actual_buy_date,
            "actual_sell_date": actual_sell_date,
        },
        "prices": {
            "buy_price": round(buy_price, 4),
            "sell_price": round(sell_price, 4),
            "initial_shares": round(shares, 6),
            "adjusted_shares": round(adjusted_shares, 6),
        },
        "fx": {
            "base_currency": base_currency,
            "asset_currency": asset_currency,
            "buy_fx_rate": round(usd_inr_buy, 4),
            "sell_fx_rate": round(usd_inr_sell, 4),
            "fx_impact": round(fx_impact_in_base, 2),
        },
        "financials": {
            "initial_investment": round(initial_amount, 2),
            "gross_value": round(gross_value_base_curr, 2),
            "gross_profit": round(gross_profit_base_curr, 2),
            "gross_return_percentage": round(gross_return_pct, 4),
            "dividends": round(dividends_base_curr, 2),
            "fees": round(total_fees, 2),
            "estimated_tax": round(estimated_tax, 2),
            "net_value": round(net_value_base_curr, 2),
            "net_profit": round(net_profit_base_curr, 2),
            "net_return_percentage": round(net_return_pct, 4),
        },
        "attribution": {
            "asset_return_amount": round(asset_return_in_base, 2),
            "fx_impact_amount": round(fx_impact_in_base, 2),
            "dividend_amount": round(dividends_base_curr, 2),
            "fees_amount": round(-total_fees, 2),
            "tax_amount": round(-estimated_tax, 2),
            "net_profit": round(net_profit_base_curr, 2),
        },
        "risk_metrics": {
            "cagr": cagr,
            "volatility": volatility,
            "sharpe_ratio": sharpe_ratio,
            "max_drawdown": max_drawdown,
            "benchmark_return": benchmark_return,
            "benchmark_difference": benchmark_difference,
        }
    }

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input:
            raise ValueError("No input payload received on stdin.")

        payload = json.loads(raw_input)
        mode = payload.get("mode", "SINGLE_INVESTMENT")

        if mode == "SINGLE_INVESTMENT":
            result = simulate_single_investment(payload)
        else:
            result = simulate_single_investment(payload)

        print(json.dumps(result))
        sys.exit(0)
    except Exception as e:
        sys.stderr.write(str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()

