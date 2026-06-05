'use client';

import { useState, useEffect } from 'react';
import CsvImportModal from '@/components/csv/CsvImportModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AlertModal from '@/components/ui/AlertModal';
import { createBrowserClient } from '@/lib/supabaseClient';

export default function ClientList() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search and Filter
  const [search, setSearch] = useState('');
  
  // Editing state
  const [isEditable, setIsEditable] = useState(false);
  const [pendingEdits, setPendingEdits] = useState({}); // { id: { name, address } }
  const [saving, setSaving] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', address: '' });
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

  // Fetch clients on mount
  useEffect(() => {
    fetchClients(true);

    const supabase = createBrowserClient();
    const channel = supabase
      .channel('realtime-clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        fetchClients(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchClients(showLoader = true) {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch('/api/clients');
      if (!res.ok) throw new Error('Failed to fetch clients');
      const data = await res.json();
      setClients(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- ADD CLIENT LOGIC ---
  async function handleAddClient(e) {
    e.preventDefault();
    setModalError('');
    setModalLoading(true);

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add client');

      // Success
      setClients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowModal(false);
      setNewClient({ name: '', address: '' });
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
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete client');

      // Remove from UI
      setClients((prev) => prev.filter((c) => c.id !== id));
      
      // Clear from pending edits if it was being edited
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

  function getDisplayValue(client, field) {
    if (pendingEdits[client.id] && pendingEdits[client.id][field] !== undefined) {
      return pendingEdits[client.id][field];
    }
    return client[field] || '';
  }

  function hasPendingEdits() {
    return Object.keys(pendingEdits).length > 0;
  }

  async function saveAllEdits() {
    setSaving(true);
    let errorCount = 0;

    for (const [id, changes] of Object.entries(pendingEdits)) {
      try {
        const res = await fetch(`/api/clients/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to update');
        }
      } catch (err) {
        showAlert('Error', `Error updating client: ${err.message}`);
        errorCount++;
      }
    }

    if (errorCount === 0) {
      setPendingEdits({});
      await fetchClients(); // Refresh to ensure sync
    }
    setSaving(false);
  }

  function discardEdits() {
    setPendingEdits({});
  }

  // Filter clients based on search
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.address && c.address.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="masters-page">
      {/* Toolbar */}
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add Client
          </button>
          <button className="btn btn-secondary" onClick={() => setShowCsvModal(true)}>
            Import CSV
          </button>
          <input
            type="text"
            className="toolbar-search"
            placeholder="Search clients..."
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

      {/* Table Area */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>Sr. No.</th>
              <th style={{ width: '30%' }}>Client Name</th>
              <th style={{ width: '50%' }}>Address</th>
              <th style={{ width: '15%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && clients.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  Loading clients...
                </td>
              </tr>
            ) : filteredClients.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No clients found.
                </td>
              </tr>
            ) : (
              filteredClients.map((client, index) => (
                <tr key={client.id}>
                  <td style={{ color: 'var(--text-secondary)' }}>{index + 1}</td>
                  <td className={pendingEdits[client.id]?.name !== undefined ? 'cell-edited' : ''}>
                    {isEditable ? (
                      <input
                        type="text"
                        className="form-input"
                        value={getDisplayValue(client, 'name')}
                        onChange={(e) => handleCellChange(client.id, 'name', e.target.value)}
                        style={{ padding: '4px 6px', fontSize: '13px' }}
                      />
                    ) : (
                      client.name
                    )}
                  </td>
                  <td className={pendingEdits[client.id]?.address !== undefined ? 'cell-edited' : ''}>
                    {isEditable ? (
                      <input
                        type="text"
                        className="form-input"
                        value={getDisplayValue(client, 'address')}
                        onChange={(e) => handleCellChange(client.id, 'address', e.target.value)}
                        style={{ padding: '4px 6px', fontSize: '13px' }}
                        placeholder="No address"
                      />
                    ) : (
                      client.address || <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => promptDelete(client.id, client.name)}
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
          <button className="btn btn-secondary" onClick={discardEdits} disabled={saving}>
            Discard
          </button>
          <button className="btn btn-primary" onClick={saveAllEdits} disabled={saving}>
            {saving ? 'Saving...' : `Save Changes (${Object.keys(pendingEdits).length} edits)`}
          </button>
        </div>
      )}

      {/* Add Client Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>Add New Client</h3>
            
            {modalError && <div className="form-error" style={{ marginBottom: '12px' }}>{modalError}</div>}
            
            <form onSubmit={handleAddClient}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" htmlFor="new-client-name">
                  Client Name <span className="required">*</span>
                </label>
                <input
                  id="new-client-name"
                  type="text"
                  className="form-input"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  placeholder="e.g., Reliance Packaging"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" htmlFor="new-client-address">
                  Address
                </label>
                <textarea
                  id="new-client-address"
                  className="form-textarea"
                  value={newClient.address}
                  onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                  placeholder="Street, City, PIN"
                  style={{ minHeight: '60px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={modalLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Save Client'}
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
        entityName="Clients" 
        importEndpoint="/api/clients/import"
        columnMap={{ 'client name': 'name', 'client address': 'address' }}
        uniqueColumnDisplay="client name"
        onSuccess={() => {
          fetchClients();
          setShowCsvModal(false);
        }}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete Client"
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
