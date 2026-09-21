import unittest

from analytics.portfolio.intelligence import run


class PortfolioIntelligenceKnownAnswerTests(unittest.TestCase):
    def test_attribution_reconciles_fees_taxes_dividends_and_price_return(self):
        result = run({
            "base_currency": "USD",
            "end_date": "2024-01-04",
            "transactions": [
                {"id": 1, "type": "DEPOSIT", "date": "2024-01-01", "amount": 1000, "fx_rate": 1},
                {"id": 2, "type": "BUY", "date": "2024-01-02", "stock_id": 1, "quantity": 10, "price": 50, "amount": 500, "fee_amount": 10, "fx_rate": 1},
                {"id": 3, "type": "DIVIDEND", "date": "2024-01-03", "stock_id": 1, "amount": 20, "fee_amount": 0, "fx_rate": 1},
                {"id": 4, "type": "TAX", "date": "2024-01-03", "stock_id": 1, "amount": 5, "fee_amount": 0, "fx_rate": 1},
            ],
            "assets": [{
                "stock_id": 1, "symbol": "TEST", "name": "Test Corp", "sector": "Technology",
                "country": "US", "currency": "USD", "prices": [
                    {"date": "2024-01-02", "close": 50}, {"date": "2024-01-03", "close": 55}, {"date": "2024-01-04", "close": 60},
                ], "fx_rates": [],
            }],
        })
        totals = result["attribution"]["totals"]
        self.assertEqual(result["performance"]["currentValue"], 1105)
        self.assertEqual(result["performance"]["netPnl"], 105)
        self.assertEqual(totals["priceReturn"], 100)
        self.assertEqual(totals["dividends"], 20)
        self.assertEqual(totals["fees"], 10)
        self.assertEqual(totals["taxes"], 5)
        self.assertEqual(totals["netPnl"], 105)
        self.assertEqual(totals["reconciliationDifference"], 0)
        self.assertEqual(result["performance"]["portfolioReturn"], 10.5)

    def test_historical_fx_is_separated_from_asset_price_return(self):
        result = run({
            "base_currency": "INR", "end_date": "2024-02-01",
            "transactions": [
                {"id": 1, "type": "DEPOSIT", "date": "2024-01-01", "amount": 10000, "fx_rate": 1},
                {"id": 2, "type": "BUY", "date": "2024-01-01", "stock_id": 2, "quantity": 10, "price": 10, "amount": 100, "fee_amount": 0, "fx_rate": 80},
            ],
            "assets": [{
                "stock_id": 2, "symbol": "USD", "name": "USD Asset", "country": "US", "currency": "USD",
                "prices": [{"date": "2024-01-01", "close": 10}, {"date": "2024-02-01", "close": 12}],
                "fx_rates": [{"date": "2024-01-01", "rate": 80}, {"date": "2024-02-01", "rate": 85}],
            }],
        })
        totals = result["attribution"]["totals"]
        self.assertEqual(totals["priceReturn"], 1600)
        self.assertEqual(totals["fxImpact"], 600)
        self.assertEqual(totals["netPnl"], 2200)
        self.assertEqual(totals["reconciliationDifference"], 0)

    def test_risk_and_concentration_require_real_observations(self):
        prices = [{"date": f"2024-01-{day:02d}", "close": 100 + day + (day % 3)} for day in range(1, 25)]
        benchmark = [{"date": row["date"], "close": 200 + index * 2} for index, row in enumerate(prices)]
        result = run({
            "base_currency": "USD", "end_date": "2024-01-24",
            "transactions": [
                {"id": 1, "type": "DEPOSIT", "date": "2024-01-01", "amount": 1000, "fx_rate": 1},
                {"id": 2, "type": "BUY", "date": "2024-01-01", "stock_id": 1, "quantity": 10, "price": 100, "amount": 1000, "fee_amount": 0, "fx_rate": 1},
            ],
            "assets": [{"stock_id": 1, "symbol": "A", "name": "A", "country": "US", "currency": "USD", "prices": prices, "fx_rates": []}],
            "benchmark": {"code": "TEST", "name": "Test", "currency": "USD", "prices": benchmark, "fx_rates": []},
        })
        self.assertEqual(result["risk"]["status"], "AVAILABLE")
        self.assertIsNotNone(result["risk"]["volatility"])
        self.assertIsNotNone(result["risk"]["beta"])
        self.assertIsNotNone(result["risk"]["correlation"])
        self.assertEqual(result["risk"]["concentration"]["herfindahlIndex"], 1)
        self.assertEqual(result["risk"]["concentration"]["largestHoldingPercentage"], 100)


if __name__ == "__main__":
    unittest.main()
