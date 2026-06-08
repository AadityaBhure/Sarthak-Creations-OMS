'use client';

import { useState, useEffect } from 'react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AlertModal from '@/components/ui/AlertModal';
import { createBrowserClient } from '@/lib/supabaseClient';
import { useGlobalSettings } from '@/components/SettingsProvider';

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

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Lookup maps for deleted orders to show their names
  const [masterMaps, setMasterMaps] = useState({ clients: {}, productNames: {}, productTypes: {} });

  const [confirm, setConfirm] = useState({ isOpen: false, action: null, id: null, title: '', message: '', btnText: '', color: 'danger' });
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });

  const { settings } = useGlobalSettings();
  const BULK_LIMIT = 200;

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [lastCheckedIndex, setLastCheckedIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const selectedCount = selectedIds.size;

  function showAlert(title, message) {
    setAlertInfo({ isOpen: true, title, message });
  }

  // Load masters lookup on mount
  useEffect(() => {
    async function loadMasterDict() {
      try {
        const [cA, cD, pnA, pnD, ptA, ptD] = await Promise.all([
          fetch('/api/clients').then(r=>r.json()), fetch('/api/trash/deleted_clients').then(r=>r.json()),
          fetch('/api/product-names').then(r=>r.json()), fetch('/api/trash/deleted_product_names').then(r=>r.json()),
          fetch('/api/product-types').then(r=>r.json()), fetch('/api/trash/deleted_product_types').then(r=>r.json())
        ]);
        
        const dict = { clients: {}, productNames: {}, productTypes: {} };
        [...cA, ...cD].forEach(x => { if(x.id && x.name) dict.clients[x.id] = x.name });
        [...pnA, ...pnD].forEach(x => { if(x.id && x.name) dict.productNames[x.id] = x.name });
        [...ptA, ...ptD].forEach(x => { if(x.id && x.name) dict.productTypes[x.id] = x.name });
        
        setMasterMaps(dict);
      } catch (err) {
        console.error("Failed to load master maps", err);
      }
    }
    loadMasterDict();
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
    setLastCheckedIndex(null);
    fetchDeletedRecords(activeTab, true);

    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`realtime-${activeTab}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: activeTab }, () => {
        fetchDeletedRecords(activeTab, false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  async function fetchDeletedRecords(table, showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      const res = await fetch(`/api/trash/${table}`);
      if (!res.ok) throw new Error('Failed to fetch deleted records');
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      setError(err.message);
    } finally {
      if (showLoader) setLoading(false);
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
        showAlert('Error', err.message);
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
        showAlert('Error', err.message);
      }
    } else if (action === 'bulk-restore') {
      await handleBulkAction('restore');
    } else if (action === 'bulk-delete') {
      await handleBulkAction('delete');
    }
  }

  function toggleSelection(e, id, index) {
    const isChecked = e.target.checked;
    const newSelected = new Set(selectedIds);

    if (e.nativeEvent.shiftKey && lastCheckedIndex !== null) {
      const start = Math.min(index, lastCheckedIndex);
      const end = Math.max(index, lastCheckedIndex);
      for (let i = start; i <= end; i++) {
        if (isChecked) newSelected.add(records[i].id);
        else newSelected.delete(records[i].id);
      }
    } else {
      if (isChecked) newSelected.add(id);
      else newSelected.delete(id);
    }
    setSelectedIds(newSelected);
    setLastCheckedIndex(index);
  }

  function toggleAll(e) {
    if (e.target.checked) {
      setSelectedIds(new Set(records.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
    setLastCheckedIndex(null);
  }

  async function handleBulkAction(action) {
    if (selectedCount === 0) return;
    if (selectedCount > BULK_LIMIT) {
      showAlert('Limit Exceeded', `You can only bulk ${action} up to ${BULK_LIMIT} records at a time for performance reasons. You have selected ${selectedCount}.`);
      return;
    }
    setConfirm({ ...confirm, isOpen: false });
    setSaving(true);
    
    try {
      const res = await fetch(`/api/trash/${activeTab}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} selected records`);

      if (data.warning) showAlert('Partial Success', data.warning);
      
      await fetchDeletedRecords(activeTab, false);
      setSelectedIds(new Set());
      setLastCheckedIndex(null);
    } catch (err) {
      showAlert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  function getDaysLeft(deletedAt) {
    const deletedDate = new Date(deletedAt);
    const retentionDays = settings?.recycle_retention_days || 10;
    const purgeDate = new Date(deletedDate.getTime() + retentionDays * 24 * 60 * 60 * 1000);
    const today = new Date();
    const diffTime = purgeDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Purging today';
    if (diffDays === 1) return '1 day left';
    return `${diffDays} days left`;
  }

  function renderTableHeaders() {
    if (activeTab === 'deleted_orders') {
      return (
        <tr>
          <th style={{ width: '40px' }}>
            <input type="checkbox" onChange={toggleAll} checked={records.length > 0 && selectedIds.size === records.length} />
          </th>
          <th style={{ width: '40px' }}>Sr.</th>
          <th style={{ width: '90px' }}>DDE</th>
          <th style={{ width: '100px' }}>PO Number</th>
          <th style={{ width: '140px' }}>Client</th>
          <th style={{ width: '120px' }}>Product Name</th>
          <th style={{ width: '120px' }}>Product Type</th>
          <th style={{ width: '60px' }}>Qty</th>
          <th style={{ width: '130px' }}>Status</th>
          <th>Remark</th>
          <th style={{ width: '140px' }}>Date Deleted</th>
          <th style={{ width: '100px' }}>Auto-Purge</th>
          <th style={{ width: '140px' }}>Actions</th>
        </tr>
      );
    }
    return (
      <tr>
        <th style={{ width: '40px' }}>
          <input type="checkbox" onChange={toggleAll} checked={records.length > 0 && selectedIds.size === records.length} />
        </th>
        <th style={{ width: '5%' }}>Sr. No.</th>
        <th style={{ width: '35%' }}>Record Data</th>
        <th style={{ width: '25%' }}>Date Deleted</th>
        <th style={{ width: '15%' }}>Auto-Purge In</th>
        <th style={{ width: '20%' }}>Actions</th>
      </tr>
    );
  }

  function renderTableContent() {
    const colCount = activeTab === 'deleted_orders' ? 13 : 6;

    if (loading) {
      return (
        <tr>
          <td colSpan={colCount} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
            Loading records...
          </td>
        </tr>
      );
    }

    if (records.length === 0) {
      return (
        <tr>
          <td colSpan={colCount} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
            Recycle Bin is empty for this category.
          </td>
        </tr>
      );
    }

    const paginatedRecords = records.slice((page - 1) * limit, page * limit);

    return paginatedRecords.map((record, index) => {
      const globalIndex = (page - 1) * limit + index;
      return (
      <tr key={record.id} className={selectedIds.has(record.id) ? 'row-selected' : ''}>
        <td className="checkbox-col">
          <input type="checkbox" checked={selectedIds.has(record.id)} onChange={(e) => toggleSelection(e, record.id, globalIndex)} />
        </td>
        <td style={{ color: 'var(--text-secondary)' }}>{globalIndex + 1}</td>
        
        {activeTab === 'deleted_orders' ? (
          <>
            <td>{new Date(record.date_of_entry).toLocaleDateString()}</td>
            <td><strong>{record.po_number}</strong></td>
            <td>{masterMaps.clients[record.client_id] || 'Unknown'}</td>
            <td>{masterMaps.productNames[record.product_name_id] || 'Unknown'}</td>
            <td>{masterMaps.productTypes[record.product_type_id] || 'Unknown'}</td>
            <td>{record.quantity}</td>
            <td>
              <span className={`status-badge status-${(record.status || '').replace(/\s+/g, '-').toLowerCase()}`}>
                {record.status}
              </span>
            </td>
            <td>{record.remark}</td>
          </>
        ) : (
          <td>
            <strong>{record.name}</strong>
          </td>
        )}

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
              Delete
            </button>
          </div>
        </td>
      </tr>
      );
    });
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

      {/* Pagination Bar (Moved to Top) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '12px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px' }}>Rows per page:</span>
          <select className="form-input" style={{ padding: '4px 8px', fontSize: '13px', width: 'auto' }} value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px' }}>Showing {records.length === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, records.length)} of {records.length}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn btn-secondary btn-sm" disabled={page * limit >= records.length} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </div>

      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: activeTab === 'deleted_orders' ? '1400px' : '100%' }}>
          <thead>
            {renderTableHeaders()}
          </thead>
          <tbody>
            {renderTableContent()}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar (Bottom) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '12px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px' }}>Rows per page:</span>
          <select className="form-input" style={{ padding: '4px 8px', fontSize: '13px', width: 'auto' }} value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px' }}>Showing {records.length === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, records.length)} of {records.length}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn btn-secondary btn-sm" disabled={page * limit >= records.length} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
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

      <AlertModal
        isOpen={alertInfo.isOpen}
        title={alertInfo.title}
        message={alertInfo.message}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
      />
      
      {/* Floating Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="floating-save no-print" style={{ gap: '12px', flexWrap: 'wrap' }}>
          {selectedCount > 200 ? (
            <span style={{ color: 'var(--status-red-text)', fontSize: '14px', fontWeight: 600 }}>Maximum 200 allowed ({selectedCount} selected). Please deselect some.</span>
          ) : (
            <span style={{ fontSize: '14px', fontWeight: 600 }}>{selectedCount} selected</span>
          )}
          
          {selectedCount > BULK_LIMIT && (
            <span style={{ fontSize: '13px', color: 'var(--status-red-text)' }}>
              (Bulk limit is {BULK_LIMIT}. Please unselect some.)
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setConfirm({ isOpen: true, action: 'bulk-restore', title: 'Bulk Restore', message: `Are you sure you want to restore ${selectedCount} selected records?`, btnText: 'Restore All', color: 'primary' })} disabled={saving || selectedCount > BULK_LIMIT}>
            Restore Selected
          </button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--btn-danger-bg)' }} onClick={() => setConfirm({ isOpen: true, action: 'bulk-delete', title: 'Permanent Bulk Delete', message: `WARNING: This will permanently delete ${selectedCount} selected records forever. Are you sure?`, btnText: 'Delete All Forever', color: 'danger' })} disabled={saving || selectedCount > BULK_LIMIT}>
            Delete Selected Forever
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedIds(new Set()); setLastCheckedIndex(null); }}>Clear</button>
        </div>
      )}
    </div>
  );
}
