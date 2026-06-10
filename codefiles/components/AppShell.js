'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import TopHeader from '@/components/TopHeader';

export default function AppShell({ children, user }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Persist collapse state across page loads
  useEffect(() => {
    const saved = localStorage.getItem('oms-sidebar');
    if (saved === 'closed') setSidebarOpen(false);
  }, []);

  function toggleSidebar() {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    localStorage.setItem('oms-sidebar', next ? 'open' : 'closed');
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      {sidebarOpen && <Sidebar />}

      {/* Single toggle tab — always fixed at the sidebar boundary */}
      <button
        className="sidebar-toggle-tab no-print"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        style={{ left: sidebarOpen ? 'var(--sidebar-width)' : '0' }}
      >
        {sidebarOpen ? '‹' : '›'}
      </button>

      {/* Main area — stretches when sidebar is hidden */}
      <main
        className="app-main"
        style={{ marginLeft: sidebarOpen ? 'var(--sidebar-width)' : '0' }}
      >
        <TopHeader user={user} />
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
