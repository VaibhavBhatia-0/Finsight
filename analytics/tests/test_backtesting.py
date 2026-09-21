import unittest

from analytics.backtesting.engine import run


class CanonicalBacktestTests(unittest.TestCase):
    def test_weighted_buy_and_hold_fixture(self):
        asset = lambda symbol, weight, start, end: {
            "symbol": symbol,
            "weight": weight,
            "asset_currency": "USD",
            "price_history": [{"date": "2020-01-01", "close": start}, {"date": "2021-01-01", "close": end}],
            "exchange_rates": [],
        }
        value = run({
            "strategy_type": "BUY_AND_HOLD",
            "initial_amount": 1000,
            "base_currency": "USD",
            "assets": [asset("A", 0.6, 10, 12), asset("B", 0.4, 20, 18)],
        })
        self.assertEqual(value["final_value"], 1080)
        self.assertEqual(value["absolute_return"], 80)
        self.assertEqual(value["return_percentage"], 8)

    def test_percentage_and_fixed_fees_change_cash_shares_value_returns_xirr_and_attribution(self):
        asset = {
            "symbol": "A", "weight": 1, "asset_currency": "USD", "exchange_rates": [],
            "price_history": [{"date": "2020-01-01", "close": 100}, {"date": "2021-01-01", "close": 110}],
        }
        value = run({
            "strategy_type": "BUY_AND_HOLD", "initial_amount": 1000, "base_currency": "USD",
            "assets": [asset], "fee_rate": 0.01, "fixed_fee": 1,
        })
        self.assertEqual(value["transaction_values"], {"entry": 989.10891089, "exit": 1088.01980198})
        self.assertEqual(value["fees_paid"], 22.77128713)
        self.assertEqual(value["gross_final_value"], 1100)
        self.assertEqual(value["final_value"], 1076.13960396)
        self.assertEqual(value["return_percentage"], 7.6139604)
        self.assertEqual(value["xirr"], 7.59777978)
        self.assertEqual(value["attribution"], {"gross_market_profit": 100, "fee_impact": 23.86039604, "net_profit": 76.13960396})
        self.assertAlmostEqual(value["attribution"]["gross_market_profit"] - value["attribution"]["fee_impact"], value["attribution"]["net_profit"], places=8)

    def test_benchmark_metrics_and_chart_are_fx_normalized_and_deterministic(self):
        asset = {
            "symbol": "A", "weight": 1, "asset_currency": "USD", "exchange_rates": [],
            "price_history": [{"date": "2020-01-01", "close": 100}, {"date": "2021-01-01", "close": 110}],
        }
        benchmark = {
            "symbol": "^GSPC", "asset_currency": "USD", "exchange_rates": [],
            "price_history": [{"date": "2020-01-01", "close": 200}, {"date": "2021-01-01", "close": 210}],
        }
        value = run({
            "strategy_type": "BUY_AND_HOLD", "initial_amount": 1000, "base_currency": "USD",
            "assets": [asset], "benchmark": benchmark, "fee_rate": 0.01, "fixed_fee": 1,
        })
        self.assertEqual(value["benchmark_return"], 5)
        self.assertEqual(value["benchmark_cagr"], 4.989503)
        self.assertEqual(value["benchmark_difference"], 2.6139604)
        self.assertEqual(value["relative_performance"], 2.48948609)
        self.assertEqual(value["time_series"][-1], {"date": "2021-01-01", "value": 1076.13960396, "strategy_value": 1076.13960396, "benchmark_value": 1050})


if __name__ == "__main__":
    unittest.main()
