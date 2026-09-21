import unittest

from analytics.simulations.simulator import simulate_portfolio, simulate_recurring, simulate_single


class ScenarioEngineKnownAnswerTests(unittest.TestCase):
    def base(self, **overrides):
        value = {
            "mode": "SINGLE_INVESTMENT", "initial_amount": 1000,
            "start_date": "2024-01-01", "end_date": "2025-01-01",
            "base_currency": "USD", "asset_currency": "USD",
            "price_history": [{"date": "2024-01-01", "close": 100}, {"date": "2025-01-01", "close": 110}],
            "exchange_rates": [], "dividends": [], "corporate_actions": [],
            "fee_rate": 0, "tax_rate": 0, "tax_exemption": 0,
        }
        value.update(overrides)
        return value

    def test_fx_attribution_reconciles_exactly(self):
        result = simulate_single(self.base(
            initial_amount=83000, base_currency="INR", asset_currency="USD",
            exchange_rates=[
                {"date": "2024-01-01", "base_currency": "USD", "quote_currency": "INR", "rate": 83},
                {"date": "2025-01-01", "base_currency": "USD", "quote_currency": "INR", "rate": 96},
            ],
        ))
        self.assertEqual(result["financials"]["gross_value"], 105600)
        self.assertEqual(result["attribution"]["asset_return_amount"], 8300)
        self.assertEqual(result["attribution"]["fx_impact_amount"], 14300)
        self.assertEqual(result["financials"]["net_profit"], 22600)
        self.assertEqual(result["attribution"]["reconciliation_difference"], 0)

    def test_split_precedes_later_dividend_and_is_not_double_adjusted(self):
        result = simulate_single(self.base(
            price_history=[{"date": "2024-01-01", "close": 100}, {"date": "2025-01-01", "close": 60}],
            corporate_actions=[{"action_date": "2024-06-01", "action_type": "SPLIT", "ratio": 2}],
            dividends=[{"ex_date": "2024-08-01", "amount": 1}],
        ))
        self.assertEqual(result["details"]["adjusted_shares"], 20)
        self.assertEqual(result["financials"]["dividends"], 20)
        self.assertEqual(result["financials"]["gross_value"], 1220)
        self.assertEqual(result["financials"]["net_profit"], 220)

    def test_fees_and_educational_tax_reduce_net_value(self):
        result = simulate_single(self.base(fee_rate=.01, tax_rate=.10))
        self.assertEqual(result["financials"]["fees"], 21)
        self.assertEqual(result["financials"]["estimated_tax"], 7.9)
        self.assertEqual(result["financials"]["net_profit"], 71.1)
        self.assertEqual(result["financials"]["net_value"], 1071.1)
        self.assertEqual(result["attribution"]["reconciliation_difference"], 0)

    def test_recurring_investment_executes_each_contribution_at_its_own_price(self):
        result = simulate_recurring(self.base(
            mode="RECURRING_INVESTMENT", initial_amount=100, start_date="2024-01-01", end_date="2024-03-01",
            contribution_frequency="MONTHLY",
            price_history=[
                {"date": "2024-01-01", "close": 10},
                {"date": "2024-02-01", "close": 20},
                {"date": "2024-03-01", "close": 20},
            ],
        ))
        self.assertEqual(result["details"]["contribution_count"], 3)
        self.assertEqual([row["shares"] for row in result["contributions"]], [10, 5, 5])
        self.assertEqual(result["financials"]["initial_investment"], 300)
        self.assertEqual(result["financials"]["net_value"], 400)

    def test_portfolio_scenario_is_a_separate_weighted_execution_path(self):
        result = simulate_portfolio(self.base(
            mode="PORTFOLIO_SCENARIO", assets=[
                {"symbol": "A", "weight": .6, "price_history": [{"date": "2024-01-01", "close": 10}, {"date": "2025-01-01", "close": 12}], "asset_currency": "USD", "exchange_rates": []},
                {"symbol": "B", "weight": .4, "price_history": [{"date": "2024-01-01", "close": 20}, {"date": "2025-01-01", "close": 18}], "asset_currency": "USD", "exchange_rates": []},
            ],
        ))
        self.assertEqual(result["mode"], "PORTFOLIO_SCENARIO")
        self.assertEqual(result["details"]["asset_count"], 2)
        self.assertEqual(result["financials"]["gross_value"], 1080)
        self.assertEqual(result["financials"]["net_profit"], 80)

    def test_weekly_recurring_growth_uses_each_trade_date_price_and_amount(self):
        result = simulate_recurring(self.base(
            mode="RECURRING_INVESTMENT", initial_amount=100, start_date="2024-12-25", end_date="2025-01-08",
            contribution_frequency="WEEKLY", contribution_growth_rate=.10,
            price_history=[
                {"date": "2024-12-25", "close": 10},
                {"date": "2025-01-01", "close": 10},
                {"date": "2025-01-08", "close": 10},
            ],
        ))
        self.assertEqual([row["amount"] for row in result["contributions"]], [100, 110, 110])
        self.assertEqual([row["shares"] for row in result["contributions"]], [10, 11, 11])
        self.assertEqual(result["financials"]["initial_investment"], 320)
        self.assertEqual(result["financials"]["net_value"], 320)


if __name__ == "__main__":
    unittest.main()
