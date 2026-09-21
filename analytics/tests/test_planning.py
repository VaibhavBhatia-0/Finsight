import unittest

from analytics.planning.engine import required_contribution


class PlanningKnownAnswerTests(unittest.TestCase):
    def test_monthly_no_growth_requirement_uses_actual_calendar_dates(self):
        result = required_contribution({
            "target_amount": 1200, "current_amount": 0,
            "as_of_date": "2026-01-01", "target_date": "2027-01-01", "frequency": "MONTHLY",
        })
        self.assertEqual(result["contributionCount"], 12)
        self.assertEqual(result["contributionDates"][1], "2026-03-01")
        self.assertEqual(result["noGrowth"]["requiredContribution"], 100)
        self.assertEqual(result["noGrowth"]["totalContributions"], 1200)

    def test_zero_percent_explicit_growth_assumption_matches_no_growth(self):
        result = required_contribution({
            "target_amount": 1200, "current_amount": 0,
            "as_of_date": "2026-01-01", "target_date": "2027-01-01", "frequency": "MONTHLY",
            "assumed_annual_return": 0,
        })
        self.assertEqual(result["growthAssumption"]["requiredContribution"], 100)
        self.assertEqual(result["growthAssumption"]["estimatedGrowth"], 0)


if __name__ == "__main__":
    unittest.main()
