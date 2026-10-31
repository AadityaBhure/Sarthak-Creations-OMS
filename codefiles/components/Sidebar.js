'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    links: [
      { href: '/dashboard', label: 'Dashboard' },
    ],
  },
  {
    label: 'Client Progress Tracking',
    groups: [
      {
        id: 'client-orders', label: 'Orders',
        links: [
          { href: '/orders/new', label: 'New Order' },
          { href: '/orders', label: 'Order List' },
          { href: '/orders/completed', label: 'Completed Orders' },
        ],
      },
      {
        id: 'client-masters', label: 'Masters',
        links: [
          { href: '/masters/executives', label: 'Executive List' },
          { href: '/masters/clients', label: 'Client List' },
          { href: '/masters/product-names', label: 'Product Lists' },
          { href: '/masters/product-types', label: 'Product Types' },
        ],
      },
    ],
    links: [
      { href: '/masters/deleted', label: 'Deleted Records' },
    ],
  },
  {
    label: 'Vendor Job Tracking',
    groups: [
      {
        id: 'vendor-jobs', label: 'Jobs',
        links: [
          { href: '/vendor-jobs/new', label: 'New Job Card' },
          { href: '/vendor-jobs/active', label: 'Active Jobs' },
          { href: '/vendor-jobs/completed', label: 'Completed Jobs' },
          { href: '/vendor-jobs/canceled', label: 'Canceled Jobs' },
          { href: '/vendor-jobs/ledger', label: 'Vendor-wise Ledger' },
        ],
      },
      {
        id: 'vendor-masters', label: 'Masters',
        links: [
          { href: '/vendor-jobs/masters/vendors', label: 'Vendors' },
          { href: '/vendor-jobs/masters/jobs', label: 'Job Types' },
          { href: '/vendor-jobs/masters/papers', label: 'Paper Types' },
        ],
      },
    ],
    links: [
      { href: '/vendor-jobs/deleted', label: 'Deleted Records' },
    ],
  },
  {
    label: 'Quick Views',
    links: [
      { href: '/quick-views', label: 'Manage Views' },
    ],
  },
  {
    label: 'Config',
    links: [
      { href: '/settings', label: 'Settings' },
      { href: '/help-desk', label: 'Help Desk' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState('light');
  const [expandedGroups, setExpandedGroups] = useState({
    'client-orders': true,
    'client-masters': true,
    'vendor-jobs': true,
    'vendor-masters': true,
  });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('oms-sidebar-groups') || '{}');
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
      setExpandedGroups(current => Object.fromEntries(
        Object.entries(current).map(([id, expanded]) => [id, typeof saved[id] === 'boolean' ? saved[id] : expanded]),
      ));
    } catch {
      // Keep the default groups usable if browser storage is unavailable or invalid.
    }
  }, []);

  function toggleGroup(id) {
    const next = { ...expandedGroups, [id]: !expandedGroups[id] };
    setExpandedGroups(next);
    try {
      localStorage.setItem('oms-sidebar-groups', JSON.stringify(next));
    } catch {
      // The toggle still works for this session when storage is unavailable.
    }
  }

  // Load saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('oms-theme') || 'light';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('oms-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  // Determine if a link is active.
  // /orders is active only when exactly on /orders (not /orders/completed or /orders/new)
  function isActive(href) {
    if (href === '/orders') {
      return pathname === '/orders';
    }
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <img
          src="/companyLogo.jpg"
          alt="Sarthak Creations"
          width={179}
          height={90}
          style={{ width: '100%', maxWidth: '179px', height: 'auto', display: 'block' }}
        />
        <div className="sidebar-logo-sub" style={{ marginTop: '6px' }}>Order Management System</div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className={`sidebar-section-label${section.groups ? ' sidebar-module-label' : ''}`}>{section.label}</div>
            {section.groups?.map(group => (
              <div key={group.id}>
                <button
                  type="button"
                  className={`sidebar-link sidebar-group-toggle${group.links.some(link => isActive(link.href)) ? ' sidebar-group-current' : ''}`}
                  aria-expanded={expandedGroups[group.id]}
                  aria-controls={`${group.id}-links`}
                  onClick={() => toggleGroup(group.id)}
                >
                  {group.label}
                  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" className={expandedGroups[group.id] ? 'sidebar-group-chevron expanded' : 'sidebar-group-chevron'}>
                    <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div id={`${group.id}-links`} className="sidebar-group-links" hidden={!expandedGroups[group.id]}>
                  {group.links.map(link => (
                    <Link key={link.href} href={link.href} aria-current={isActive(link.href) ? 'page' : undefined} className={`sidebar-link sidebar-group-link${isActive(link.href) ? ' active' : ''}`}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            {section.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`sidebar-link${isActive(link.href) ? ' active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer: theme toggle + logout */}
      <div className="sidebar-footer">
        <button
          id="theme-toggle"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label="Toggle light/dark mode"
        >
          {theme === 'light' ? '☾ Dark Mode' : '☀ Light Mode'}
        </button>
        <button
          id="logout-btn"
          className="logout-btn"
          onClick={handleLogout}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
