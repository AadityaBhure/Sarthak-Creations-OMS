export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabaseClient';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = createServerClient();

  // 1. Fetch Global Settings to get exactly what statuses exist
  const { data: settingsData } = await supabase.from('global_settings').select('status_options').single();
  const allStatuses = settingsData?.status_options || [];

  // 2. Fetch all active orders (status != Completed)
  const { data: activeOrders } = await supabase
    .from('orders')
    .select('status, target_date')
    .neq('status', 'Completed');

  // Count active orders by status and calculate overdue
  const statusCounts = {};
  allStatuses.forEach(s => { 
    const sName = typeof s === 'string' ? s : s.name;
    statusCounts[sName] = 0; 
  });
  
  let overdueCount = 0;
  const todayStr = new Date().toISOString().split('T')[0];

  (activeOrders || []).forEach(o => {
    if (o.status && statusCounts[o.status] !== undefined) {
      statusCounts[o.status]++;
    } else if (o.status) {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }
    
    // Check if overdue
    if (o.target_date && o.target_date < todayStr) {
      overdueCount++;
    }
  });

  const { count: completedCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Completed');
  if (statusCounts['Completed'] !== undefined) {
    statusCounts['Completed'] = completedCount || 0;
  }

  // 3. Count Master Records
  const { count: clientsCount } = await supabase.from('clients').select('*', { count: 'exact', head: true });
  const { count: productsCount } = await supabase.from('product_names').select('*', { count: 'exact', head: true });
  const { count: typesCount } = await supabase.from('product_types').select('*', { count: 'exact', head: true });


  // Exact counts avoid the API row limit; recycled jobs and masters are excluded.
  const vendorMetrics = [
    { label: 'Active Jobs', table: 'vjt_job_cards', statuses: ['Active'], href: '/vendor-jobs/active?filter_status=Active', color: '#3b82f6' },
    { label: 'On Hold', table: 'vjt_job_cards', statuses: ['Hold'], href: '/vendor-jobs/active?filter_status=Hold', color: '#d97706' },
    { label: 'Completed Jobs', table: 'vjt_job_cards', statuses: ['Completed'], href: '/vendor-jobs/completed', color: '#16a34a' },
    { label: 'Canceled Jobs', table: 'vjt_job_cards', statuses: ['Canceled'], href: '/vendor-jobs/canceled', color: '#ef4444' },
    { label: 'Vendors', table: 'vjt_vendors', href: '/vendor-jobs/masters/vendors' },
    { label: 'Job Types', table: 'vjt_job_types', href: '/vendor-jobs/masters/jobs' },
    { label: 'Paper Types', table: 'vjt_paper_types', href: '/vendor-jobs/masters/papers' },
  ];
  const vendorResults = await Promise.all(vendorMetrics.map(async metric => {
    try {
      let query = supabase.from(metric.table).select('*', { count: 'exact', head: true }).is('deleted_at', null);
      if (metric.statuses) query = query.in('status', metric.statuses);
      const { count, error } = await query;
      return { ...metric, count: error ? null : count };
    } catch {
      return { ...metric, count: null };
    }
  }));


  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <style>{`
        .dash-module {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: clamp(16px, 3vw, 28px);
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .dash-module-client { background-color: #f0f5fc; }
        .dash-module-vendor { background-color: #f7f3ec; }
        [data-theme='dark'] .dash-module-client { background-color: #1b2430; }
        [data-theme='dark'] .dash-module-vendor { background-color: #29251f; }
        .dash-module-heading {
          color: var(--btn-danger-bg, #ef4444);
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 6px;
        }
        .dash-module-description {
          color: var(--text-secondary);
          font-size: 14px;
          margin: 0;
        }
        .dash-card {
          background-color: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .dash-card.clickable {
          cursor: pointer;
          transition: background-color 0.2s, border-color 0.2s;
        }
        .dash-card.clickable:hover {
          background-color: var(--bg-surface-hover, #f9fafb);
          border-color: #d1d5db;
        }
        :root[data-theme='dark'] .dash-card.clickable:hover {
          background-color: #27272a;
          border-color: #52525b;
        }
      `}</style>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Dashboard</h1>
      </div>

      <section className="dash-module dash-module-client" aria-labelledby="client-dashboard-heading">
        <header>
          <h2 id="client-dashboard-heading" className="dash-module-heading">Client Progress Tracking</h2>
          <p className="dash-module-description">Customer orders, delivery alerts and client master records.</p>
        </header>
      {/* SECTION 1: Status Metrics & Overdue Alerts */}
      <section>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>Order Status & Alerts</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Overdue Alerts Card */}
          <Link href="/orders" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="dash-card clickable" style={{ borderTop: `4px solid var(--btn-danger-bg, #ef4444)`, backgroundColor: overdueCount > 0 ? '#fef2f2' : undefined }}>
              <div style={{ fontSize: '14px', color: overdueCount > 0 ? '#991b1b' : 'var(--text-secondary)', fontWeight: '600' }}>⚠️ Overdue Orders</div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: overdueCount > 0 ? '#7f1d1d' : 'var(--text-primary)', lineHeight: 1 }}>{overdueCount}</div>
            </div>
          </Link>
          {Object.entries(statusCounts).map(([status, count]) => {
            const isCompleted = status === 'Completed';
            const href = isCompleted ? '/orders/completed' : `/orders?filter_status=${encodeURIComponent(status)}`;
            
            const opt = allStatuses.find(s => (typeof s === 'string' ? s : s.name) === status);
            const topColor = opt && typeof opt !== 'string' && opt.bg ? opt.bg : 'transparent';
            
            return (
              <Link key={status} href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="dash-card clickable" style={{ borderTop: topColor !== 'transparent' ? `4px solid ${topColor}` : undefined }}>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>{status}</div>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }}>{count}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: Master Records Metrics */}
      <section>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>Master Records</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          <div className="dash-card">
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>Registered Clients</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1 }}>{clientsCount || 0}</div>
          </div>
          <div className="dash-card">
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>Registered Product Lists</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1 }}>{productsCount || 0}</div>
          </div>
          <div className="dash-card">
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>Registered Product Types</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1 }}>{typesCount || 0}</div>
          </div>
        </div>
      </section>
      </section>

      <section className="dash-module dash-module-vendor" aria-labelledby="vendor-dashboard-heading">
        <header>
          <h2 id="vendor-dashboard-heading" className="dash-module-heading">Vendor Job Tracking</h2>
          <p className="dash-module-description">Vendor job cards and master records. Deleted records are excluded.</p>
        </header>
        {vendorResults.some(metric => metric.count === null) && (
          <p role="alert" className="dash-module-description">Some vendor counts could not be loaded. Refresh the page to try again.</p>
        )}
        {['Job Status', 'Vendor Master Records'].map((heading, group) => (
          <section key={heading}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>{heading}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '16px' }}>
              {vendorResults.filter(metric => group === 0 ? metric.statuses : !metric.statuses).map(metric => (
                <Link key={metric.label} href={metric.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="dash-card clickable" style={{ height: '100%', boxSizing: 'border-box', borderTop: metric.color ? `4px solid ${metric.color}` : undefined }}>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>{metric.label}</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1 }}>{metric.count === null ? 'Unavailable' : metric.count}</div>
                    {metric.note && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{metric.note}</div>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </section>
    </div>
  );
}
