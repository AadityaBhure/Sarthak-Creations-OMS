'use client';

import { useState, useEffect } from 'react';
import ConfirmModal from '@/components/ui/ConfirmModal';

const TABS = [
  { id: 'deleted_clients', label: 'Clients' },
  { id: 'deleted_product_names', label: 'Product Names' },
  { id: 'deleted_product_types', label: 'Product Types' },
  { id: 'deleted_orders', label: 'Orders' },
];

export default function RecycleBin() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [confirm, setConfirm] = useState({ isOpen: false, action: null, id: null, title: '', message: '', btnText: '', color: 'danger' });

  useEffect(() => {
    fetchDeletedRecords(activeTab);
  }, [activeTab]);

  async function fetchDeletedRecords(table) {
    try {
      setLoading(true);
      const res = await fetch(`/api/trash/${table}`);
      if (!res.ok) throw new Error('Failed to fetch deleted records');
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function promptRestore(id) {
    setConfirm({
      isOpen: true,
      action: 'restore',
      id,
      title: 'Restore Record',
      message: 'Are you sure you want to restore this record back to active?',
      btnText: 'Restore',
      color: 'primary'
    });
  }

  function promptPermanentDelete(id) {
    setConfirm({
      isOpen: true,
      action: 'delete',
      id,
      title: 'Permanent Delete',
      message: 'WARNING: This will permanently delete this record forever. Are you sure?',
      btnText: 'Delete Forever',
      color: 'danger'
    });
  }

  async function handleConfirm() {
    const { action, id } = confirm;
    setConfirm({ ...confirm, isOpen: false });

    if (action === 'restore') {
      try {
        const res = await fetch(`/api/trash/${activeTab}/restore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to restore');

        setRecords((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        alert(err.message);
      }
    } else if (action === 'delete') {
      try {
        const res = await fetch(`/api/trash/${activeTab}?id=${id}`, {
          method: 'DELETE',
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete');

        setRecords((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        alert(err.message);
      }
    }
  }

  // Calculate days left before auto-purge
  function getDaysLeft(deletedAt) {
    const deletedDate = new Date(deletedAt);
    const purgeDate = new Date(deletedDate.getTime() + 10 * 24 * 60 * 60 * 1000);
    const today = new Date();
    const diffTime = purgeDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Purging today';
    if (diffDays === 1) return '1 day left';
    return `${diffDays} days left`;
  }

  function renderTableContent() {
    if (loading) {
      return (
        <tr>
          <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
            Loading records...
          </td>
        </tr>
      );
    }

    if (records.length === 0) {
      return (
        <tr>
          <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
            Recycle Bin is empty for this category.
          </td>
        </tr>
      );
    }

    return records.map((record, index) => (
      <tr key={record.id}>
        <td style={{ color: 'var(--text-secondary)' }}>{index + 1}</td>
        <td>
          {activeTab === 'deleted_orders' ? (
            `PO: ${record.po_number} (Qty: ${record.quantity})`
          ) : (
            <strong>{record.name}</strong>
          )}
        </td>
        <td>{new Date(record.deleted_at).toLocaleString()}</td>
        <td style={{ color: 'var(--status-amber-text)' }}>
          {getDaysLeft(record.deleted_at)}
        </td>
        <td>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => promptRestore(record.id)}>
              Restore
            </button>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-red-text)' }} onClick={() => promptPermanentDelete(record.id)}>
              Delete Forever
            </button>
          </div>
        </td>
      </tr>
    ));
  }

  return (
    <div className="masters-page">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>Recycle Bin</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Records here are kept for 10 days before being permanently purged automatically by the database.
        </p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px',
              borderBottom: activeTab === tab.id ? '2px solid var(--text-main)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text-main)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? '500' : '400',
              cursor: 'pointer',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="form-error" style={{ marginBottom: '12px' }}>{error}</div>}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>Sr. No.</th>
              <th style={{ width: '35%' }}>Record Data</th>
              <th style={{ width: '25%' }}>Date Deleted</th>
              <th style={{ width: '15%' }}>Auto-Purge In</th>
              <th style={{ width: '20%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {renderTableContent()}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={confirm.isOpen}
        title={confirm.title}
        message={confirm.message}
        confirmText={confirm.btnText}
        confirmColor={confirm.color}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm({ ...confirm, isOpen: false })}
      />
    </div>
  );
}
