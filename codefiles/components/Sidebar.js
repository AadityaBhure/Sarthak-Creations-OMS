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
    label: 'Orders',
    links: [
      { href: '/orders', label: 'Active Orders' },
      { href: '/orders/completed', label: 'Completed Orders' },
      { href: '/orders/new', label: 'New Order' },
    ],
  },
  {
    label: 'Masters',
    links: [
      { href: '/masters/executives', label: 'Executive List' },
      { href: '/masters/clients', label: 'Client List' },
      { href: '/masters/product-names', label: 'Product Names' },
      { href: '/masters/product-types', label: 'Product Types' },
      { href: '/masters/deleted', label: 'Deleted Records' },
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
            <div className="sidebar-section-label">{section.label}</div>
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
