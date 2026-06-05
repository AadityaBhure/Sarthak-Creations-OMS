'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local preferences
  const [theme, setTheme] = useState('light');
  const [density, setDensity] = useState('comfortable');

  // Extreme Warning Modal for Status Deletion
  const [authModal, setAuthModal] = useState({ isOpen: false, statusToDelete: null, password: '', statusName: '', agreement: '', verifying: false });

  useEffect(() => {
    // Load global settings from API
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setSettings(data);
        }
        setLoading(false);
      });

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
      alert("Failed to save settings: " + e.message);
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
  function addStatus() {
    const name = prompt("Enter new status name:");
    if (!name || name.trim() === '') return;
    if (settings.status_options.includes(name.trim())) {
      alert("Status already exists.");
      return;
    }
    const nextArr = [...settings.status_options, name.trim()];
    saveGlobalSettings({ ...settings, status_options: nextArr });
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
        alert("Incorrect login password.");
        setAuthModal(prev => ({ ...prev, verifying: false }));
        return;
      }

      // 2. Exact string match check
      if (statusName !== statusToDelete) {
        alert("Status name does not match.");
        setAuthModal(prev => ({ ...prev, verifying: false }));
        return;
      }

      // 3. Agreement string check
      if (agreement !== "I understand deleteing this while there may be active orders can break the software") {
        alert("Agreement text does not match exactly.");
        setAuthModal(prev => ({ ...prev, verifying: false }));
        return;
      }

      // Passed!
      const nextArr = settings.status_options.filter(s => s !== statusToDelete);
      saveGlobalSettings({ ...settings, status_options: nextArr });
      setAuthModal({ isOpen: false, statusToDelete: null, password: '', statusName: '', agreement: '', verifying: false });

    } catch (e) {
      alert("Failed to verify credentials: " + e.message);
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
            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>Recycle Bin Auto-Purge (Days)</label>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', maxWidth: '500px' }}>
            {settings?.status_options?.map((s, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-page)', padding: '10px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <span style={{ fontWeight: '500', fontSize: '14px' }}>{s}</span>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--btn-danger-bg)' }} onClick={() => promptDeleteStatus(s)}>Remove</button>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={addStatus}>+ Add New Status</button>
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

    </div>
  );
}
