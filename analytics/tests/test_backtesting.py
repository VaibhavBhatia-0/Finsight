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


if __name__ == "__main__":
    unittest.main()
