'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Select from 'react-select';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AlertModal from '@/components/ui/AlertModal';
import { createBrowserClient } from '@/lib/supabaseClient';

const STATUS_OPTIONS = [
  'Design Confirmed',
  'Client Approval',
  'Finalised',
  'Printing',
  'Completed'
].map(s => ({ value: s, label: s }));

const FILTER_COLUMNS = [
  { value: 'po_number', label: 'PO Number', type: 'text' },
  { value: 'client_id', label: 'Client', type: 'select' },
  { value: 'product_name_id', label: 'Product Name', type: 'select' },
  { value: 'product_type_id', label: 'Product Type', type: 'select' },
  { value: 'quantity', label: 'Quantity', type: 'number' },
  { value: 'status', label: 'Status', type: 'select' },
  { value: 'date_of_entry', label: 'Date of Entry', type: 'date' }
];

const OPERATORS = {
  text: [ { value: 'eq', label: 'Equals' }, { value: 'ilike', label: 'Contains' } ],
  select: [ { value: 'eq', label: 'Is' }, { value: 'neq', label: 'Is Not' } ],
  number: [ { value: 'eq', label: '=' }, { value: 'gt', label: '>' }, { value: 'lt', label: '<' }, { value: 'gte', label: '>=' }, { value: 'lte', label: '<=' } ],
  date: [ { value: 'eq', label: 'On' }, { value: 'gte', label: 'On or After' }, { value: 'lte', label: 'On or Before' } ]
};

export default function ActiveOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [clients, setClients] = useState([]);
  const [productNames, setProductNames] = useState([]);
  const [productTypes, setProductTypes] = useState([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalRowCount, setTotalRowCount] = useState(0);
  const [filters, setFilters] = useState([]);
  const [quickViews, setQuickViews] = useState([]);
  const [activeQuickView, setActiveQuickView] = useState({ value: 'custom', label: 'Custom View' });

  const [pendingUpdates, setPendingUpdates] = useState(0);
  const [isEditable, setIsEditable] = useState(false);
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null, po: '' });
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });
  const [viewPrompt, setViewPrompt] = useState({ isOpen: false, viewName: '' });

  function showAlert(title, message) { setAlertInfo({ isOpen: true, title, message }); }

  useEffect(() => {
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
      if (cliRes.ok) {
        const d = await cliRes.json();
        setClients(d.map(x => ({ value: x.id, label: x.name })));
      }
      if (pNameRes.ok) {
        const d = await pNameRes.json();
        setProductNames(d.map(x => ({ value: x.id, label: x.name })));
      }
      if (pTypeRes.ok) {
        const d = await pTypeRes.json();
        setProductTypes(d.map(x => ({ value: x.id, label: x.name })));
      }
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

  useEffect(() => { fetchOrders(true); }, [page, limit, filters]);

  async function fetchOrders(showLoader = true) {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch('/api/orders/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, limit, filters, statusContext: 'active' })
      });
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      setOrders(data.data);
      setTotalRowCount(data.meta.totalRowCount);
      setPendingUpdates(0);
    } catch (err) { setError(err.message); } finally { if (showLoader) setLoading(false); }
  }

  function addFilter() {
    setFilters([...filters, { column: 'po_number', operator: 'eq', value: '' }]);
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
    if (selected.value === 'custom') setFilters([]);
    else setFilters(selected.filters || []);
    setPage(1);
  }

  async function saveQuickView() {
    if (!viewPrompt.viewName.trim()) return;
    try {
      const res = await fetch('/api/quick-views', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: viewPrompt.viewName, module: 'orders', filters })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save view');
      }
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
          <Select 
            options={options} styles={tblSelectStyles} menuPortalTarget={typeof window !== 'undefined' ? document.body : null}
            value={options.find(o => o.value === filter.value) || null}
            onChange={val => updateFilter(index, 'value', val ? val.value : '')} placeholder="Select value..."
          />
        </div>
      );
    }
    return (
      <input 
        type={colDef.type === 'number' ? 'number' : colDef.type === 'date' ? 'date' : 'text'}
        className="form-input" style={{ height: '32px', padding: '4px 8px', fontSize: '13px', width: '250px', boxSizing: 'border-box' }}
        value={filter.value} onChange={e => updateFilter(index, 'value', e.target.value)} placeholder="Enter value..."
      />
    );
  }

  function promptDelete(id, po) { setConfirmModal({ isOpen: true, id, po }); }

  async function handleDelete() {
    const { id } = confirmModal;
    setConfirmModal({ isOpen: false, id: null, po: '' });
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete order');
      }
      fetchOrders(false);
      if (pendingEdits[id]) {
        const newEdits = { ...pendingEdits };
        delete newEdits[id];
        setPendingEdits(newEdits);
      }
    } catch (err) { showAlert('Error', err.message); }
  }

  function handleCellChange(id, field, value) { setPendingEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } })); }
  function getDisplayValue(order, field) { return (pendingEdits[order.id] && pendingEdits[order.id][field] !== undefined) ? pendingEdits[order.id][field] : order[field]; }
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
    const entryDate = new Date(dateStr);
    const diffTime = Math.abs(new Date() - entryDate);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
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

  return (
    <div className="masters-page">
      <div className="toolbar" style={{ justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Link href="/orders/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>+ New Order</Link>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <label className="editable-toggle">
            <input type="checkbox" checked={isEditable} onChange={(e) => setIsEditable(e.target.checked)} /> Editable
          </label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: filters.length > 0 ? '16px' : '0' }}>
          <strong style={{ fontSize: '14px' }}>Quick Views:</strong>
          <div style={{ width: '250px' }}>
            <Select 
              options={[{ value: 'custom', label: 'Custom View' }, ...quickViews]}
              value={activeQuickView}
              onChange={handleQuickViewChange}
              styles={tblSelectStyles}
            />
          </div>
          {activeQuickView && activeQuickView.value === 'custom' && filters.length > 0 && (
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
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ width: '200px' }}>
                    <Select options={FILTER_COLUMNS} styles={tblSelectStyles} value={FILTER_COLUMNS.find(c => c.value === f.column)} onChange={val => updateFilter(i, 'column', val.value)} />
                  </div>
                  <div style={{ width: '150px' }}>
                    <Select options={OPERATORS[colDef.type]} styles={tblSelectStyles} value={OPERATORS[colDef.type].find(o => o.value === f.operator)} onChange={val => updateFilter(i, 'operator', val.value)} />
                  </div>
                  {renderFilterValueInput(f, i)}
                  <button className="btn btn-ghost btn-sm" onClick={() => removeFilter(i)}>✕</button>
                </div>
              );
            })}
            <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', marginTop: '8px' }} onClick={addFilter}>+ Add Rule</button>
          </div>
        )}
      </div>

      {pendingUpdates > 0 && (
        <div style={{ backgroundColor: 'var(--primary-color)', color: '#fff', padding: '8px 16px', borderRadius: '4px', marginBottom: '16px', cursor: 'pointer', textAlign: 'center', fontWeight: 600 }} onClick={() => fetchOrders(true)}>
          ({pendingUpdates}) updates available. Click here to refresh.
        </div>
      )}

      {error && <div className="form-error" style={{ marginBottom: '12px' }}>{error}</div>}

      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: '1200px' }}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>Sr.</th>
              <th style={{ width: '120px' }}>Date</th>
              <th style={{ width: '100px' }}>PO Number</th>
              <th style={{ width: '180px' }}>Client</th>
              <th style={{ width: '150px' }}>Product Name</th>
              <th style={{ width: '150px' }}>Product Type</th>
              <th style={{ width: '70px' }}>Qty</th>
              <th style={{ width: '60px' }}>Age</th>
              <th style={{ width: '140px' }}>Status</th>
              <th>Remark</th>
              <th style={{ width: '80px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="11" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading orders...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan="11" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No orders found matching filters.</td></tr>
            ) : (
              orders.map((order, index) => {
                const poVal = getDisplayValue(order, 'po_number');
                const dateVal = getDisplayValue(order, 'date_of_entry');
                const qtyVal = getDisplayValue(order, 'quantity');
                const remarkVal = getDisplayValue(order, 'remark');
                const clientValId = getDisplayValue(order, 'client_id');
                const pNameValId = getDisplayValue(order, 'product_name_id');
                const pTypeValId = getDisplayValue(order, 'product_type_id');
                const statusVal = getDisplayValue(order, 'status');

                return (
                  <tr key={order.id}>
                    <td style={{ color: 'var(--text-secondary)' }}>{(page - 1) * limit + index + 1}</td>
                    <td className={pendingEdits[order.id]?.date_of_entry !== undefined ? 'cell-edited' : ''}>
                      {isEditable ? <input type="date" className="form-input" style={{ padding: '2px 4px', fontSize: '13px' }} value={dateVal} onChange={e => handleCellChange(order.id, 'date_of_entry', e.target.value)} /> : new Date(dateVal).toLocaleDateString()}
                    </td>
                    <td className={pendingEdits[order.id]?.po_number !== undefined ? 'cell-edited' : ''}>
                      {isEditable ? <input type="text" className="form-input" style={{ padding: '2px 4px', fontSize: '13px' }} value={poVal || ''} onChange={e => handleCellChange(order.id, 'po_number', e.target.value)} /> : <span style={{ fontWeight: 600 }}>{poVal}</span>}
                    </td>
                    <td className={pendingEdits[order.id]?.client_id !== undefined ? 'cell-edited' : ''}>
                      {isEditable ? <Select options={clients} styles={tblSelectStyles} menuPortalTarget={typeof window !== 'undefined' ? document.body : null} value={clients.find(c => c.value === clientValId)} onChange={val => handleCellChange(order.id, 'client_id', val ? val.value : null)} /> : order.clients?.name}
                    </td>
                    <td className={pendingEdits[order.id]?.product_name_id !== undefined ? 'cell-edited' : ''}>
                      {isEditable ? <Select options={productNames} styles={tblSelectStyles} menuPortalTarget={typeof window !== 'undefined' ? document.body : null} value={productNames.find(c => c.value === pNameValId)} onChange={val => handleCellChange(order.id, 'product_name_id', val ? val.value : null)} /> : order.product_names?.name}
                    </td>
                    <td className={pendingEdits[order.id]?.product_type_id !== undefined ? 'cell-edited' : ''}>
                      {isEditable ? <Select options={productTypes} styles={tblSelectStyles} menuPortalTarget={typeof window !== 'undefined' ? document.body : null} value={productTypes.find(c => c.value === pTypeValId)} onChange={val => handleCellChange(order.id, 'product_type_id', val ? val.value : null)} /> : order.product_types?.name}
                    </td>
                    <td className={pendingEdits[order.id]?.quantity !== undefined ? 'cell-edited' : ''}>
                      {isEditable ? <input type="number" className="form-input" style={{ padding: '2px 4px', fontSize: '13px', width: '60px' }} value={qtyVal || ''} onChange={e => handleCellChange(order.id, 'quantity', e.target.value)} /> : qtyVal}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{calcDaysOld(dateVal)}d</td>
                    <td className={pendingEdits[order.id]?.status !== undefined ? 'cell-edited' : ''}>
                      {isEditable ? <Select options={STATUS_OPTIONS} styles={tblSelectStyles} menuPortalTarget={typeof window !== 'undefined' ? document.body : null} value={STATUS_OPTIONS.find(c => c.value === statusVal)} onChange={val => handleCellChange(order.id, 'status', val ? val.value : null)} /> : <span className={`status-badge status-${statusVal.replace(/\s+/g, '-').toLowerCase()}`}>{statusVal}</span>}
                    </td>
                    <td className={pendingEdits[order.id]?.remark !== undefined ? 'cell-edited' : ''}>
                      {isEditable ? <input type="text" className="form-input" style={{ padding: '2px 4px', fontSize: '13px' }} value={remarkVal || ''} onChange={e => handleCellChange(order.id, 'remark', e.target.value)} /> : remarkVal}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => promptDelete(order.id, order.po_number)} disabled={isEditable && hasPendingEdits()}>Delete</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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
          <span style={{ fontSize: '14px' }}>Showing {totalRowCount === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, totalRowCount)} of {totalRowCount}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn btn-secondary btn-sm" disabled={page * limit >= totalRowCount} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </div>

      {hasPendingEdits() && (
        <div className="floating-save">
          <button className="btn btn-secondary" onClick={discardEdits} disabled={saving}>Discard</button>
          <button className="btn btn-primary" onClick={saveAllEdits} disabled={saving}>{saving ? 'Saving...' : `Save Changes (${Object.keys(pendingEdits).length} edits)`}</button>
        </div>
      )}

      <ConfirmModal isOpen={confirmModal.isOpen} title="Delete Order" message={`Are you sure you want to delete PO #${confirmModal.po}? It will be moved to the recycle bin.`} confirmText="Delete" confirmColor="danger" onConfirm={handleDelete} onCancel={() => setConfirmModal({ isOpen: false, id: null, po: '' })} />
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
