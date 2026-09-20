import { NavLink } from 'react-router-dom';

const links = [
  ['/finance/transactions', 'Transactions'],
  ['/finance/expenses', 'Expenses'],
  ['/finance/budgets', 'Budgets'],
  ['/finance/savings', 'Savings'],
  ['/finance/goals', 'Goals'],
] as const;

export default function FinanceNav() {
  return <nav className="subnav" aria-label="Personal finance"><>{links.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</></nav>;
}
