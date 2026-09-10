"""Deterministic, dependency-free financial metrics used by simulations and backtests."""

import math
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

DAYS_PER_YEAR = 365.25
TRADING_DAYS_PER_YEAR = 252


def calculate_returns(initial_value: float, final_value: float) -> Dict[str, float]:
    if initial_value <= 0:
        return {"absolute_return": 0.0, "return_percentage": 0.0}
    absolute = final_value - initial_value
    return {"absolute_return": round(absolute, 4), "return_percentage": round(absolute / initial_value * 100, 4)}


def calculate_cagr(initial_value: float, final_value: float, start_date_str: str, end_date_str: str) -> float:
    """Annualized CAGR as a percentage; only valid for positive values and a positive interval."""
    if initial_value <= 0 or final_value <= 0:
        return 0.0
    start = datetime.strptime(start_date_str, "%Y-%m-%d")
    end = datetime.strptime(end_date_str, "%Y-%m-%d")
    days = (end - start).days
    if days <= 0:
        return 0.0
    return round(((final_value / initial_value) ** (DAYS_PER_YEAR / days) - 1) * 100, 6)


def calculate_xirr(cash_flows: List[Tuple[str, float]], max_iter: int = 256) -> Optional[float]:
    """Solve dated NPV with a bracketed bisection method and return an annual percentage rate."""
    if len(cash_flows) < 2 or not any(v < 0 for _, v in cash_flows) or not any(v > 0 for _, v in cash_flows):
        return None
    ordered = sorted((datetime.strptime(date, "%Y-%m-%d"), float(value)) for date, value in cash_flows)
    origin = ordered[0][0]
    flows = [((date - origin).days / DAYS_PER_YEAR, value) for date, value in ordered]

    def npv(rate: float) -> float:
        return sum(value / ((1 + rate) ** years) for years, value in flows)

    low, high = -0.999999999, 1.0
    low_value, high_value = npv(low), npv(high)
    while low_value * high_value > 0 and high < 1_000_000:
        high *= 2
        high_value = npv(high)
    if not math.isfinite(low_value) or not math.isfinite(high_value) or low_value * high_value > 0:
        return None

    scale = max(1.0, sum(abs(value) for _, value in flows))
    midpoint = 0.0
    for _ in range(max_iter):
        midpoint = (low + high) / 2
        value = npv(midpoint)
        if abs(value) <= scale * 1e-12 or high - low <= 1e-12:
            return round(midpoint * 100, 8)
        if low_value * value <= 0:
            high, high_value = midpoint, value
        else:
            low, low_value = midpoint, value
    return None


def _returns(prices: List[float]) -> List[float]:
    return [(current / previous) - 1 for previous, current in zip(prices, prices[1:]) if previous > 0]


def _sample_standard_deviation(values: List[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    return math.sqrt(sum((value - mean) ** 2 for value in values) / (len(values) - 1))


def calculate_volatility(prices: List[float], annualization_factor: int = TRADING_DAYS_PER_YEAR) -> float:
    daily_returns = _returns(prices)
    return round(_sample_standard_deviation(daily_returns) * math.sqrt(annualization_factor) * 100, 6)


def calculate_sharpe_ratio(prices: List[float], risk_free_rate: float = 0.065, annualization_factor: int = TRADING_DAYS_PER_YEAR) -> float:
    daily_returns = _returns(prices)
    standard_deviation = _sample_standard_deviation(daily_returns)
    if len(daily_returns) < 2 or standard_deviation == 0:
        return 0.0
    daily_risk_free = (1 + risk_free_rate) ** (1 / annualization_factor) - 1
    excess_mean = sum(value - daily_risk_free for value in daily_returns) / len(daily_returns)
    return round(excess_mean / standard_deviation * math.sqrt(annualization_factor), 8)


def calculate_max_drawdown(values: List[float]) -> float:
    if len(values) < 2:
        return 0.0
    peak = values[0]
    maximum = 0.0
    for value in values:
        peak = max(peak, value)
        if peak > 0:
            maximum = max(maximum, (peak - value) / peak)
    return round(maximum * 100, 6)


def calculate_beta(asset_prices: List[float], benchmark_prices: List[float]) -> Optional[float]:
    count = min(len(asset_prices), len(benchmark_prices))
    if count < 3:
        return None
    asset_returns = _returns(asset_prices[:count])
    benchmark_returns = _returns(benchmark_prices[:count])
    count = min(len(asset_returns), len(benchmark_returns))
    if count < 2:
        return None
    asset_mean = sum(asset_returns[:count]) / count
    benchmark_mean = sum(benchmark_returns[:count]) / count
    covariance = sum((asset_returns[i] - asset_mean) * (benchmark_returns[i] - benchmark_mean) for i in range(count)) / (count - 1)
    variance = sum((value - benchmark_mean) ** 2 for value in benchmark_returns[:count]) / (count - 1)
    return None if variance == 0 else round(covariance / variance, 8)


def calculate_beta_dated(asset_values: List[Dict[str, Any]], benchmark_values: List[Dict[str, Any]]) -> Optional[float]:
    """Calculate beta only after an inner join by observation date."""
    asset_by_date = {row["date"]: float(row["value"]) for row in asset_values}
    benchmark_by_date = {row["date"]: float(row["value"]) for row in benchmark_values}
    dates = sorted(set(asset_by_date).intersection(benchmark_by_date))
    return calculate_beta([asset_by_date[date] for date in dates], [benchmark_by_date[date] for date in dates])
