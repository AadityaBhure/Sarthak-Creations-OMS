'use client';

import { useState, useEffect } from 'react';
import CsvImportModal from '@/components/csv/CsvImportModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AlertModal from '@/components/ui/AlertModal';
import { createBrowserClient } from '@/lib/supabaseClient';

export default function ProductNamesList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search
  const [search, setSearch] = useState('');
  
  // Editing state
  const [isEditable, setIsEditable] = useState(false);
  const [pendingEdits, setPendingEdits] = useState({}); // { id: { name } }
  const [saving, setSaving] = useState(false);

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
      const res = await fetch('/api/product-names');
      if (!res.ok) throw new Error('Failed to fetch product names');
      const data = await res.json();
      setProducts(data);
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
        body: JSON.stringify({ name: newName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add product name');

      setProducts((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowModal(false);
      setNewName('');
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
      if (pendingEdits[id]) {
        const newEdits = { ...pendingEdits };
        delete newEdits[id];
        setPendingEdits(newEdits);
      }
    } catch (err) {
      showAlert('Error', err.message);
    }
  }

  // --- INLINE EDIT LOGIC ---
  function handleCellChange(id, value) {
    setPendingEdits((prev) => ({
      ...prev,
      [id]: { name: value }
    }));
  }

  function getDisplayValue(product) {
    if (pendingEdits[product.id] && pendingEdits[product.id].name !== undefined) {
      return pendingEdits[product.id].name;
    }
    return product.name;
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

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="masters-page">
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add Product Name
          </button>
          <button className="btn btn-secondary" onClick={() => setShowCsvModal(true)}>
            Import CSV
          </button>
          <input
            type="text"
            className="toolbar-search"
            placeholder="Search product names..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '10%' }}>Sr. No.</th>
              <th style={{ width: '70%' }}>Product Name</th>
              <th style={{ width: '20%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && products.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  Loading product names...
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No product names found.
                </td>
              </tr>
            ) : (
              filteredProducts.map((product, index) => (
                <tr key={product.id}>
                  <td style={{ color: 'var(--text-secondary)' }}>{index + 1}</td>
                  <td className={pendingEdits[product.id] !== undefined ? 'cell-edited' : ''}>
                    {isEditable ? (
                      <input
                        type="text"
                        className="form-input"
                        value={getDisplayValue(product)}
                        onChange={(e) => handleCellChange(product.id, e.target.value)}
                        style={{ padding: '4px 6px', fontSize: '13px' }}
                      />
                    ) : (
                      product.name
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

      {hasPendingEdits() && (
        <div className="floating-save">
          <button className="btn btn-secondary" onClick={discardEdits} disabled={saving}>
            Discard
          </button>
          <button className="btn btn-primary" onClick={saveAllEdits} disabled={saving}>
            {saving ? 'Saving...' : `Save Changes (${Object.keys(pendingEdits).length} edits)`}
          </button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>Add Product Name</h3>
            
            {modalError && <div className="form-error" style={{ marginBottom: '12px' }}>{modalError}</div>}
            
            <form onSubmit={handleAdd}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" htmlFor="new-name">
                  Product Name <span className="required">*</span>
                </label>
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

      {/* CSV Import Modal */}
      <CsvImportModal 
        isOpen={showCsvModal} 
        onClose={() => setShowCsvModal(false)} 
        entityName="Product Names" 
        importEndpoint="/api/product-names/import"
        columnMap={{ 'product name': 'name' }}
        uniqueColumnDisplay="product name"
        onSuccess={() => {
          fetchProducts();
          setShowCsvModal(false);
        }}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete Product Name"
        message={`Are you sure you want to delete "${confirmModal.name}"?\nIt will be safely moved to the Recycle Bin.`}
        confirmText="Delete"
        confirmColor="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmModal({ isOpen: false, id: null, name: '' })}
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
