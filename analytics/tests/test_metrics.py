import unittest

from analytics.common.metrics import (
    calculate_beta,
    calculate_sharpe_ratio,
    calculate_volatility,
    calculate_xirr,
)


class FinancialMetricsTests(unittest.TestCase):
    def test_xirr_uses_actual_day_counts(self):
        self.assertAlmostEqual(calculate_xirr([("2020-01-01", -1000), ("2021-01-01", 1100)]), 9.97851825, places=8)

    def test_dca_xirr_fixture(self):
        self.assertAlmostEqual(calculate_xirr([("2020-01-01", -1000), ("2021-01-01", -1000), ("2022-01-01", 2310)]), 9.99730946, places=8)

    def test_beta_fixture(self):
        self.assertAlmostEqual(calculate_beta([100, 110, 104.5, 125.4], [100, 105, 102.9, 113.19]), 2.08715596, places=8)

    def test_volatility_and_sharpe_fixtures(self):
        prices = [100, 101, 99.99, 101.9898]
        self.assertAlmostEqual(calculate_volatility(prices), 24.248711, places=6)
        self.assertAlmostEqual(calculate_sharpe_ratio(prices), 6.66846708, places=8)


if __name__ == "__main__":
    unittest.main()
