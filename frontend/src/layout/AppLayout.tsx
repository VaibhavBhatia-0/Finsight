import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import AppHeader from './AppHeader';

export default function AppLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="finsight-shell">
      <AppHeader />
      <div className="app-content">{children ?? <Outlet />}</div>
    </div>
  );
}
