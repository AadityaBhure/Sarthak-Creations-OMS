'use client';

import { usePathname } from 'next/navigation';

// Route → Page Title mapping (covers all phases)
const PAGE_TITLES = {
  '/dashboard':              'Dashboard',
  '/orders':                 'Active Orders',
  '/orders/completed':       'Completed Orders',
  '/orders/new':             'New Order',
  '/masters/clients':        'Client List',
  '/masters/product-names':  'Product Names',
  '/masters/product-types':  'Product Types',
  '/masters/deleted':        'Deleted Records',
  '/settings':               'Settings',
  '/help-desk':              'Help Desk',
};

function getTitle(pathname) {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Fallback: strip leading slash, capitalise
  const segment = pathname.split('/').filter(Boolean).pop() || 'Page';
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
}

export default function TopHeader({ user }) {
  const pathname = usePathname();
  const title = getTitle(pathname);

  // Fallback for older admin logins or tokens without names
  const displayName = user ? (user.firstName ? `${user.firstName} ${user.lastName}` : (user.username || 'Administrator')) : '';

  return (
    <header className="top-header" style={{ justifyContent: 'space-between' }}>
      <span className="top-header-title">{title}</span>
      {displayName && (
        <div className="top-header-user" style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
          {displayName}
        </div>
      )}
    </header>
  );
}
