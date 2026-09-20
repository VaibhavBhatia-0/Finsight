import { useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout({ children }: { children?: ReactNode }) {
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <div className="finsight-shell">
      <div className="ambient-track" aria-hidden="true" />
      {navigationOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setNavigationOpen(false)} />}
      <aside className={`app-rail${navigationOpen ? ' mobile-open' : ''}`}>
        <Sidebar onNavigate={() => setNavigationOpen(false)} />
      </aside>
      <div className="app-stage">
        <TopBar onMenu={() => setNavigationOpen(true)} />
        <div className="app-content">{children ?? <Outlet />}</div>
      </div>
    </div>
  );
}
