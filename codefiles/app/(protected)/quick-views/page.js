'use client';

import { useState, useEffect } from 'react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AlertModal from '@/components/ui/AlertModal';
import { createBrowserClient } from '@/lib/supabaseClient';

export default function QuickViewsPage() {
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isEditable, setIsEditable] = useState(false);
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null, name: '' });
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });

  function showAlert(title, message) {
    setAlertInfo({ isOpen: true, title, message });
  }

  useEffect(() => {
    fetchViews(true);

    const supabase = createBrowserClient();
    const channel = supabase
      .channel('realtime-quick-views')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quick_views' }, () => {
        fetchViews(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchViews(showLoader = true) {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch('/api/quick-views');
      if (!res.ok) throw new Error('Failed to fetch quick views');
      const data = await res.json();
      setViews(data);
    } catch (err) {
      setError(err.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  function handleCellChange(id, field, value) {
    setPendingEdits(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  }

  function getDisplayValue(view, field) {
    if (pendingEdits[view.id] && pendingEdits[view.id][field] !== undefined) {
      return pendingEdits[view.id][field];
    }
    return view[field];
  }

  function hasPendingEdits() {
    return Object.keys(pendingEdits).length > 0;
  }

  async function saveAllEdits() {
    setSaving(true);
    let errorCount = 0;

    for (const [id, changes] of Object.entries(pendingEdits)) {
      try {
        const res = await fetch(`/api/quick-views/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to update');
        }
      } catch (err) {
        showAlert('Error', `Error updating view: ${err.message}`);
        errorCount++;
      }
    }

    if (errorCount === 0) {
      setPendingEdits({});
      await fetchViews();
    }
    setSaving(false);
  }

  function discardEdits() {
    setPendingEdits({});
  }

  function promptDelete(id, name) {
    setConfirmModal({ isOpen: true, id, name });
  }

  async function handleDelete() {
    const { id } = confirmModal;
    setConfirmModal({ isOpen: false, id: null, name: '' });

    try {
      const res = await fetch(`/api/quick-views/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');

      setViews(prev => prev.filter(v => v.id !== id));
      if (pendingEdits[id]) {
        const newEdits = { ...pendingEdits };
        delete newEdits[id];
        setPendingEdits(newEdits);
      }
    } catch (err) {
      showAlert('Error', err.message);
    }
  }

  return (
    <div className="masters-page">
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>Manage Global Quick Views</h2>
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
              <th style={{ width: '40px' }}>Sr.</th>
              <th>View Name</th>
              <th>Module</th>
              <th>Rules Count</th>
              <th style={{ width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  Loading quick views...
                </td>
              </tr>
            ) : views.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No quick views created yet. Create them from the Orders page.
                </td>
              </tr>
            ) : (
              views.map((view, index) => {
                const nameVal = getDisplayValue(view, 'name');
                const filterCount = Array.isArray(view.filters) ? view.filters.length : 0;

                return (
                  <tr key={view.id}>
                    <td style={{ color: 'var(--text-secondary)' }}>{index + 1}</td>
                    
                    <td className={pendingEdits[view.id]?.name !== undefined ? 'cell-edited' : ''}>
                      {isEditable ? (
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '4px 8px', width: '100%' }}
                          value={nameVal} 
                          onChange={e => handleCellChange(view.id, 'name', e.target.value)} 
                        />
                      ) : (
                        <span style={{ fontWeight: 600 }}>{nameVal}</span>
                      )}
                    </td>

                    <td>
                      <span className="badge" style={{ backgroundColor: '#e2e8f0', color: '#334155' }}>
                        {view.module}
                      </span>
                    </td>

                    <td style={{ color: 'var(--text-secondary)' }}>
                      {filterCount} rules
                    </td>

                    <td>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        onClick={() => promptDelete(view.id, view.name)}
                        disabled={isEditable && hasPendingEdits()}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
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

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete Quick View"
        message={`Are you sure you want to delete the view "${confirmModal.name}"? This will remove it for all users.`}
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
