import { NavLink } from 'react-router-dom';

const links = [
  ['/finance', 'Budgets, expenses & goals'],
  ['/finance/transactions', 'Transactions'],
] as const;

export default function FinanceNav() {
  return <nav className="subnav" aria-label="Personal finance">{links.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</nav>;
}
