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

  // 4. Count Deleted Records (Recycle Bin)
  const { count: deletedCount } = await supabase.from('deleted_orders').select('*', { count: 'exact', head: true });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <style>{`
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

      {/* SECTION 1: Status Metrics & Overdue Alerts */}
      <section>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>Order Status & Alerts</h2>
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
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>Master Records</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          <div className="dash-card">
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>Registered Clients</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1 }}>{clientsCount || 0}</div>
          </div>
          <div className="dash-card">
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>Registered Product Names</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1 }}>{productsCount || 0}</div>
          </div>
          <div className="dash-card">
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>Registered Product Types</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1 }}>{typesCount || 0}</div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Recycle Bin Metrics */}
      <section>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>Recycle Bin</h2>
        <Link href="/deleted-orders" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="dash-card clickable" style={{ maxWidth: '300px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>Deleted Records Held</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1 }}>{deletedCount || 0}</div>
          </div>
        </Link>
      </section>

    </div>
  );
}
