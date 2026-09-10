// src/routes/AppRoutes.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from '../pages/DashboardPage';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import VerifyEmailPage from '../pages/auth/VerifyEmailPage';
import MarketsPage from '../pages/MarketsPage';
import StockDetailPage from '../pages/StockDetailPage';
import ScreenerPage from '../pages/ScreenerPage';
import WatchlistPage from '../pages/WatchlistPage';
import PortfolioListPage from '../pages/PortfolioListPage';
import PortfolioDetailPage from '../pages/PortfolioDetailPage';
import LabIndexPage from '../pages/lab/LabIndexPage';
import SingleInvestmentPage from '../pages/lab/SingleInvestmentPage';
import RecurringInvestmentPage from '../pages/lab/RecurringInvestmentPage';
import PortfolioScenarioPage from '../pages/lab/PortfolioScenarioPage';
import CompareScenariosPage from '../pages/lab/CompareScenariosPage';
import LabBacktestPage from '../pages/lab/LabBacktestPage';
import FinanceExpensesPage from '../pages/finance/ExpensesPage';
import FinanceBudgetsPage from '../pages/finance/BudgetsPage';
import FinanceSavingsPage from '../pages/finance/SavingsPage';
import FinanceGoalsPage from '../pages/finance/GoalsPage';
import InsightsPage from '../pages/InsightsPage';
import BacktestingPage from '../pages/BacktestingPage';
import SettingsPage from '../pages/SettingsPage';
import ReportsPage from '../pages/ReportsPage';
import { useAuth } from '../hooks/useAuth';

// Guard component for protected routes
const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/markets" element={<MarketsPage />} />
      <Route path="/markets/:symbol" element={<StockDetailPage />} />
      <Route path="/screener" element={<ScreenerPage />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/watchlist/*"
        element={
          <RequireAuth>
            <WatchlistPage />
          </RequireAuth>
        }
      />
      <Route
        path="/portfolios"
        element={
          <RequireAuth>
            <PortfolioListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/portfolios/:id"
        element={
          <RequireAuth>
            <PortfolioDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/lab/*"
        element={
          <RequireAuth>
            <LabIndexPage />
          </RequireAuth>
        }
      />
      <Route path="/lab/single-investment" element={<RequireAuth><SingleInvestmentPage /></RequireAuth>} />
      <Route path="/lab/recurring-investment" element={<RequireAuth><RecurringInvestmentPage /></RequireAuth>} />
      <Route path="/lab/portfolio-scenario" element={<RequireAuth><PortfolioScenarioPage /></RequireAuth>} />
      <Route path="/lab/compare" element={<RequireAuth><CompareScenariosPage /></RequireAuth>} />
      <Route path="/lab/backtest" element={<RequireAuth><LabBacktestPage /></RequireAuth>} />
      <Route path="/finance/expenses" element={<RequireAuth><FinanceExpensesPage /></RequireAuth>} />
      <Route path="/finance/budgets" element={<RequireAuth><FinanceBudgetsPage /></RequireAuth>} />
      <Route path="/finance/savings" element={<RequireAuth><FinanceSavingsPage /></RequireAuth>} />
      <Route path="/finance/goals" element={<RequireAuth><FinanceGoalsPage /></RequireAuth>} />
      <Route path="/insights" element={<RequireAuth><InsightsPage /></RequireAuth>} />
      <Route path="/backtesting" element={<RequireAuth><BacktestingPage /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      <Route path="/reports" element={<RequireAuth><ReportsPage /></RequireAuth>} />
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};


