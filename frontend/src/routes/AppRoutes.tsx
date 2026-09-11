// src/routes/AppRoutes.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from '../pages/DashboardPage';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
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
import FinanceTransactionsPage from '../pages/finance/TransactionsPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import VerifyEmailPage from '../pages/auth/VerifyEmailPage';
import { useAuth } from '../hooks/useAuth';
import AppLayout from '../layout/AppLayout';

// Guard component for protected routes
const RequireAuth: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading…</div>;
  return user ? <AppLayout /> : <Navigate to="/login" replace />;
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

      {/* Protected routes share one authenticated application shell. */}
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/portfolios" element={<PortfolioListPage />} />
        <Route path="/portfolios/:id" element={<PortfolioDetailPage />} />
        <Route path="/lab" element={<LabIndexPage />} />
        <Route path="/lab/single-investment" element={<SingleInvestmentPage />} />
        <Route path="/lab/recurring-investment" element={<RecurringInvestmentPage />} />
        <Route path="/lab/portfolio-scenario" element={<PortfolioScenarioPage />} />
        <Route path="/lab/compare" element={<CompareScenariosPage />} />
        <Route path="/lab/backtest" element={<LabBacktestPage />} />
        <Route path="/finance/expenses" element={<FinanceExpensesPage />} />
        <Route path="/finance/transactions" element={<FinanceTransactionsPage />} />
        <Route path="/finance/budgets" element={<FinanceBudgetsPage />} />
        <Route path="/finance/savings" element={<FinanceSavingsPage />} />
        <Route path="/finance/goals" element={<FinanceGoalsPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/backtesting" element={<BacktestingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Route>
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
