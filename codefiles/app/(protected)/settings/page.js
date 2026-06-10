'use client';

import { useState, useEffect } from 'react';
import AlertModal from '@/components/ui/AlertModal';
import { useGlobalSettings } from '@/components/SettingsProvider';

export default function SettingsPage() {
  const { settings, setSettings, loading } = useGlobalSettings();
  const [saving, setSaving] = useState(false);

  // Local preferences
  const [theme, setTheme] = useState('light');
  const [density, setDensity] = useState('comfortable');

  // Logs Export
  const [logDates, setLogDates] = useState({ from: '', to: '' });

  // Extreme Warning Modal for Status Deletion
  const [authModal, setAuthModal] = useState({ isOpen: false, statusToDelete: null, password: '', statusName: '', agreement: '', verifying: false });
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });
  const [addPrompt, setAddPrompt] = useState({ isOpen: false, value: '' });
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [editingStatusIdx, setEditingStatusIdx] = useState(null);
  const [editingStatusValue, setEditingStatusValue] = useState('');

  useEffect(() => {
    // Trigger background logs cleanup
    fetch('/api/logs/cleanup').catch(console.error);

    // Load local preferences
    setTheme(localStorage.getItem('oms-theme') || 'light');
    setDensity(localStorage.getItem('oms-density') || 'comfortable');
  }, []);

  async function saveGlobalSettings(newSettings) {
    setSaving(true);
    setSettings(newSettings); // Optimistic UI update
    
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
    } catch (e) {
      setAlertInfo({ isOpen: true, title: 'Error', message: 'Failed to save settings: ' + e.message });
    }
    setSaving(false);
  }

  // --- Handlers for Local Preferences ---
  function handleThemeChange(newTheme) {
    setTheme(newTheme);
    localStorage.setItem('oms-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }

  function handleDensityChange(newDensity) {
    setDensity(newDensity);
    localStorage.setItem('oms-density', newDensity);
    document.documentElement.setAttribute('data-density', newDensity);
  }

  // --- Handlers for Status Array ---
  function handleAddStatusClick() {
    setAddPrompt({ isOpen: true, value: '' });
  }

  function confirmAddStatus() {
    const name = addPrompt.value;
    if (!name || name.trim() === '') {
      setAddPrompt({ isOpen: false, value: '' });
      return;
    }
    const exists = settings.status_options.find(s => (typeof s === 'string' ? s : s.name) === name.trim());
    if (exists) {
      setAlertInfo({ isOpen: true, title: 'Error', message: 'Status already exists.' });
      return;
    }
    const nextArr = [...settings.status_options, { name: name.trim(), bg: '#f3f4f6', text: '#4b5563' }];
    saveGlobalSettings({ ...settings, status_options: nextArr });
    setAddPrompt({ isOpen: false, value: '' });
  }

  function handleColorChange(idx, field, val) {
    const nextArr = [...settings.status_options];
    const current = nextArr[idx];
    nextArr[idx] = typeof current === 'string' 
      ? { name: current, bg: '#f3f4f6', text: '#4b5563', [field]: val } 
      : { ...current, [field]: val };
    setSettings({ ...settings, status_options: nextArr });
  }

  function saveColors() {
    saveGlobalSettings(settings);
  }

  // --- Drag & Drop for Status Options ---
  function handleDragStart(e, idx) {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, idx) {
    e.preventDefault();
  }

  function handleDrop(e, idx) {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;

    const nextArr = [...settings.status_options];
    const draggedItem = nextArr[draggedIdx];
    nextArr.splice(draggedIdx, 1);
    nextArr.splice(idx, 0, draggedItem);
    
    saveGlobalSettings({ ...settings, status_options: nextArr });
    setDraggedIdx(null);
  }

  // --- Editing Status Name ---
  function startEditingStatus(idx, currentName) {
    setEditingStatusIdx(idx);
    setEditingStatusValue(currentName);
  }

  async function saveEditedStatusName(idx, oldName) {
    const newName = editingStatusValue.trim();
    if (!newName || newName === oldName) {
      setEditingStatusIdx(null);
      return;
    }
    if (settings.status_options.find((s, i) => i !== idx && (typeof s === 'string' ? s : s.name) === newName)) {
      setAlertInfo({ isOpen: true, title: 'Error', message: 'Status already exists.' });
      return;
    }

    setSaving(true);
    try {
      // Run the migration via an API route
      const res = await fetch('/api/orders/migrate-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName })
      });
      if (!res.ok) throw new Error('Failed to migrate existing orders');

      const nextArr = [...settings.status_options];
      const current = nextArr[idx];
      nextArr[idx] = typeof current === 'string'
        ? { name: newName, bg: '#f3f4f6', text: '#4b5563' }
        : { ...current, name: newName };

      await saveGlobalSettings({ ...settings, status_options: nextArr });
    } catch (e) {
      setAlertInfo({ isOpen: true, title: 'Error', message: e.message });
    } finally {
      setEditingStatusIdx(null);
      setSaving(false);
    }
  }

  function promptDeleteStatus(statusName) {
    setAuthModal({ isOpen: true, statusToDelete: statusName, password: '', statusName: '', agreement: '', verifying: false });
  }

  async function executeDeleteStatus() {
    const { statusToDelete, password, statusName, agreement } = authModal;
    
    setAuthModal(prev => ({ ...prev, verifying: true }));

    try {
      // 1. Password Check (Login Password)
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const authData = await res.json();
      
      if (!res.ok || !authData.success) {
        setAlertInfo({ isOpen: true, title: 'Error', message: 'Incorrect login password.' });
        setAuthModal(prev => ({ ...prev, verifying: false }));
        return;
      }

      // 2. Exact string match check
      if (statusName !== statusToDelete) {
        setAlertInfo({ isOpen: true, title: 'Error', message: 'Status name does not match.' });
        setAuthModal(prev => ({ ...prev, verifying: false }));
        return;
      }

      // 3. Agreement string check
      if (agreement !== "I understand deleteing this while there may be active orders can break the software") {
        setAlertInfo({ isOpen: true, title: 'Error', message: 'Agreement text does not match exactly.' });
        setAuthModal(prev => ({ ...prev, verifying: false }));
        return;
      }

      // Passed!
      const nextArr = settings.status_options.filter(s => (typeof s === 'string' ? s : s.name) !== statusToDelete);
      saveGlobalSettings({ ...settings, status_options: nextArr });
      setAuthModal({ isOpen: false, statusToDelete: null, password: '', statusName: '', agreement: '', verifying: false });

    } catch (e) {
      setAlertInfo({ isOpen: true, title: 'Error', message: 'Failed to verify credentials: ' + e.message });
      setAuthModal(prev => ({ ...prev, verifying: false }));
    }
  }

  if (loading) return <div className="masters-page"><p>Loading settings...</p></div>;

  return (
    <div className="masters-page" style={{ paddingBottom: '100px', maxWidth: '900px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Settings & Administration</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Configure system-wide rules and personal display preferences.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '32px' }}>
        
        {/* ======================= SECTION 1: DATA & SYSTEM ======================= */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>1. Data & System</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>
                  Recycle Bin Retention (Days)
                </label>
                <input 
                  type="number" 
                  className="form-input" 
                  style={{ width: '100%', maxWidth: '200px' }}
                  value={settings?.recycle_retention_days || 10}
                  onChange={(e) => saveGlobalSettings({ ...settings, recycle_retention_days: parseInt(e.target.value) || 10 })}
                />
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
                  Records in the Recycle Bin will be permanently erased after this duration.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>
                  Activity Logs Retention (Days)
                </label>
                <input 
                  type="number" 
                  className="form-input" 
                  style={{ width: '100%', maxWidth: '200px' }}
                  value={settings?.log_retention_days || 30}
                  onChange={(e) => saveGlobalSettings({ ...settings, log_retention_days: parseInt(e.target.value) || 30 })}
                />
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
                  System activity logs will be automatically purged after this duration to save space.
                </p>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>Default Pagination Size</label>
              <select 
                className="form-input" 
                style={{ width: '100%', maxWidth: '200px' }}
                value={settings?.default_pagination || 50}
                onChange={(e) => saveGlobalSettings({ ...settings, default_pagination: parseInt(e.target.value) || 50 })}
              >
                <option value={25}>25 Rows</option>
                <option value={50}>50 Rows</option>
                <option value={100}>100 Rows</option>
                <option value={200}>200 Rows</option>
              </select>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
                Default number of rows loaded per page across master lists and order lists.
              </p>
            </div>
          </div>

          <div style={{ marginTop: '32px', padding: '20px', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <h4 style={{ fontWeight: '600', marginBottom: '6px', fontSize: '15px' }}>Full Database Backup</h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>
              Download a single .zip archive containing all active Orders, Completed Orders, Clients, and Products formatted as raw CSV files.
            </p>
            <a href="/api/export-database" download className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
              Download Global Export (.zip)
            </a>
          </div>

          <div style={{ marginTop: '24px', padding: '20px', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <h4 style={{ fontWeight: '600', marginBottom: '6px', fontSize: '15px' }}>Activity Logs Export</h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>
              Download a detailed CSV record of all system activities. Select a date range or leave empty to download everything.
            </p>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-secondary)' }}>From Date</label>
                <input type="date" className="form-input" style={{ padding: '6px 12px' }} value={logDates.from} onChange={e => setLogDates({ ...logDates, from: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-secondary)' }}>To Date</label>
                <input type="date" className="form-input" style={{ padding: '6px 12px' }} value={logDates.to} onChange={e => setLogDates({ ...logDates, to: e.target.value })} />
              </div>
              <div style={{ alignSelf: 'flex-end', marginBottom: '2px' }}>
                <a href={`/api/logs/export?from=${logDates.from}&to=${logDates.to}`} download className="btn btn-primary" style={{ textDecoration: 'none' }}>
                  Download Logs (CSV)
                </a>
              </div>
            </div>
          </div>
        </div>


        {/* ======================= SECTION 2: COMPANY CONFIGURATION ======================= */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>2. Company Configuration (Print Headers)</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>Print Header Name</label>
              <input 
                type="text" 
                className="form-input" 
                style={{ width: '100%' }}
                value={settings?.print_header_name || ''}
                onChange={(e) => saveGlobalSettings({ ...settings, print_header_name: e.target.value })}
                placeholder="e.g. Sarthak Creations"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>Print Header Address</label>
              <input 
                type="text" 
                className="form-input" 
                style={{ width: '100%' }}
                value={settings?.print_header_address || ''}
                onChange={(e) => saveGlobalSettings({ ...settings, print_header_address: e.target.value })}
                placeholder="e.g. 123 Industrial Area, Mumbai"
              />
            </div>
          </div>
        </div>

        {/* ======================= SECTION 3: STATUS CUSTOMIZATION ======================= */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>3. Active Status Options</h3>
          
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
            These are the status options actively being used in the system lifecycle. Be extremely careful when deleting a status, as it may break historical orders that rely on it.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', maxWidth: '600px' }}>
            {settings?.status_options?.map((s, idx) => {
              const sName = typeof s === 'string' ? s : s.name;
              const sBg = typeof s === 'string' ? '#f3f4f6' : (s.bg || '#f3f4f6');
              const sText = typeof s === 'string' ? '#4b5563' : (s.text || '#4b5563');

              return (
                <div 
                  key={idx}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: draggedIdx === idx ? 'var(--bg-hover)' : 'var(--bg-page)', padding: '10px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', opacity: draggedIdx === idx ? 0.5 : 1 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ cursor: 'grab', color: 'var(--text-muted)' }} title="Drag to reorder">☰</span>
                    {editingStatusIdx === idx ? (
                      <input
                        type="text"
                        className="form-input"
                        value={editingStatusValue}
                        onChange={(e) => setEditingStatusValue(e.target.value)}
                        onBlur={() => saveEditedStatusName(idx, sName)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditedStatusName(idx, sName);
                          if (e.key === 'Escape') setEditingStatusIdx(null);
                        }}
                        autoFocus
                        style={{ padding: '4px 8px', width: '150px' }}
                      />
                    ) : (
                      <span onDoubleClick={() => startEditingStatus(idx, sName)} style={{ cursor: 'pointer', fontWeight: '600', fontSize: '13px', padding: '4px 8px', borderRadius: '4px', backgroundColor: sBg, color: sText, textTransform: 'uppercase', letterSpacing: '0.5px' }} title="Double click to edit">
                        {sName}
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        Bg: <input type="color" value={sBg} onChange={e => handleColorChange(idx, 'bg', e.target.value)} onBlur={saveColors} style={{ width: '24px', height: '24px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        Text: <input type="color" value={sText} onChange={e => handleColorChange(idx, 'text', e.target.value)} onBlur={saveColors} style={{ width: '24px', height: '24px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                      </label>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEditingStatus(idx, sName)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--btn-danger-bg)' }} onClick={() => promptDeleteStatus(sName)}>Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="btn btn-secondary" onClick={handleAddStatusClick}>+ Add New Status</button>
        </div>

        {/* ======================= SECTION 4: PERSONALIZATION ======================= */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>4. Personalization & UI (Local to this browser)</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>Color Theme</label>
              <select className="form-input" style={{ width: '100%', maxWidth: '200px' }} value={theme} onChange={(e) => handleThemeChange(e.target.value)}>
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>Table Density</label>
              <select className="form-input" style={{ width: '100%', maxWidth: '200px' }} value={density} onChange={(e) => handleDensityChange(e.target.value)}>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact (Dense)</option>
              </select>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
                Compact density fits more rows on smaller laptop screens by reducing cell padding and font-size.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* EXTREME WARNING MODAL FOR DELETING STATUS */}
      {authModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '100%' }}>
            <h3 style={{ color: 'var(--btn-danger-bg)', marginBottom: '16px', fontSize: '20px' }}>DANGER: Delete Active Status</h3>
            <p style={{ fontSize: '15px', marginBottom: '24px', lineHeight: '1.5' }}>
              You are about to delete the status <strong style={{ background: 'var(--bg-page)', padding: '2px 6px', border: '1px solid var(--border)' }}>{authModal.statusToDelete}</strong>. 
              Doing this while there are active or completed orders using this status may break the software.
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>1. Enter your System Login Password</label>
              <input 
                type="password" 
                className="form-input" 
                style={{ width: '100%' }}
                placeholder="Verify your identity..."
                value={authModal.password} 
                onChange={e => setAuthModal({...authModal, password: e.target.value})} 
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                2. Type the name of the status exactly: <em style={{ color: 'var(--text-secondary)' }}>{authModal.statusToDelete}</em>
              </label>
              <input 
                type="text" 
                className="form-input" 
                style={{ width: '100%' }}
                placeholder={authModal.statusToDelete}
                value={authModal.statusName} 
                onChange={e => setAuthModal({...authModal, statusName: e.target.value})} 
              />
            </div>

            <div style={{ marginBottom: '32px' }}>
              <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>3. Type the following agreement exactly:</label>
              <div style={{ 
                background: 'var(--bg-page)', 
                color: 'var(--text-primary)', 
                padding: '12px', 
                fontSize: '14px', 
                marginBottom: '12px', 
                fontFamily: 'monospace',
                border: '1px dashed var(--border-input)',
                borderRadius: 'var(--radius)'
              }}>
                I understand deleteing this while there may be active orders can break the software
              </div>
              <input 
                type="text" 
                className="form-input" 
                style={{ width: '100%', fontSize: '14px', fontFamily: 'monospace' }}
                placeholder="Type the agreement here..."
                value={authModal.agreement} 
                onChange={e => setAuthModal({...authModal, agreement: e.target.value})} 
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
              <button className="btn btn-ghost" onClick={() => setAuthModal({ isOpen: false, statusToDelete: null, password: '', statusName: '', agreement: '', verifying: false })} disabled={authModal.verifying}>Cancel</button>
              <button className="btn btn-danger" onClick={executeDeleteStatus} disabled={authModal.verifying}>
                {authModal.verifying ? 'Verifying...' : 'PERMANENTLY DELETE'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal isOpen={alertInfo.isOpen} title={alertInfo.title} message={alertInfo.message} onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })} />

      {addPrompt.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 99999 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h3 className="modal-title" style={{ marginTop: 0, fontSize: '18px', fontWeight: '600' }}>Add New Status</h3>
            <p style={{ margin: '12px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Enter the new status name.</p>
            <input type="text" className="form-input" placeholder="e.g. In Transit" value={addPrompt.value} onChange={e => setAddPrompt({ ...addPrompt, value: e.target.value })} autoFocus style={{ marginBottom: '16px', width: '100%', padding: '8px' }} />
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setAddPrompt({ isOpen: false, value: '' })}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmAddStatus} disabled={!addPrompt.value.trim()}>Add Status</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
