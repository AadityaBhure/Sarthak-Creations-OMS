'use client';

import { useState, useEffect } from 'react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AlertModal from '@/components/ui/AlertModal';
import { createBrowserClient } from '@/lib/supabaseClient';
import { useGlobalSettings } from '@/components/SettingsProvider';

export default function ExecutiveList() {
  const [executives, setExecutives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { settings, loading: settingsLoading } = useGlobalSettings();
  
  // Search and Filter
  const [search, setSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    if (settings && !settingsLoading) setLimit(settings.default_pagination || 50);
  }, [settingsLoading, settings]);
  
  // Editing state
  const [isEditable, setIsEditable] = useState(false);
  const [pendingEdits, setPendingEdits] = useState({}); // { id: { first_name, last_name, phone_number } }
  const [saving, setSaving] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newExec, setNewExec] = useState({ first_name: '', last_name: '', phone_number: '', password: '' });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });

  function showAlert(title, message) {
    setAlertInfo({ isOpen: true, title, message });
  }

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null, name: '' });

  // Fetch on mount
  useEffect(() => {
    fetchExecutives(true);

    const supabase = createBrowserClient();
    const channel = supabase
      .channel('realtime-executives')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchExecutives(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchExecutives(showLoader = true) {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch('/api/executives');
      if (!res.ok) throw new Error('Failed to fetch executives');
      const data = await res.json();
      setExecutives(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- ADD LOGIC ---
  async function handleAddExec(e) {
    e.preventDefault();
    setModalError('');
    setModalLoading(true);

    try {
      const res = await fetch('/api/executives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExec),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add executive');

      // Success
      setExecutives((prev) => [...prev, data].sort((a, b) => a.first_name.localeCompare(b.first_name)));
      setShowModal(false);
      setNewExec({ first_name: '', last_name: '', phone_number: '', password: '' });
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
      const res = await fetch(`/api/executives/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete executive');

      setExecutives((prev) => prev.filter((c) => c.id !== id));
      
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
  function handleCellChange(id, field, value) {
    setPendingEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  }

  function getDisplayValue(exec, field) {
    if (pendingEdits[exec.id] && pendingEdits[exec.id][field] !== undefined) {
      return pendingEdits[exec.id][field];
    }
    return exec[field] || '';
  }

  function hasPendingEdits() {
    return Object.keys(pendingEdits).length > 0;
  }

  async function saveAllEdits() {
    setSaving(true);
    let errorCount = 0;

    for (const [id, changes] of Object.entries(pendingEdits)) {
      try {
        const res = await fetch(`/api/executives/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to update');
        }
      } catch (err) {
        showAlert('Error', `Error updating executive: ${err.message}`);
        errorCount++;
      }
    }

    if (errorCount === 0) {
      setPendingEdits({});
      await fetchExecutives(); // Refresh to ensure sync
    }
    setSaving(false);
  }

  function discardEdits() {
    setPendingEdits({});
  }

  // Filter based on search
  const filteredExecs = executives.filter(c => 
    c.first_name.toLowerCase().includes(search.toLowerCase()) || 
    c.last_name.toLowerCase().includes(search.toLowerCase()) || 
    c.username.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone_number && c.phone_number.includes(search))
  );

  // Pagination slice
  const totalFiltered = filteredExecs.length;
  const paginatedExecs = filteredExecs.slice((page - 1) * limit, page * limit);

  return (
    <div className="masters-page">
      {/* Toolbar */}
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add Executive
          </button>
          <input
            type="text"
            className="toolbar-search"
            placeholder="Search executives..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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

      {/* Pagination Bar (Top) */}
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

      {/* Table Area */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>Sr. No.</th>
              <th style={{ width: '20%' }}>First Name</th>
              <th style={{ width: '20%' }}>Last Name</th>
              <th style={{ width: '20%' }}>Username</th>
              <th style={{ width: '20%' }}>Phone Number</th>
              <th style={{ width: '15%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && executives.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  Loading executives...
                </td>
              </tr>
            ) : filteredExecs.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No executives found.
                </td>
              </tr>
            ) : (
              paginatedExecs.map((exec, index) => (
                <tr key={exec.id}>
                  <td style={{ color: 'var(--text-secondary)' }}>{(page - 1) * limit + index + 1}</td>
                  
                  <td className={pendingEdits[exec.id]?.first_name !== undefined ? 'cell-edited' : ''}>
                    {isEditable ? (
                      <input
                        type="text"
                        className="form-input"
                        value={getDisplayValue(exec, 'first_name')}
                        onChange={(e) => handleCellChange(exec.id, 'first_name', e.target.value)}
                        style={{ padding: '4px 6px', fontSize: '13px' }}
                      />
                    ) : (
                      exec.first_name
                    )}
                  </td>
                  
                  <td className={pendingEdits[exec.id]?.last_name !== undefined ? 'cell-edited' : ''}>
                    {isEditable ? (
                      <input
                        type="text"
                        className="form-input"
                        value={getDisplayValue(exec, 'last_name')}
                        onChange={(e) => handleCellChange(exec.id, 'last_name', e.target.value)}
                        style={{ padding: '4px 6px', fontSize: '13px' }}
                      />
                    ) : (
                      exec.last_name
                    )}
                  </td>

                  <td>
                    <span style={{ color: 'var(--text-secondary)' }}>{exec.username}</span>
                  </td>
                  
                  <td className={pendingEdits[exec.id]?.phone_number !== undefined ? 'cell-edited' : ''}>
                    {isEditable ? (
                      <input
                        type="text"
                        className="form-input"
                        value={getDisplayValue(exec, 'phone_number')}
                        onChange={(e) => handleCellChange(exec.id, 'phone_number', e.target.value)}
                        style={{ padding: '4px 6px', fontSize: '13px' }}
                        placeholder="10 digit phone"
                      />
                    ) : (
                      exec.phone_number
                    )}
                  </td>

                  <td>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => promptDelete(exec.id, exec.username)}
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

      {/* Floating Save Bar for Inline Edits */}
      {hasPendingEdits() && (
        <div className="floating-save">
          <button className="btn btn-secondary" onClick={discardEdits} disabled={saving}>Discard</button>
          <button className="btn btn-primary" onClick={saveAllEdits} disabled={saving}>
            {saving ? 'Saving...' : `Save Changes (${Object.keys(pendingEdits).length} edits)`}
          </button>
        </div>
      )}

      {/* Add Executive Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>Add New Executive</h3>
            
            {modalError && <div className="form-error" style={{ marginBottom: '12px' }}>{modalError}</div>}
            
            <form onSubmit={handleAddExec}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-exec-firstname">
                    First Name <span className="required">*</span>
                  </label>
                  <input
                    id="new-exec-firstname"
                    type="text"
                    className="form-input"
                    value={newExec.first_name}
                    onChange={(e) => setNewExec({ ...newExec, first_name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-exec-lastname">
                    Last Name <span className="required">*</span>
                  </label>
                  <input
                    id="new-exec-lastname"
                    type="text"
                    className="form-input"
                    value={newExec.last_name}
                    onChange={(e) => setNewExec({ ...newExec, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" htmlFor="new-exec-phone">
                  Phone Number (10 Digits) <span className="required">*</span>
                </label>
                <input
                  id="new-exec-phone"
                  type="text"
                  className="form-input"
                  value={newExec.phone_number}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val.length <= 10) setNewExec({ ...newExec, phone_number: val });
                  }}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" htmlFor="new-exec-password">
                  Initial Password <span className="required">*</span>
                </label>
                <input
                  id="new-exec-password"
                  type="password"
                  className="form-input"
                  value={newExec.password}
                  onChange={(e) => setNewExec({ ...newExec, password: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={modalLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Save Executive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete Executive"
        message={`Are you sure you want to delete "@${confirmModal.name}"?`}
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
