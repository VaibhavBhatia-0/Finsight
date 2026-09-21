"""Deterministic goal and contribution planning calculations."""

import calendar
import json
import math
import sys
from datetime import date, datetime, timedelta


def _date(value):
    return datetime.strptime(value, "%Y-%m-%d").date()


def _add_months(value, months):
    month_index = value.month - 1 + months
    year, month = value.year + month_index // 12, month_index % 12 + 1
    return date(year, month, min(value.day, calendar.monthrange(year, month)[1]))


def contribution_dates(as_of, target, frequency):
    if frequency == "WEEKLY":
        cursor = as_of + timedelta(days=7)
        step = None
    else:
        step = {"MONTHLY": 1, "QUARTERLY": 3, "YEARLY": 12}.get(frequency)
        if step is None:
            raise ValueError("frequency must be WEEKLY, MONTHLY, QUARTERLY, or YEARLY")
        cursor = _add_months(as_of, step)
    dates = []
    while cursor <= target:
        dates.append(cursor)
        cursor = cursor + timedelta(days=7) if frequency == "WEEKLY" else _add_months(cursor, step)
        if len(dates) > 5200:
            raise ValueError("Planning horizon creates too many contribution dates")
    return dates


def required_contribution(payload):
    target_amount = float(payload["target_amount"])
    current_amount = float(payload.get("current_amount", 0))
    as_of = _date(payload["as_of_date"])
    target = _date(payload["target_date"])
    frequency = payload["frequency"]
    assumed_return = payload.get("assumed_annual_return")
    if target_amount <= 0 or current_amount < 0 or target <= as_of:
        raise ValueError("A positive target, non-negative current amount, and future target date are required")
    if assumed_return is not None and (float(assumed_return) <= -1 or float(assumed_return) > 10):
        raise ValueError("assumed annual return must be greater than -100% and no more than 1000%")
    dates = contribution_dates(as_of, target, frequency)
    if not dates:
        raise ValueError("No contribution dates occur before the target date")

    remaining_no_growth = max(0.0, target_amount - current_amount)
    no_growth = remaining_no_growth / len(dates)
    result = {
        "targetAmount": round(target_amount, 8),
        "currentAmount": round(current_amount, 8),
        "remainingAmount": round(remaining_no_growth, 8),
        "frequency": frequency,
        "contributionCount": len(dates),
        "contributionDates": [value.isoformat() for value in dates],
        "noGrowth": {
            "requiredContribution": round(no_growth, 8),
            "totalContributions": round(no_growth * len(dates), 8),
            "estimatedGrowth": 0.0,
        },
        "growthAssumption": None,
    }

    if assumed_return is not None:
        annual_rate = float(assumed_return)
        target_days = (target - as_of).days
        current_future_value = current_amount * ((1 + annual_rate) ** (target_days / 365.25))
        factors = [((1 + annual_rate) ** ((target - contribution_date).days / 365.25)) for contribution_date in dates]
        required = max(0.0, (target_amount - current_future_value) / sum(factors))
        total_contributions = required * len(dates)
        estimated_growth = target_amount - current_amount - total_contributions
        result["growthAssumption"] = {
            "assumedAnnualReturn": round(annual_rate * 100, 8),
            "requiredContribution": round(required, 8),
            "totalContributions": round(total_contributions, 8),
            "estimatedGrowth": round(estimated_growth, 8),
            "disclaimer": "Hypothetical projection based on the stated return assumption; not a guaranteed outcome.",
        }
    return result


def run(payload):
    operation = payload.get("operation")
    if operation == "REQUIRED_CONTRIBUTION":
        return required_contribution(payload)
    raise ValueError("Unsupported planning operation")


if __name__ == "__main__":
    try:
        print(json.dumps(run(json.loads(sys.stdin.read())), separators=(",", ":")))
    except Exception as error:
        sys.stderr.write(str(error))
        sys.exit(1)
