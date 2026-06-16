'use client';

import { useState, useEffect } from 'react';
import Select from 'react-select';
import ExcelImportModal from '@/components/excel/ExcelImportModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AlertModal from '@/components/ui/AlertModal';
import { createBrowserClient } from '@/lib/supabaseClient';
import { useGlobalSettings } from '@/components/SettingsProvider';

export default function ProductNamesList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { settings, loading: settingsLoading } = useGlobalSettings();
  const [clients, setClients] = useState([]);
  const [newClientId, setNewClientId] = useState(null);
  
  // Search
  const [search, setSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    if (settings && !settingsLoading) setLimit(settings.default_pagination || 50);
  }, [settingsLoading, settings]);
  
  // Editing state
  const [isEditable, setIsEditable] = useState(false);
  const [pendingEdits, setPendingEdits] = useState({}); // { id: { name } }
  const [saving, setSaving] = useState(false);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [lastCheckedIndex, setLastCheckedIndex] = useState(null);
  const [bulkDelConfirm, setBulkDelConfirm] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });

  function showAlert(title, message) {
    setAlertInfo({ isOpen: true, title, message });
  }

  // CSV Import state
  const [showCsvModal, setShowCsvModal] = useState(false);

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null, name: '' });

  // Fetch on mount
  useEffect(() => {
    fetchProducts(true);

    const supabase = createBrowserClient();
    const channel = supabase
      .channel('realtime-product-names')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_names' }, () => {
        fetchProducts(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchProducts(showLoader = true) {
    if (showLoader) setLoading(true);
    try {
      const [res, cliRes] = await Promise.all([
        fetch('/api/product-names'),
        fetch('/api/clients')
      ]);
      if (!res.ok) throw new Error('Failed to fetch product lists');
      const data = await res.json();
      setProducts(data);
      if (cliRes.ok) {
        const cliData = await cliRes.json();
        const clientOptions = cliData.map(c => ({ value: c.id, label: c.name }));
        setClients([
          { value: 'no_client', label: 'No clients added', isSpecial: true },
          ...clientOptions
        ]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- ADD LOGIC ---
  async function handleAdd(e) {
    e.preventDefault();
    setModalError('');
    setModalLoading(true);

    try {
      const res = await fetch('/api/product-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, client_id: newClientId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add product name');

      setProducts((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowModal(false);
      setNewName('');
      setNewClientId(null);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  }

  // --- DELETE LOGIC ---
  function promptDelete(id, name) {
    setConfirmModal({ isOpen: true, id, name });
  }

  async function handleDelete() {
    const { id } = confirmModal;
    setConfirmModal({ isOpen: false, id: null, name: '' });
    try {
      const res = await fetch(`/api/product-names/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete product name');
      setProducts((prev) => prev.filter((p) => p.id !== id));
      if (pendingEdits[id]) { const e = { ...pendingEdits }; delete e[id]; setPendingEdits(e); }
      const newSel = new Set(selectedIds); newSel.delete(id); setSelectedIds(newSel);
    } catch (err) { showAlert('Error', err.message); }
  }

  function handleCheckbox(e, productId, index) {
    const newSelected = new Set(selectedIds);
    if (e.nativeEvent.shiftKey && lastCheckedIndex !== null) {
      const start = Math.min(lastCheckedIndex, index);
      const end   = Math.max(lastCheckedIndex, index);
      const shouldSelect = !selectedIds.has(productId);
      for (let i = start; i <= end; i++) {
        if (paginatedProducts[i]) {
          if (shouldSelect) newSelected.add(paginatedProducts[i].id);
          else newSelected.delete(paginatedProducts[i].id);
        }
      }
    } else {
      if (newSelected.has(productId)) newSelected.delete(productId);
      else newSelected.add(productId);
    }
    setSelectedIds(newSelected);
    setLastCheckedIndex(index);
  }

  function handleSelectAll(e) {
    if (e.target.checked) setSelectedIds(new Set(paginatedProducts.map(p => p.id)));
    else setSelectedIds(new Set());
    setLastCheckedIndex(null);
  }

  async function handleBulkDelete() {
    setBulkDelConfirm(false); setSaving(true);
    try {
      const idsArray = Array.from(selectedIds);
      const res = await fetch(`/api/product-names/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsArray }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete selected product names');
      
      if (data.warning) {
        showAlert('Partial Success', data.warning);
      }
      
      await fetchProducts();
      setSelectedIds(new Set());
      setLastCheckedIndex(null);
    } catch (err) {
      showAlert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  // --- INLINE EDIT LOGIC ---
  function handleCellChange(id, field, value) {
    setPendingEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value }
    }));
  }

  function getDisplayValue(product, field = 'name') {
    if (pendingEdits[product.id] && pendingEdits[product.id][field] !== undefined) {
      return pendingEdits[product.id][field];
    }
    return product[field];
  }

  function hasPendingEdits() {
    return Object.keys(pendingEdits).length > 0;
  }

  async function saveAllEdits() {
    setSaving(true);
    let errorCount = 0;

    for (const [id, changes] of Object.entries(pendingEdits)) {
      try {
        const res = await fetch(`/api/product-names/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to update');
        }
      } catch (err) {
        showAlert('Error', `Error updating product name: ${err.message}`);
        errorCount++;
      }
    }

    if (errorCount === 0) {
      setPendingEdits({});
      await fetchProducts(); // Refresh
    }
    setSaving(false);
  }

  function discardEdits() {
    setPendingEdits({});
  }
  const [selectedClientFilter, setSelectedClientFilter] = useState(null);

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    
    let matchClient = true;
    if (selectedClientFilter) {
      if (selectedClientFilter.value === 'no_client') {
        matchClient = !p.client_id;
      } else {
        matchClient = p.client_id === selectedClientFilter.value;
      }
    }
    
    return matchSearch && matchClient;
  });

  const totalFiltered = filteredProducts.length;
  const paginatedProducts = filteredProducts.slice((page - 1) * limit, page * limit);

  const allOnPageSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selectedIds.has(p.id));
  const selectedCount = selectedIds.size;

  return (
    <div className="masters-page">
      <div className="toolbar" style={{ justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add Product List
          </button>
          <button className="btn btn-secondary" onClick={() => setShowCsvModal(true)}>
            Import Excel
          </button>
          <input
            type="text"
            className="toolbar-search"
            placeholder="Search product names..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <div style={{ width: '220px' }}>
            <Select 
              instanceId="toolbar-client-filter"
              options={clients} 
              isClearable 
              placeholder="Filter by Client..." 
              value={selectedClientFilter}
              onChange={(opt) => { setSelectedClientFilter(opt); setPage(1); }}
              styles={{ 
                control: (base) => ({ ...base, minHeight: '36px', height: '36px', fontSize: '13px' }),
                menu: (base) => ({ ...base, zIndex: 9999 }),
                option: (base, { data, isFocused, isSelected }) => {
                  if (data.isSpecial) {
                    return {
                      ...base,
                      backgroundColor: isFocused ? '#e2e8f0' : '#f0f2f5',
                      color: 'var(--text)',
                      fontWeight: '600',
                      borderBottom: '1px solid var(--border)'
                    };
                  }
                  return base;
                }
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <label className="editable-toggle">
            <input 
              type="checkbox" 
              checked={isEditable} 
              onChange={(e) => setIsEditable(e.target.checked)} 
            />
            Editable
          </label>
        </div>
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
          <span style={{ fontSize: '14px' }}>Showing {totalFiltered === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, totalFiltered)} of {totalFiltered}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn btn-secondary btn-sm" disabled={page * limit >= totalFiltered} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input type="checkbox" checked={allOnPageSelected} onChange={handleSelectAll} title="Select all on this page" />
              </th>
              <th style={{ width: '8%' }}>Sr. No.</th>
              <th style={{ width: '40%' }}>Product List</th>
              <th style={{ width: '40%' }}>Client Name</th>
              <th style={{ width: '12%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && products.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  Loading product names...
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No product names found.
                </td>
              </tr>
            ) : (
              paginatedProducts.map((product, index) => (
                <tr key={product.id} style={{ backgroundColor: selectedIds.has(product.id) ? 'var(--table-row-selected)' : undefined }}>
                  <td>
                    <input type="checkbox" checked={selectedIds.has(product.id)}
                      onChange={e => handleCheckbox(e, product.id, index)}
                      onClick={e => e.stopPropagation()} />
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{(page - 1) * limit + index + 1}</td>
                  <td className={pendingEdits[product.id]?.name !== undefined ? 'cell-edited' : ''}>
                    {isEditable ? (
                      <input
                        type="text"
                        className="form-input"
                        value={getDisplayValue(product, 'name')}
                        onChange={(e) => handleCellChange(product.id, 'name', e.target.value)}
                        style={{ padding: '4px 6px', fontSize: '13px' }}
                      />
                    ) : (
                      product.name
                    )}
                  </td>
                  <td className={pendingEdits[product.id]?.client_id !== undefined ? 'cell-edited' : ''}>
                    {isEditable ? (
                      <Select 
                        instanceId={`client-${product.id}`} 
                        options={clients} 
                        value={clients.find(c => c.value === getDisplayValue(product, 'client_id'))} 
                        onChange={val => handleCellChange(product.id, 'client_id', val?.value ?? null)} 
                        menuPortalTarget={typeof window !== 'undefined' ? document.body : null} 
                        styles={{ control: base => ({ ...base, minHeight: '32px', height: '32px', fontSize: '13px' }) }} 
                        isClearable 
                      />
                    ) : (
                      product.clients?.name || <span style={{ color: 'var(--text-muted)' }}>No Client</span>
                    )}
                  </td>
                  <td>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => promptDelete(product.id, product.name)}
                      disabled={isEditable && hasPendingEdits()}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
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
          <span style={{ fontSize: '14px' }}>Showing {totalFiltered === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, totalFiltered)} of {totalFiltered}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn btn-secondary btn-sm" disabled={page * limit >= totalFiltered} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </div>

      {/* Pagination Bar */}
      {hasPendingEdits() && (
        <div className="floating-save">
          <button className="btn btn-secondary" onClick={discardEdits} disabled={saving}>Discard</button>
          <button className="btn btn-primary" onClick={saveAllEdits} disabled={saving}>
            {saving ? 'Saving...' : `Save Changes (${Object.keys(pendingEdits).length} edits)`}
          </button>
        </div>
      )}

      {selectedCount > 0 && !hasPendingEdits() && (
        <div className="floating-save" style={{ gap: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{selectedCount} selected</span>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--btn-danger-bg)' }} onClick={() => setBulkDelConfirm(true)} disabled={saving}>Delete Selected</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedIds(new Set()); setLastCheckedIndex(null); }}>Clear</button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>Add Product List</h3>
            
            {modalError && <div className="form-error" style={{ marginBottom: '12px' }}>{modalError}</div>}
            
            <form onSubmit={handleAdd}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" htmlFor="new-name">
                  Product List <span className="required">*</span>
                </label>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" htmlFor="new-client">
                  Client Name (Optional)
                </label>
                <Select 
                  instanceId="new-client" 
                  options={clients} 
                  value={clients.find(c => c.value === newClientId)} 
                  onChange={val => setNewClientId(val?.value ?? null)} 
                  isClearable 
                  placeholder="Select Client..." 
                />
              </div>
              <input
                  id="new-name"
                  type="text"
                  className="form-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Label"
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={modalLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      <ExcelImportModal 
        isOpen={showCsvModal} 
        onClose={() => setShowCsvModal(false)} 
        entityName="Product Lists" 
        importEndpoint="/api/product-names/import"
        columnMap={{ 'product list': 'name', 'client name': 'client_name' }}
        uniqueColumnDisplay="product list"
        onSuccess={() => {
          fetchProducts();
        }}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete Product List"
        message={`Are you sure you want to delete "${confirmModal.name}"?\nIt will be safely moved to the Recycle Bin.`}
        confirmText="Delete" confirmColor="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmModal({ isOpen: false, id: null, name: '' })}
      />
      <ConfirmModal
        isOpen={bulkDelConfirm}
        title="Delete Selected Product Lists"
        message={`Delete ${selectedCount} selected product names? They will be moved to the Recycle Bin.`}
        confirmText="Delete All" confirmColor="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDelConfirm(false)}
      />

      <AlertModal
        isOpen={alertInfo.isOpen}
        title={alertInfo.title}
        message={alertInfo.message}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
      />
    </div>
  );
}
