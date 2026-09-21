// src/routes/AppRoutes.tsx
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AppLayout from '../layout/AppLayout';

const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('../pages/auth/VerifyEmailPage'));
const MarketsPage = lazy(() => import('../pages/MarketsPage'));
const StockDetailPage = lazy(() => import('../pages/StockDetailPage'));
const ScreenerPage = lazy(() => import('../pages/ScreenerPage'));
const WatchlistPage = lazy(() => import('../pages/WatchlistPage'));
const PortfolioListPage = lazy(() => import('../pages/PortfolioListPage'));
const PortfolioDetailPage = lazy(() => import('../pages/PortfolioDetailPage'));
const PortfolioComparePage = lazy(() => import('../pages/PortfolioComparePage'));
const PlanningPage = lazy(() => import('../pages/PlanningPage'));
const LabIndexPage = lazy(() => import('../pages/lab/LabIndexPage'));
const SingleInvestmentPage = lazy(() => import('../pages/lab/SingleInvestmentPage'));
const RecurringInvestmentPage = lazy(() => import('../pages/lab/RecurringInvestmentPage'));
const PortfolioScenarioPage = lazy(() => import('../pages/lab/PortfolioScenarioPage'));
const CompareScenariosPage = lazy(() => import('../pages/lab/CompareScenariosPage'));
const LabBacktestPage = lazy(() => import('../pages/lab/LabBacktestPage'));
const FinanceExpensesPage = lazy(() => import('../pages/finance/ExpensesPage'));
const FinanceTransactionsPage = lazy(() => import('../pages/finance/TransactionsPage'));
const FinanceBudgetsPage = lazy(() => import('../pages/finance/BudgetsPage'));
const FinanceSavingsPage = lazy(() => import('../pages/finance/SavingsPage'));
const FinanceGoalsPage = lazy(() => import('../pages/finance/GoalsPage'));
const InsightsPage = lazy(() => import('../pages/InsightsPage'));
const BacktestingPage = lazy(() => import('../pages/BacktestingPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));

// Guard component for protected routes
const RequireAuth: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center" role="status">Loading FinSight…</div>}><Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      {/* Public research pages and protected tools share the same visual shell. */}
      <Route element={<AppLayout />}>
        <Route path="/markets" element={<MarketsPage />} />
        <Route path="/markets/:symbol" element={<StockDetailPage />} />
        <Route path="/screener" element={<ScreenerPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/portfolios" element={<PortfolioListPage />} />
          <Route path="/portfolios/compare" element={<PortfolioComparePage />} />
          <Route path="/portfolios/:id" element={<PortfolioDetailPage />} />
          <Route path="/planning" element={<PlanningPage />} />
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
      </Route>
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes></Suspense>
  );
};

export default AppRoutes;
