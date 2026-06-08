'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Select from 'react-select';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AlertModal from '@/components/ui/AlertModal';
import { createBrowserClient } from '@/lib/supabaseClient';

import { useGlobalSettings } from '@/components/SettingsProvider';

const FILTER_COLUMNS = [
  { value: 'po_number', label: 'PO. No.', type: 'text' },
  { value: 'client_id', label: 'Client', type: 'select' },
  { value: 'product_name_id', label: 'Product', type: 'select' },
  { value: 'product_type_id', label: 'Type', type: 'select' },
  { value: 'quantity', label: 'Quantity', type: 'number' },
  { value: 'status', label: 'Status', type: 'select' },
  { value: 'date_of_entry', label: 'Date of Entry', type: 'date' }
];

const OPERATORS = {
  text:   [{ value: 'eq', label: 'Equals' }, { value: 'ilike', label: 'Contains' }],
  select: [{ value: 'eq', label: 'Is' }, { value: 'neq', label: 'Is Not' }],
  number: [{ value: 'eq', label: '=' }, { value: 'gt', label: '>' }, { value: 'lt', label: '<' }, { value: 'gte', label: '>=' }, { value: 'lte', label: '<=' }],
  date:   [{ value: 'eq', label: 'On' }, { value: 'gte', label: 'On or After' }, { value: 'lte', label: 'On or Before' }]
};

const ALL_COLUMNS = [
  { key: 'date_of_entry', label: 'Date' },
  { key: 'po_number',     label: 'PO. No.' },
  { key: 'client',        label: 'Client' },
  { key: 'product_name',  label: 'Product' },
  { key: 'product_type',  label: 'Type' },
  { key: 'quantity',      label: 'Qty' },
  { key: 'age',           label: 'Age' },
  { key: 'status',        label: 'Status' },
  { key: 'remark',        label: 'Remark' },
];

export default function ActiveOrdersPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ActiveOrdersPage />
    </Suspense>
  );
}

function ActiveOrdersPage() {
  const searchParams = useSearchParams();
  const { settings, loading: settingsLoading } = useGlobalSettings();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [clients, setClients] = useState([]);
  const [productNames, setProductNames] = useState([]);
  const [productTypes, setProductTypes] = useState([]);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    if (settings && !settingsLoading) setLimit(settings.default_pagination || 50);
  }, [settingsLoading, settings]);
  const [totalRowCount, setTotalRowCount] = useState(0);
  const [filters, setFilters] = useState([]);
  const [sortConfig, setSortConfig] = useState({ column: 'created_at', direction: 'desc' });
  const [quickViews, setQuickViews] = useState([]);
  const [activeQuickView, setActiveQuickView] = useState({ value: 'custom', label: 'Custom View' });

  // Parse Initial Filters from URL
  useEffect(() => {
    const statusParam = searchParams.get('filter_status');
    if (statusParam) {
      setFilters([{ column: 'status', operator: 'eq', value: statusParam, logic: 'and' }]);
    } else {
      setFilters([]);
    }
  }, [searchParams]);

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [lastCheckedIndex, setLastCheckedIndex] = useState(null);

  // Realtime
  const [pendingUpdates, setPendingUpdates] = useState(0);

  // Print date (client-only to avoid hydration mismatch)
  const [printDate, setPrintDate] = useState('');

  // Editing
  const [isEditable, setIsEditable] = useState(false);
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);

  // Column Visibility
  const [visibleCols, setVisibleCols] = useState(new Set(ALL_COLUMNS.map(c => c.key)));
  const [colMenuOpen, setColMenuOpen] = useState(false);

  // Bulk Action
  const [bulkStatus, setBulkStatus] = useState(null);
  const [bulkDelConfirm, setBulkDelConfirm] = useState(false);

  // Modals
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null, po: '' });
  const [alertInfo, setAlertInfo]  = useState({ isOpen: false, title: '', message: '' });
  const [viewPrompt, setViewPrompt] = useState({ isOpen: false, viewName: '' });

  const colMenuRef = useRef(null);

  function showAlert(title, message) { setAlertInfo({ isOpen: true, title, message }); }

  // Fallback map in case something breaks
  const STATUS_OPTIONS = settings?.status_options?.map(s => {
    const name = typeof s === 'string' ? s : s.name;
    return { value: name, label: name };
  }) || [];

  function getStatusStyle(statusName) {
    const opt = settings?.status_options?.find(s => (typeof s === 'string' ? s : s.name) === statusName);
    if (!opt || typeof opt === 'string') return { backgroundColor: '#f3f4f6', color: '#4b5563' };
    return { backgroundColor: opt.bg || '#f3f4f6', color: opt.text || '#4b5563' };
  }

  // Close column menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target)) {
        setColMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setPrintDate(new Date().toLocaleString());
    fetchMasters();
    fetchQuickViews();
    const supabase = createBrowserClient();
    const channel = supabase
      .channel('realtime-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        setPendingUpdates(prev => prev + 1);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchMasters() {
    try {
      const [cliRes, pNameRes, pTypeRes] = await Promise.all([
        fetch('/api/clients'), fetch('/api/product-names'), fetch('/api/product-types')
      ]);
      if (cliRes.ok) { const d = await cliRes.json(); setClients(d.map(x => ({ value: x.id, label: x.name }))); }
      if (pNameRes.ok) { const d = await pNameRes.json(); setProductNames(d.map(x => ({ value: x.id, label: x.name }))); }
      if (pTypeRes.ok) { const d = await pTypeRes.json(); setProductTypes(d.map(x => ({ value: x.id, label: x.name }))); }
    } catch (err) { console.error(err); }
  }

  async function fetchQuickViews() {
    try {
      const res = await fetch('/api/quick-views?module=orders');
      if (res.ok) {
        const data = await res.json();
        setQuickViews(data.map(v => ({ value: v.id, label: v.name, filters: v.filters })));
      }
    } catch (err) { console.error(err); }
  }

  useEffect(() => { fetchOrders(true); }, [page, limit, filters, sortConfig]);

  const fetchAbortCtrl = useRef(null);

  async function fetchOrders(showLoader = true) {
    if (fetchAbortCtrl.current) fetchAbortCtrl.current.abort();
    fetchAbortCtrl.current = new AbortController();
    const signal = fetchAbortCtrl.current.signal;

    if (showLoader) setLoading(true);
    try {
      const res = await fetch('/api/orders/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, limit, filters, sort: sortConfig, statusContext: 'active' }),
        signal
      });
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      setOrders(data.data);
      setTotalRowCount(data.meta.totalRowCount);
      setPendingUpdates(0);
      setSelectedIds(new Set());
      setLastCheckedIndex(null);
    } catch (err) { 
      if (err.name !== 'AbortError') setError(err.message); 
    } finally { 
      if (showLoader) setLoading(false); 
    }
  }

  // ---- SELECTION ----
  function handleCheckbox(e, orderId, index) {
    const newSelected = new Set(selectedIds);
    if (e.nativeEvent.shiftKey && lastCheckedIndex !== null) {
      const start = Math.min(lastCheckedIndex, index);
      const end   = Math.max(lastCheckedIndex, index);
      const shouldSelect = !selectedIds.has(orderId);
      for (let i = start; i <= end; i++) {
        if (orders[i]) {
          if (shouldSelect) newSelected.add(orders[i].id);
          else newSelected.delete(orders[i].id);
        }
      }
    } else {
      if (newSelected.has(orderId)) newSelected.delete(orderId);
      else newSelected.add(orderId);
    }
    setSelectedIds(newSelected);
    setLastCheckedIndex(index);
  }

  function handleSelectAll(e) {
    if (e.target.checked) setSelectedIds(new Set(orders.map(o => o.id)));
    else setSelectedIds(new Set());
    setLastCheckedIndex(null);
  }

  const allOnPageSelected = orders.length > 0 && orders.every(o => selectedIds.has(o.id));

  // ---- BULK ACTIONS ----
  async function handleBulkStatusUpdate() {
    if (!bulkStatus) return;
    setSaving(true);
    let errorCount = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/orders/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: bulkStatus.value })
        });
        if (!res.ok) throw new Error('Failed');
      } catch { errorCount++; }
    }
    setSaving(false);
    if (errorCount > 0) showAlert('Error', `${errorCount} orders failed to update.`);
    else showAlert('Success', `${selectedIds.size} orders updated to "${bulkStatus.label}".`);
    setBulkStatus(null);
    await fetchOrders(true);
  }

  async function handleBulkDelete() {
    setBulkDelConfirm(false);
    setSaving(true);
    let errorCount = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
      } catch { errorCount++; }
    }
    setSaving(false);
    if (errorCount > 0) showAlert('Error', `${errorCount} orders could not be deleted.`);
    await fetchOrders(true);
  }

  // ---- EXPORT ----
  function exportCSV() {
    const rows = orders.filter(o => selectedIds.size === 0 || selectedIds.has(o.id));
    const headers = ['Sr.', 'Date', 'PO. No.', 'Client', 'Product', 'Type', 'Quantity', 'Age (days)', 'Status', 'Remark'];
    const csvRows = [
      headers.join(','),
      ...rows.map((o, i) => [
        i + 1,
        new Date(o.date_of_entry).toLocaleDateString(),
        `"${o.po_number || ''}"`,
        `"${o.clients?.name || ''}"`,
        `"${o.product_names?.name || ''}"`,
        `"${o.product_types?.name || ''}"`,
        o.quantity,
        calcDaysOld(o.date_of_entry),
        `"${o.status || ''}"`,
        `"${(o.remark || '').replace(/"/g, '""')}"`
      ].join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `active-orders-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    const rows = orders.filter(o => selectedIds.size === 0 || selectedIds.has(o.id));
    
    const companyName = settings?.print_header_name || "Sarthak Creations";
    const address = settings?.print_header_address || "";

    doc.setFontSize(16);
    doc.text(companyName, 14, 15);
    
    doc.setFontSize(10);
    if (address) {
      doc.text(address, 14, 22);
    }
    doc.text("Active Orders Report", 14, address ? 28 : 22);
    
    autoTable(doc, {
      startY: address ? 35 : 30,
      head: [['Sr.', 'Date', 'PO. No.', 'Client', 'Product', 'Type', 'Qty', 'Age', 'Status', 'Remark']],
      body: rows.map((o, i) => [
        i + 1,
        new Date(o.date_of_entry).toLocaleDateString(),
        o.po_number || '',
        o.clients?.name || '',
        o.product_names?.name || '',
        o.product_types?.name || '',
        o.quantity,
        `${calcDaysOld(o.date_of_entry)}d`,
        o.status || '',
        o.remark || ''
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 30, 30] }
    });
    doc.save(`active-orders-${new Date().toISOString().slice(0,10)}.pdf`);
  }

  function handlePrint() {
    window.print();
  }

  // ---- FILTERS ----
  function addFilter() {
    setFilters([...filters, { column: 'po_number', operator: 'eq', value: '', logic: 'and' }]);
    setActiveQuickView({ value: 'custom', label: 'Custom View' });
    setPage(1);
  }

  function updateFilter(index, field, val) {
    const newFilters = [...filters];
    newFilters[index][field] = val;
    if (field === 'column') {
      const colDef = FILTER_COLUMNS.find(c => c.value === val);
      newFilters[index].operator = OPERATORS[colDef.type][0].value;
      newFilters[index].value = '';
    }
    setFilters(newFilters);
    setActiveQuickView({ value: 'custom', label: 'Custom View' });
    setPage(1);
  }

  function removeFilter(index) {
    const newFilters = [...filters];
    newFilters.splice(index, 1);
    setFilters(newFilters);
    setActiveQuickView({ value: 'custom', label: 'Custom View' });
    setPage(1);
  }

  function handleQuickViewChange(selected) {
    setActiveQuickView(selected);
    if (selected.value === 'custom') {
      setFilters([]);
    } else {
      // Ensure existing quick views have logic defaults
      const loadedFilters = (selected.filters || []).map(f => ({ ...f, logic: f.logic || 'and' }));
      setFilters(loadedFilters);
    }
    setPage(1);
  }

  async function saveQuickView() {
    if (!viewPrompt.viewName.trim()) return;
    try {
      const res = await fetch('/api/quick-views', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: viewPrompt.viewName, module: 'orders', filters })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to save view'); }
      const newView = await res.json();
      const newOption = { value: newView.id, label: newView.name, filters: newView.filters };
      setQuickViews([...quickViews, newOption]);
      setActiveQuickView(newOption);
      setViewPrompt({ isOpen: false, viewName: '' });
      showAlert('Success', 'Quick View saved globally.');
    } catch (err) { showAlert('Error', err.message); }
  }

  function renderFilterValueInput(filter, index) {
    const colDef = FILTER_COLUMNS.find(c => c.value === filter.column);
    if (!colDef) return null;
    if (colDef.type === 'select') {
      let options = [];
      if (filter.column === 'client_id') options = clients;
      if (filter.column === 'product_name_id') options = productNames;
      if (filter.column === 'product_type_id') options = productTypes;
      if (filter.column === 'status') options = STATUS_OPTIONS;
      return (
        <div style={{ width: '250px' }}>
          <Select options={options} styles={tblSelectStyles} menuPortalTarget={typeof window !== 'undefined' ? document.body : null}
            value={options.find(o => o.value === filter.value) || null}
            onChange={val => updateFilter(index, 'value', val ? val.value : '')} placeholder="Select value..." />
        </div>
      );
    }
    return (
      <input type={colDef.type === 'number' ? 'number' : colDef.type === 'date' ? 'date' : 'text'}
        className="form-input" style={{ height: '32px', padding: '4px 8px', fontSize: '13px', width: '250px', boxSizing: 'border-box' }}
        value={filter.value} onChange={e => updateFilter(index, 'value', e.target.value)} placeholder="Enter value..." />
    );
  }

  // ---- SINGLE ROW CRUD ----
  function promptDelete(id, po) { setConfirmModal({ isOpen: true, id, po }); }

  async function handleDelete() {
    const { id } = confirmModal;
    setConfirmModal({ isOpen: false, id: null, po: '' });
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to delete order'); }
      fetchOrders(false);
      const newEdits = { ...pendingEdits }; delete newEdits[id]; setPendingEdits(newEdits);
    } catch (err) { showAlert('Error', err.message); }
  }

  function handleCellChange(id, field, value) { setPendingEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } })); }
  function getDisplayValue(order, field) { return (pendingEdits[order.id]?.[field] !== undefined) ? pendingEdits[order.id][field] : order[field]; }
  function hasPendingEdits() { return Object.keys(pendingEdits).length > 0; }

  async function saveAllEdits() {
    setSaving(true);
    let errorCount = 0;
    for (const [id, changes] of Object.entries(pendingEdits)) {
      try {
        const res = await fetch(`/api/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) });
        if (!res.ok) throw new Error('Failed to update');
      } catch (err) { showAlert('Error', `Error updating order: ${err.message}`); errorCount++; }
    }
    if (errorCount === 0) { setPendingEdits({}); await fetchOrders(true); }
    setSaving(false);
  }

  function discardEdits() { setPendingEdits({}); }

  function calcDaysOld(dateStr) {
    const diffTime = Math.abs(new Date() - new Date(dateStr));
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  function toggleCol(key) {
    const next = new Set(visibleCols);
    if (next.has(key)) { if (next.size > 1) next.delete(key); }
    else next.add(key);
    setVisibleCols(next);
  }

  const tblSelectStyles = {
    control: base => ({ ...base, minHeight: '32px', height: '32px', fontSize: '13px', backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', boxShadow: 'none' }),
    menu: base => ({ ...base, backgroundColor: 'var(--bg-surface)', zIndex: 9999 }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'var(--table-row-hover)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }),
    singleValue: base => ({ ...base, color: 'var(--text-primary)' }),
    valueContainer: base => ({ ...base, padding: '0px 8px', height: '30px' }),
    input: base => ({ ...base, color: 'var(--text-primary)', margin: 0, padding: 0 }),
    indicatorsContainer: base => ({ ...base, height: '30px' }),
    dropdownIndicator: base => ({ ...base, padding: '2px 8px' })
  };

  function handleSort(column) {
    setSortConfig(prev => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: 'asc' };
    });
  }

  function SortHeader({ column, label, width }) {
    const isSorted = sortConfig.column === column;
    const arrow = isSorted ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ' ↕';
    return (
      <th style={{ width, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort(column)}>
        {label}
        <span style={{ fontSize: '10px', color: isSorted ? 'var(--primary-color)' : 'var(--text-muted)' }}>{arrow}</span>
      </th>
    );
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="masters-page">
      {/* Toolbar */}
      <div className="toolbar" style={{ justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Link href="/orders/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>+ New Order</Link>
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}>Export CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={exportPDF}>Export PDF</button>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}>Print</button>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Column Visibility */}
          <div style={{ position: 'relative' }} ref={colMenuRef}>
            <button className="btn btn-secondary btn-sm" onClick={() => setColMenuOpen(v => !v)}>Columns ▾</button>
            {colMenuOpen && (
              <div style={{ position: 'absolute', right: 0, top: '36px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px', zIndex: 9999, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', padding: '2px 4px' }}>
                    <input type="checkbox" checked={visibleCols.has(col.key)} onChange={() => toggleCol(col.key)} />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <label className="editable-toggle">
            <input type="checkbox" checked={isEditable} onChange={(e) => setIsEditable(e.target.checked)} /> Editable
          </label>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: filters.length > 0 ? '16px' : '0' }}>
          <strong style={{ fontSize: '14px' }}>Quick Views:</strong>
          <div style={{ width: '250px' }}>
            <Select instanceId="qv-orders" options={[{ value: 'custom', label: 'Custom View' }, ...quickViews]} value={activeQuickView} onChange={handleQuickViewChange} styles={tblSelectStyles} />
          </div>
          {activeQuickView?.value === 'custom' && filters.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={() => setViewPrompt({ isOpen: true, viewName: '' })}>Save as Quick View</button>
          )}
          {filters.length === 0 && (
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={addFilter}>+ Add Filter Rule</button>
          )}
        </div>
        {filters.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filters.map((f, i) => {
              const colDef = FILTER_COLUMNS.find(c => c.value === f.column);
              return (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ width: '200px' }}><Select instanceId={`filter-col-${i}`} options={FILTER_COLUMNS} styles={tblSelectStyles} value={FILTER_COLUMNS.find(c => c.value === f.column)} onChange={val => updateFilter(i, 'column', val.value)} /></div>
                  <div style={{ width: '150px' }}><Select instanceId={`filter-op-${i}`} options={OPERATORS[colDef.type]} styles={tblSelectStyles} value={OPERATORS[colDef.type].find(o => o.value === f.operator)} onChange={val => updateFilter(i, 'operator', val.value)} /></div>
                  {renderFilterValueInput(f, i)}
                  <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: 'var(--btn-danger-bg)' }} onClick={() => removeFilter(i)}>✕</button>
                  
                  {i < filters.length - 1 && (
                    <select 
                      className="form-input" 
                      style={{ height: '32px', padding: '0 12px', fontSize: '14px', width: '100px', fontWeight: '600', marginLeft: '16px', background: 'var(--bg-surface)' }} 
                      value={f.logic || 'and'} 
                      onChange={e => updateFilter(i, 'logic', e.target.value)}
                    >
                      <option value="and">AND</option>
                      <option value="or">OR</option>
                    </select>
                  )}
                </div>
              );
            })}
            <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', marginTop: '8px' }} onClick={addFilter}>+ Add Rule</button>
          </div>
        )}
      </div>

      {/* Realtime banner */}
      {pendingUpdates > 0 && (
        <div style={{ backgroundColor: 'var(--primary-color)', color: '#fff', padding: '8px 16px', borderRadius: '4px', marginBottom: '16px', cursor: 'pointer', textAlign: 'center', fontWeight: 600 }} onClick={() => fetchOrders(true)}>
          ({pendingUpdates}) updates available. Click here to refresh.
        </div>
      )}

      {error && <div className="form-error" style={{ marginBottom: '12px' }}>{error}</div>}

      {/* Print-only header */}
      <div className="print-only" style={{ display: 'none', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>Sarthak Creations — Active Orders</h2>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#555' }}>Printed: {printDate}</p>
      </div>

      {/* Pagination (Top) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '12px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px' }}>
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
          <span style={{ fontSize: '14px' }}>Showing {totalRowCount === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, totalRowCount)} of {totalRowCount}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn btn-secondary btn-sm" disabled={page * limit >= totalRowCount} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: isEditable ? '1150px' : '900px' }}>
          <thead>
            <tr>
              <th style={{ width: '40px' }} className="no-print">
                <input type="checkbox" checked={allOnPageSelected} onChange={handleSelectAll} title="Select all on this page" />
              </th>
              <th style={{ width: '40px' }}>Sr.</th>
              {visibleCols.has('date_of_entry')   && <SortHeader column="date_of_entry" label="Date" width="135px" />}
              {visibleCols.has('po_number')        && <SortHeader column="po_number" label="PO. No." width="110px" />}
              {visibleCols.has('client')           && <SortHeader column="clients.name" label="Client" width="200px" />}
              {visibleCols.has('product_name')     && <SortHeader column="product_names.name" label="Product" width="200px" />}
              {visibleCols.has('product_type')     && <SortHeader column="product_types.name" label="Type" width="120px" />}
              {visibleCols.has('quantity')         && <SortHeader column="quantity" label="Qty" width="90px" />}
              {visibleCols.has('age')              && <SortHeader column="date_of_entry" label="Age" width="55px" />}
              {visibleCols.has('status')           && <SortHeader column="status" label="Status" width="160px" />}
              {visibleCols.has('remark')           && <SortHeader column="remark" label="Remark" width="150px" />}
              <th style={{ width: '80px' }} className="no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="20" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading orders...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan="20" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No orders found matching filters.</td></tr>
            ) : (
              orders.map((order, index) => {
                const isSelected = selectedIds.has(order.id);
                const poVal      = getDisplayValue(order, 'po_number');
                const dateVal    = getDisplayValue(order, 'date_of_entry');
                const qtyVal     = getDisplayValue(order, 'quantity');
                const remarkVal  = getDisplayValue(order, 'remark');
                const clientValId  = getDisplayValue(order, 'client_id');
                const pNameValId   = getDisplayValue(order, 'product_name_id');
                const pTypeValId   = getDisplayValue(order, 'product_type_id');
                const statusVal    = getDisplayValue(order, 'status');

                return (
                  <tr key={order.id} style={{ backgroundColor: isSelected ? 'var(--table-row-selected)' : undefined }}>
                    <td className="no-print">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => handleCheckbox(e, order.id, index)}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{(page - 1) * limit + index + 1}</td>

                    {visibleCols.has('date_of_entry') && (
                      <td className={pendingEdits[order.id]?.date_of_entry !== undefined ? 'cell-edited' : ''}>
                        {isEditable ? <input type="date" className="form-input" style={{ padding: '2px 4px', fontSize: '13px' }} value={dateVal} onChange={e => handleCellChange(order.id, 'date_of_entry', e.target.value)} /> : new Date(dateVal).toLocaleDateString()}
                      </td>
                    )}
                    {visibleCols.has('po_number') && (
                      <td className={pendingEdits[order.id]?.po_number !== undefined ? 'cell-edited' : ''}>
                        {isEditable ? <input type="text" className="form-input" style={{ padding: '2px 4px', fontSize: '13px' }} value={poVal || ''} onChange={e => handleCellChange(order.id, 'po_number', e.target.value)} /> : <span style={{ fontWeight: 600 }}>{poVal}</span>}
                      </td>
                    )}
                    {visibleCols.has('client') && (
                      <td className={pendingEdits[order.id]?.client_id !== undefined ? 'cell-edited' : ''}>
                        {isEditable ? <Select instanceId={`client-${order.id}`} options={clients} styles={tblSelectStyles} menuPortalTarget={typeof window !== 'undefined' ? document.body : null} value={clients.find(c => c.value === clientValId)} onChange={val => handleCellChange(order.id, 'client_id', val?.value ?? null)} /> : order.clients?.name}
                      </td>
                    )}
                    {visibleCols.has('product_name') && (
                      <td className={pendingEdits[order.id]?.product_name_id !== undefined ? 'cell-edited' : ''}>
                        {isEditable ? <Select instanceId={`pname-${order.id}`} options={productNames} styles={tblSelectStyles} menuPortalTarget={typeof window !== 'undefined' ? document.body : null} value={productNames.find(c => c.value === pNameValId)} onChange={val => handleCellChange(order.id, 'product_name_id', val?.value ?? null)} /> : order.product_names?.name}
                      </td>
                    )}
                    {visibleCols.has('product_type') && (
                      <td className={pendingEdits[order.id]?.product_type_id !== undefined ? 'cell-edited' : ''}>
                        {isEditable ? <Select instanceId={`ptype-${order.id}`} options={productTypes} styles={tblSelectStyles} menuPortalTarget={typeof window !== 'undefined' ? document.body : null} value={productTypes.find(c => c.value === pTypeValId)} onChange={val => handleCellChange(order.id, 'product_type_id', val?.value ?? null)} /> : order.product_types?.name}
                      </td>
                    )}
                    {visibleCols.has('quantity') && (
                      <td className={pendingEdits[order.id]?.quantity !== undefined ? 'cell-edited' : ''}>
                        {isEditable ? <input type="number" className="form-input" style={{ padding: '2px 4px', fontSize: '13px', width: '60px' }} value={qtyVal || ''} onChange={e => handleCellChange(order.id, 'quantity', e.target.value)} /> : qtyVal}
                      </td>
                    )}
                    {visibleCols.has('age') && (
                      <td style={{ color: 'var(--text-secondary)' }}>{calcDaysOld(dateVal)}d</td>
                    )}
                    {visibleCols.has('status') && (
                      <td className={pendingEdits[order.id]?.status !== undefined ? 'cell-edited' : ''}>
                      {isEditable ? <Select options={STATUS_OPTIONS} styles={tblSelectStyles} menuPortalTarget={typeof window !== 'undefined' ? document.body : null} value={STATUS_OPTIONS.find(c => c.value === statusVal)} onChange={val => handleCellChange(order.id, 'status', val ? val.value : null)} /> : <span className="status-badge" style={getStatusStyle(statusVal)}>{statusVal}</span>}
                    </td>
                    )}
                    {visibleCols.has('remark') && (
                      <td className={pendingEdits[order.id]?.remark !== undefined ? 'cell-edited' : ''}>
                        {isEditable ? <input type="text" className="form-input" style={{ padding: '2px 4px', fontSize: '13px' }} value={remarkVal || ''} onChange={e => handleCellChange(order.id, 'remark', e.target.value)} /> : remarkVal}
                      </td>
                    )}
                    <td className="no-print">
                      <button className="btn btn-ghost btn-sm" onClick={() => promptDelete(order.id, order.po_number)} disabled={isEditable && hasPendingEdits()}>Delete</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination (Bottom) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '12px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px' }}>
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
          <span style={{ fontSize: '14px' }}>Showing {totalRowCount === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, totalRowCount)} of {totalRowCount}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn btn-secondary btn-sm" disabled={page * limit >= totalRowCount} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </div>

      {/* Floating Save (Edits) */}
      {hasPendingEdits() && (
        <div className="floating-save no-print">
          <button className="btn btn-secondary" onClick={discardEdits} disabled={saving}>Discard</button>
          <button className="btn btn-primary" onClick={saveAllEdits} disabled={saving}>{saving ? 'Saving...' : `Save Changes (${Object.keys(pendingEdits).length} edits)`}</button>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedCount > 0 && !hasPendingEdits() && (
        <div className="floating-save no-print" style={{ gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{selectedCount} selected</span>
          <div style={{ width: '200px' }}>
            <Select instanceId="bulk-status-orders" options={STATUS_OPTIONS} placeholder="Set Status..." styles={tblSelectStyles}
              value={bulkStatus} onChange={setBulkStatus}
              menuPortalTarget={typeof window !== 'undefined' ? document.body : null}
              menuPlacement="top"
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleBulkStatusUpdate} disabled={!bulkStatus || saving}>
            {saving ? 'Updating...' : 'Apply Status'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}>Export CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={exportPDF}>Export PDF</button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--btn-danger-bg)' }} onClick={() => setBulkDelConfirm(true)} disabled={saving}>
            Delete Selected
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedIds(new Set()); setLastCheckedIndex(null); }}>Clear</button>
        </div>
      )}

      {/* Modals */}
      <ConfirmModal isOpen={confirmModal.isOpen} title="Delete Order" message={`Are you sure you want to delete PO #${confirmModal.po}? It will be moved to the recycle bin.`} confirmText="Delete" confirmColor="danger" onConfirm={handleDelete} onCancel={() => setConfirmModal({ isOpen: false, id: null, po: '' })} />
      <ConfirmModal isOpen={bulkDelConfirm} title="Delete Selected Orders" message={`Are you sure you want to delete ${selectedCount} selected orders? They will all be moved to the Recycle Bin.`} confirmText="Delete All" confirmColor="danger" onConfirm={handleBulkDelete} onCancel={() => setBulkDelConfirm(false)} />
      <AlertModal isOpen={alertInfo.isOpen} title={alertInfo.title} message={alertInfo.message} onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })} />

      {viewPrompt.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 99999 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h3 className="modal-title" style={{ marginTop: 0, fontSize: '18px', fontWeight: '600' }}>Save Quick View</h3>
            <p style={{ margin: '12px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Enter a name to save these filter rules for everyone.</p>
            <input type="text" className="form-input" placeholder="e.g. Reliance Pending Orders" value={viewPrompt.viewName} onChange={e => setViewPrompt({ ...viewPrompt, viewName: e.target.value })} autoFocus style={{ marginBottom: '16px', width: '100%' }} />
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setViewPrompt({ isOpen: false, viewName: '' })}>Cancel</button>
              <button className="btn btn-primary" onClick={saveQuickView} disabled={!viewPrompt.viewName.trim()}>Save View</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
