"""
FinSight Analytics - Core Financial Metrics Engine
Implements deterministic formulas for returns, CAGR, XIRR, Volatility, Sharpe Ratio,
Maximum Drawdown, Beta, and Correlation.
"""

import math
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional

def calculate_returns(initial_value: float, final_value: float) -> Dict[str, float]:
    """Calculate absolute and percentage returns."""
    if initial_value <= 0:
        return {"absolute_return": 0.0, "return_percentage": 0.0}
    
    absolute = final_value - initial_value
    percentage = (absolute / initial_value) * 100.0
    return {
        "absolute_return": round(absolute, 4),
        "return_percentage": round(percentage, 4)
    }

def calculate_cagr(initial_value: float, final_value: float, start_date_str: str, end_date_str: str) -> float:
    """
    Calculate Compound Annual Growth Rate (CAGR).
    Formula: (final_value / initial_value) ** (1 / years) - 1
    """
    if initial_value <= 0 or final_value <= 0:
        return 0.0

    d1 = datetime.strptime(start_date_str, "%Y-%m-%d")
    d2 = datetime.strptime(end_date_str, "%Y-%m-%d")
    days = (d2 - d1).days

    if days <= 0:
        return 0.0

    years = days / 365.25
    if years < 0.08:  # Less than 1 month, annualization is misleading
        return round(((final_value - initial_value) / initial_value) * 100.0, 4)

    cagr = ((final_value / initial_value) ** (1.0 / years) - 1.0) * 100.0
    return round(cagr, 4)

def calculate_xirr(cash_flows: List[Tuple[str, float]], guess: float = 0.1, max_iter: int = 100) -> Optional[float]:
    """
    Calculate Extended Internal Rate of Return (XIRR) using Newton-Raphson.
    cash_flows: List of (date_str 'YYYY-MM-DD', amount)
    Investments are negative amounts, inflows/final valuation are positive.
    """
    if len(cash_flows) < 2:
        return None

    # Check for at least one positive and one negative cash flow
    has_pos = any(cf[1] > 0 for cf in cash_flows)
    has_neg = any(cf[1] < 0 for cf in cash_flows)
    if not (has_pos and has_neg):
        return None

    parsed_flows = []
    base_date = datetime.strptime(cash_flows[0][0], "%Y-%m-%d")

    for dt_str, amount in cash_flows:
        dt = datetime.strptime(dt_str, "%Y-%m-%d")
        fractional_years = (dt - base_date).days / 365.25
        parsed_flows.append((fractional_years, amount))

    # Newton-Raphson solver
    rate = guess
    for _ in range(max_iter):
        npv = 0.0
        d_npv = 0.0
        for t, amount in parsed_flows:
            denom = (1.0 + rate) ** t
            if denom == 0:
                denom = 1e-10
            npv += amount / denom
            if t != 0:
                d_npv -= (t * amount) / ((1.0 + rate) ** (t + 1.0))

        if abs(d_npv) < 1e-10:
            break

        new_rate = rate - (npv / d_npv)
        if abs(new_rate - rate) < 1e-6:
            return round(new_rate * 100.0, 4)
        rate = new_rate

    # Return percentage rate
    return round(rate * 100.0, 4)

def calculate_volatility(prices: List[float], annualization_factor: int = 252) -> float:
    """
    Annualized volatility of price returns.
    Formula: std_dev(daily_returns) * sqrt(annualization_factor) * 100
    """
    if len(prices) < 3:
        return 0.0

    returns = []
    for i in range(1, len(prices)):
        p_prev = prices[i - 1]
        p_curr = prices[i]
        if p_prev > 0:
            returns.append((p_curr - p_prev) / p_prev)

    if not returns:
        return 0.0

    mean = sum(returns) / len(returns)
    variance = sum((r - mean) ** 2 for r in returns) / (len(returns) - 1)
    std_dev = math.sqrt(variance)

    annualized_vol = std_dev * math.sqrt(annualization_factor) * 100.0
    return round(annualized_vol, 4)

def calculate_sharpe_ratio(prices: List[float], risk_free_rate: float = 0.065, annualization_factor: int = 252) -> float:
    """
    Annualized Sharpe Ratio.
    Formula: (annualized_return - risk_free_rate) / annualized_volatility
    """
    if len(prices) < 10:
        return 0.0

    returns = []
    for i in range(1, len(prices)):
        p_prev = prices[i - 1]
        p_curr = prices[i]
        if p_prev > 0:
            returns.append((p_curr - p_prev) / p_prev)

    if not returns:
        return 0.0

    mean_daily = sum(returns) / len(returns)
    annualized_return = mean_daily * annualization_factor

    variance = sum((r - mean_daily) ** 2 for r in returns) / (len(returns) - 1)
    annualized_vol = math.sqrt(variance) * math.sqrt(annualization_factor)

    if annualized_vol == 0:
        return 0.0

    sharpe = (annualized_return - risk_free_rate) / annualized_vol
    return round(sharpe, 4)

def calculate_max_drawdown(prices: List[float]) -> float:
    """
    Maximum peak-to-trough decline.
    Formula: max((peak - trough) / peak) * 100
    """
    if not prices or len(prices) < 2:
        return 0.0

    peak = prices[0]
    max_dd = 0.0

    for price in prices:
        if price > peak:
            peak = price
        elif peak > 0:
            dd = (peak - price) / peak
            if dd > max_dd:
                max_dd = dd

    return round(max_dd * 100.0, 4)

def calculate_beta(asset_prices: List[float], benchmark_prices: List[float]) -> float:
    """
    Beta of asset relative to benchmark.
    Formula: Covariance(asset, bench) / Variance(bench)
    """
    n = min(len(asset_prices), len(benchmark_prices))
    if n < 5:
        return 1.0

    r_asset = [(asset_prices[i] - asset_prices[i - 1]) / asset_prices[i - 1] for i in range(1, n) if asset_prices[i - 1] > 0]
    r_bench = [(benchmark_prices[i] - benchmark_prices[i - 1]) / benchmark_prices[i - 1] for i in range(1, n) if benchmark_prices[i - 1] > 0]

    count = min(len(r_asset), len(r_bench))
    if count < 5:
        return 1.0

    mean_a = sum(r_asset[:count]) / count
    mean_b = sum(r_bench[:count]) / count

    cov = sum((r_asset[i] - mean_a) * (r_bench[i] - mean_b) for i in range(count)) / (count - 1)
    var_b = sum((r_bench[i] - mean_b) ** 2 for i in range(count)) / (count - 1)

    if var_b == 0:
        return 1.0

    return round(cov / var_b, 4)

