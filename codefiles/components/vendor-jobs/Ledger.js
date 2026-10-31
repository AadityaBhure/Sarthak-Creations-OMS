'use client';
import { useEffect, useRef, useState } from 'react';
import { useGlobalSettings } from '@/components/SettingsProvider';
import { LEDGER_FIELDS } from '@/lib/vendor-jobs/ledger.mjs';
import { api, useMasters, MasterSelect, Pagination, dateTime } from './Common';
import Filters from './Filters';
import Exports from './Exports';
import styles from './vendor-jobs.module.css';

export default function Ledger() {
  const { masters, loading: mastersLoading, error: masterError } = useMasters(true);
  const { settings } = useGlobalSettings();
  const [vendorId, setVendorId] = useState(null);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [filters, setFilters] = useState([]);
  const [sort, setSort] = useState({ column: 'stage_started_at', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(null);
  const limit = size || settings?.default_pagination || 50;
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [columns, setColumns] = useState(LEDGER_FIELDS.map(f => f.key));
  const [columnMenu, setColumnMenu] = useState(false);
  const requestId = useRef(0);
  const vendor = masters.vendors.find(v => v.id === vendorId);
  const title = 'Vendor-wise Ledger — ' + (vendor?.name || 'All Vendors');

  async function refresh() {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await api('ledger', { page, limit, vendorId, includeDeleted, filters, sort });
      if (id !== requestId.current) return;
      setRows(result.data); setTotal(result.meta.totalRowCount); setSelected(new Set()); setError('');
    } catch (e) {
      if (id === requestId.current) { setError(e.message); setRows([]); setTotal(0); setSelected(new Set()); }
    } finally { if (id === requestId.current) setLoading(false); }
  }
  useEffect(() => {
    refresh();
    return () => { requestId.current++; };
  }, [page, limit, vendorId, includeDeleted, filters, sort]);

  const fields = LEDGER_FIELDS.filter(f => columns.includes(f.key));
  const pagination = <Pagination {...{ page, limit, total }} disabled={loading} onPage={setPage} onLimit={n => { setSize(n); setPage(1); }} />;
  return (
    <div className="masters-page">
      <div className="toolbar no-print" style={{ justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Exports {...{ rows, selected, columns, title, settings }} availableFields={LEDGER_FIELDS} filename="vendor-ledger" disabled={loading || !rows.length} />
          <button className="btn btn-secondary btn-sm" onClick={refresh} disabled={loading}>Refresh</button>
        </div>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setColumnMenu(!columnMenu)}>Columns ▾</button>
          {columnMenu && <div className={styles.panel} style={{ position: 'absolute', right: 0, zIndex: 100, minWidth: 220 }}>
            {LEDGER_FIELDS.map(f => <label key={f.key} style={{ display: 'block' }}>
              <input type="checkbox" checked={columns.includes(f.key)} onChange={() => setColumns(prev => prev.includes(f.key) ? prev.length > 1 ? prev.filter(k => k !== f.key) : prev : [...prev, f.key])} /> {f.label}
            </label>)}
          </div>}
        </div>
      </div>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>{title}</h2>
      <p className={styles.note}>One row per saved vendor visit. Repeat visits appear separately. Batch Quantity is the current card quantity, repeated for each visit—not a quantity total.</p>
      <div className="card no-print" style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260 }}>
          <label className="form-label">Vendor (leave blank for all)</label>
          <MasterSelect label="Ledger Vendor" items={masters.vendors} value={vendorId} clearable allowDeleted disabled={mastersLoading} onChange={id => { setVendorId(id || null); setPage(1); }} />
        </div>
        <label><input type="checkbox" checked={includeDeleted} onChange={e => { setIncludeDeleted(e.target.checked); setPage(1); }} /> Include Job Cards in Deleted Records</label>
      </div>
      <Filters context="ledger" fields={LEDGER_FIELDS} allowDeleted rules={filters} onChange={next => { setFilters(next); setPage(1); }} masters={masters} />
      <p className={styles.note}>Exports include {selected.size ? `${selected.size} selected visits` : 'the current page'} and visible columns. Print uses the current page. {includeDeleted ? 'Including recoverable deleted cards.' : 'Deleted cards are excluded.'}</p>
      {(error || masterError) && <div className="form-error" role="alert">{error || masterError}</div>}
      {pagination}
      <div className="table-container">
        <table className={`data-table ${styles.table}`}>
          <thead><tr>
            <th className="no-print"><input type="checkbox" aria-label="Select all visits on this page" disabled={loading || !rows.length} checked={rows.length > 0 && rows.every(r => selected.has(r.id))} onChange={e => setSelected(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())} /></th>
            <th>Row</th>
            {fields.map(f => <th key={f.key} aria-sort={sort.column === f.key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setSort({ column: f.key, direction: sort.column === f.key && sort.direction === 'asc' ? 'desc' : 'asc' }); setPage(1); }}>{f.label} {sort.column === f.key ? sort.direction === 'asc' ? '▲' : '▼' : '↕'}</button>
            </th>)}
          </tr></thead>
          <tbody>{loading ? <tr><td colSpan={fields.length + 2}>Loading vendor visits...</td></tr> : !rows.length ? <tr><td colSpan={fields.length + 2}>No vendor visits found matching these filters.</td></tr> : rows.map((row, i) => <tr key={row.id}>
            <td className="no-print"><input type="checkbox" aria-label={`Select visit ${row.stage_number} of ${row.job_card_number}`} checked={selected.has(row.id)} onChange={e => setSelected(prev => { const next = new Set(prev); if (e.target.checked) next.add(row.id); else next.delete(row.id); return next; })} /></td>
            <td>{(page - 1) * limit + i + 1}</td>
            {fields.map(f => <td key={f.key}>{f.type === 'date' ? dateTime(row[f.key]) : f.key === 'quantity' ? row.quantity.toLocaleString('en-IN') : row[f.key] ?? '—'}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {pagination}
    </div>
  );
}
