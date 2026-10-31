'use client';
import { useEffect, useRef, useState } from 'react';
import { useGlobalSettings } from '@/components/SettingsProvider';
import { api, dateTime, useDialogs } from './Common';

const TABS = [['vendors', 'Vendors'], ['jobs', 'Job Types'], ['papers', 'Paper Types'], ['cards', 'Job Cards']];
const COLUMNS = {
  vendors: [['name', 'Vendor Name'], ['address', 'Address'], ['concerned_persons', 'Concerned Person(s)'], ['concerned_contacts', 'Concerned Person Contact(s)'], ['capability_names', 'Job Capabilities']],
  jobs: [['name', 'Job Type Name']],
  papers: [['name', 'Paper Type Name']],
  cards: [['serial_number', 'Count'], ['created_at', 'DDE'], ['job_card_number', 'Job Card Number'], ['job_title', 'Job Title'], ['product_type', 'Product Type'], ['paper_type', 'Paper Type'], ['quantity', 'Qty'], ['current_vendor', 'Vendor'], ['current_job', 'Job Type'], ['status', 'Status'], ['remarks', 'Remark'], ['vendor_history', 'Vendor History']],
};
const flex = { display: 'flex', gap: '8px', alignItems: 'center' };
export default function DeletedRecords({ initialTab = 'vendors' }) {
  const [activeTab, setActiveTab] = useState(TABS.some(([id]) => id === initialTab) ? initialTab : 'vendors');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const lastChecked = useRef(null);
  const requestId = useRef(0);
  const { settings } = useGlobalSettings();
  const { confirm, notify, dialogs } = useDialogs();
  const retention = settings?.recycle_retention_days ?? 10;
  const selectedCount = selectedIds.size;
  function selectTab(id) {
    requestId.current++;
    setRecords([]);
    setSelectedIds(new Set());
    setPage(1);
    setLoading(true);
    setActiveTab(id);
  }
  async function refresh() {
    const current = ++requestId.current;
    setLoading(true);
    try {
      const data = await api(`deleted?kind=${activeTab}`);
      if (current !== requestId.current) return;
      setRecords(data);
      setError('');
      setPage(p => Math.max(1, Math.min(p, Math.ceil(data.length / limit))));
      setSelectedIds(prev => new Set(data.filter(r => prev.has(r.id)).map(r => r.id)));
      lastChecked.current = null;
    } catch (e) { if (current === requestId.current) setError(e.message); }
    finally { if (current === requestId.current) setLoading(false); }
  }
  useEffect(() => {
    setRecords([]); setSelectedIds(new Set()); setPage(1); refresh();
    return () => { requestId.current++; };
  }, [activeTab]);
  useEffect(() => {
    if (saving) return;
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [activeTab, saving, limit]);
  async function action(kind, rows) {
    if (!rows.length || rows.length > 200 || saving) return;
    const restore = kind === 'restore';
    if (!(await confirm(
      restore ? `Are you sure you want to restore ${rows.length === 1 ? 'this record' : `${rows.length} selected records`}?` : `WARNING: This will permanently delete ${rows.length === 1 ? 'this record' : `${rows.length} selected records`} forever. Job Card history is deleted with its card. Referenced masters cannot be permanently deleted. Are you sure?`,
      restore ? (rows.length === 1 ? 'Restore Record' : 'Bulk Restore') : (rows.length === 1 ? 'Permanent Delete' : 'Permanent Bulk Delete'),
      restore ? (rows.length === 1 ? 'Restore' : 'Restore All') : (rows.length === 1 ? 'Delete Forever' : 'Delete All Forever'),
      restore ? 'primary' : 'danger',
    ))) return;
    setSaving(true);
    const failures = [];
    for (const row of rows) {
      const path = activeTab === 'cards' ? `cards/${row.id}` : `masters/${activeTab}/${row.id}`;
      try {
        try { await api(path, { action: kind, revision: row.revision }); }
        catch (e) {
          if (e.code !== 'DUPLICATE_NUMBER' || !(await confirm(e.message, 'Duplicate Job Card Number', 'Continue Anyway'))) throw e;
          await api(path, { action: kind, revision: row.revision, confirm_duplicate: true });
        }
      } catch (e) { failures.push(`${row.name || row.job_card_number}: ${e.message}`); }
    }
    await refresh(); setSelectedIds(new Set()); setSaving(false);
    if (failures.length) notify(failures.join('\n'));
  }
  function toggleSelection(e, index) {
    const next = new Set(selectedIds);
    const range = e.nativeEvent.shiftKey && lastChecked.current !== null;
    for (let i = range ? Math.min(index, lastChecked.current) : index; i <= (range ? Math.max(index, lastChecked.current) : index); i++) {
      if (e.target.checked) next.add(records[i].id); else next.delete(records[i].id);
    }
    setSelectedIds(next); lastChecked.current = index;
  }
  function daysLeft(row) {
    if (row.purge_blocked) return 'Protected: in use';
    const days = Math.ceil((new Date(row.deleted_at).getTime() + retention * 86400000 - Date.now()) / 86400000);
    return days <= 0 ? 'Purging today' : `${days} day${days === 1 ? '' : 's'} left`;
  }
  function pagination(bottom = false) {
    return <div style={{ ...flex, justifyContent: 'space-between', [bottom ? 'marginTop' : 'marginBottom']: '16px', padding: '12px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px' }}>
      <div style={flex}><span style={{ fontSize: '14px' }}>Rows per page:</span>
        <select aria-label={bottom ? 'Rows per page bottom' : 'Rows per page'} className="form-input" style={{ padding: '4px 8px', fontSize: '13px', width: 'auto' }} value={limit} disabled={saving} onChange={e => { setLimit(Number(e.target.value)); setPage(1); lastChecked.current = null; }}>
          {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
        </select></div>
      <div style={{ ...flex, gap: '16px' }}><span style={{ fontSize: '14px' }}>Showing {records.length ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, records.length)} of {records.length}</span>
        <div style={flex}><button className="btn btn-secondary btn-sm" disabled={saving || loading || page === 1} onClick={() => setPage(page - 1)}>Previous</button>
          <button className="btn btn-secondary btn-sm" disabled={saving || loading || page * limit >= records.length} onClick={() => setPage(page + 1)}>Next</button></div>
      </div></div>;
  }
  return <div className="masters-page">
    <div style={{ marginBottom: '24px' }}><h2 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>Recycle Bin</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Records here are kept for {retention} days before being permanently purged automatically by the database. Masters referenced by Job Cards or vendor capabilities are retained until those references are removed.</p></div>
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
      {TABS.map(([id, label]) => <button key={id} disabled={saving} onClick={() => { if (id !== activeTab) selectTab(id); }} style={{ padding: '12px 24px', borderBottom: activeTab === id ? '2px solid var(--text-main)' : '2px solid transparent', color: activeTab === id ? 'var(--text-main)' : 'var(--text-secondary)', fontWeight: activeTab === id ? '500' : '400', cursor: 'pointer', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>{label}</button>)}</div>
    {error && <div className="form-error" style={{ marginBottom: '12px' }}>{error}</div>}
    {pagination()}
    <div className="table-container" style={{ overflowX: 'auto' }}><table className="data-table" style={{ minWidth: activeTab === 'cards' ? '1400px' : '100%' }}>
      <thead><tr><th style={{ width: '40px' }}><input type="checkbox" aria-label="Select all records" disabled={saving || loading} checked={records.length > 0 && selectedCount === records.length} onChange={e => { setSelectedIds(new Set(e.target.checked ? records.map(r => r.id) : [])); lastChecked.current = null; }} /></th>
        <th style={{ width: '40px' }}>Sr. No.</th>{COLUMNS[activeTab].map(([key, title]) => <th key={key}>{title}</th>)}
        <th style={{ width: '140px' }}>Date Deleted</th><th style={{ width: '100px' }}>Auto-Purge In</th><th style={{ width: '140px' }}>Actions</th></tr></thead>
      <tbody>{loading || !records.length ? <tr><td colSpan={COLUMNS[activeTab].length + 5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>{loading ? 'Loading records...' : 'Recycle Bin is empty for this category.'}</td></tr> : records.slice((page - 1) * limit, page * limit).map((row, i) => {
        const index = (page - 1) * limit + i;
        return <tr key={row.id} className={selectedIds.has(row.id) ? 'row-selected' : ''}>
          <td className="checkbox-col"><input type="checkbox" aria-label={`Select ${row.name || row.job_card_number}`} disabled={saving} checked={selectedIds.has(row.id)} onChange={e => toggleSelection(e, index)} /></td><td style={{ color: 'var(--text-secondary)' }}>{index + 1}</td>
          {COLUMNS[activeTab].map(([key]) => <td key={key}>{key === 'name' || key === 'job_card_number' ? <strong>{row[key]}</strong> : key === 'created_at' ? new Date(row[key]).toLocaleDateString('en-GB') : key === 'status' ? <span className={`status-badge status-${row.status.toLowerCase()}`}>{row.status}</span> : row[key] || '—'}</td>)}
          <td>{dateTime(row.deleted_at)}</td><td style={{ color: 'var(--status-amber-text)' }}>{daysLeft(row)}</td>
          <td><div style={flex}><button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => action('restore', [row])}>Restore</button>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-red-text)' }} disabled={saving} onClick={() => action('purge', [row])}>Delete</button></div></td></tr>;
      })}</tbody></table></div>
    {pagination(true)}{dialogs}
    {selectedCount > 0 && <div className="floating-save no-print" style={{ gap: '12px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '14px', fontWeight: 600, color: selectedCount > 200 ? 'var(--status-red-text)' : undefined }}>{selectedCount > 200 ? `Maximum 200 allowed (${selectedCount} selected). Please deselect some.` : `${selectedCount} selected`}</span>
      <button className="btn btn-secondary btn-sm" disabled={saving || selectedCount > 200} onClick={() => action('restore', records.filter(r => selectedIds.has(r.id)))}>Restore Selected</button>
      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--btn-danger-bg)' }} disabled={saving || selectedCount > 200} onClick={() => action('purge', records.filter(r => selectedIds.has(r.id)))}>Delete Selected Forever</button>
      <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => { setSelectedIds(new Set()); lastChecked.current = null; }}>Clear</button></div>}
  </div>;
}
