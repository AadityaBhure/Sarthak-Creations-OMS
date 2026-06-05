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
  const [authModal, setAuthModal] = useState({ isOpen: false, statusToDelete: null, password: '', statusName: '', agreement: '' });

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
    setAuthModal({ isOpen: true, statusToDelete: statusName, password: '', statusName: '', agreement: '' });
  }

  function executeDeleteStatus() {
    const { statusToDelete, password, statusName, agreement } = authModal;
    
    // Auth Check
    if (password !== 'admin123') { // Simple hardcoded password for now, can be replaced with real auth check
      alert("Incorrect password.");
      return;
    }
    if (statusName !== statusToDelete) {
      alert("Status name does not match.");
      return;
    }
    if (agreement !== "I understand deleteing this while there may be active orders can break the software") {
      alert("Agreement text does not match exactly.");
      return;
    }

    // Passed!
    const nextArr = settings.status_options.filter(s => s !== statusToDelete);
    saveGlobalSettings({ ...settings, status_options: nextArr });
    setAuthModal({ ...authModal, isOpen: false });
  }

  if (loading) return <div className="masters-page"><p>Loading settings...</p></div>;

  return (
    <div className="masters-page" style={{ paddingBottom: '100px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Settings & Administration</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Configure system-wide rules and personal display preferences.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '48px', maxWidth: '800px' }}>
        
        {/* ======================= SECTION 1: DATA & SYSTEM ======================= */}
        <section>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>1. Data & System</h3>
          
          <div style={{ display: 'grid', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px' }}>Recycle Bin Auto-Purge (Days)</label>
              <input 
                type="number" 
                className="input" 
                style={{ width: '150px' }}
                value={settings?.recycle_retention_days || 10}
                onChange={(e) => saveGlobalSettings({ ...settings, recycle_retention_days: parseInt(e.target.value) || 10 })}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Deleted records will be permanently erased after this many days.</p>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px' }}>Default Pagination Size</label>
              <select 
                className="input" 
                style={{ width: '150px' }}
                value={settings?.default_pagination || 50}
                onChange={(e) => saveGlobalSettings({ ...settings, default_pagination: parseInt(e.target.value) || 50 })}
              >
                <option value={25}>25 Rows</option>
                <option value={50}>50 Rows</option>
                <option value={100}>100 Rows</option>
                <option value={200}>200 Rows</option>
              </select>
            </div>

            <div style={{ marginTop: '12px', padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <h4 style={{ fontWeight: '600', marginBottom: '4px' }}>Full Database Backup</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Download a single .zip file containing all Orders, Clients, and Products formatted as raw CSV files.</p>
              <a href="/api/export-database" download className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                Download Global Export (.zip)
              </a>
            </div>
          </div>
        </section>


        {/* ======================= SECTION 2: COMPANY CONFIGURATION ======================= */}
        <section>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>2. Company Configuration (Print Headers)</h3>
          
          <div style={{ display: 'grid', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px' }}>Print Header Name</label>
              <input 
                type="text" 
                className="input" 
                value={settings?.print_header_name || ''}
                onChange={(e) => saveGlobalSettings({ ...settings, print_header_name: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px' }}>Print Header Address</label>
              <input 
                type="text" 
                className="input" 
                value={settings?.print_header_address || ''}
                onChange={(e) => saveGlobalSettings({ ...settings, print_header_address: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* ======================= SECTION 3: STATUS CUSTOMIZATION ======================= */}
        <section>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>3. Status Customization</h3>
          
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            These statuses define the lifecycle of an order. Be extremely careful when deleting a status, as it may break historical orders that rely on it.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {settings?.status_options?.map((s, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <span style={{ fontWeight: '500' }}>{s}</span>
                <button className="btn btn-danger btn-sm" onClick={() => promptDeleteStatus(s)}>Delete</button>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={addStatus}>+ Add New Status</button>
        </section>

        {/* ======================= SECTION 4: PERSONALIZATION ======================= */}
        <section>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>4. Personalization & UI (Local)</h3>
          
          <div style={{ display: 'grid', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px' }}>Color Theme</label>
              <select className="input" style={{ width: '150px' }} value={theme} onChange={(e) => handleThemeChange(e.target.value)}>
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px' }}>Table Density</label>
              <select className="input" style={{ width: '150px' }} value={density} onChange={(e) => handleDensityChange(e.target.value)}>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact (Dense)</option>
              </select>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Compact density fits more rows on smaller screens by reducing cell padding.</p>
            </div>
          </div>
        </section>

      </div>

      {/* EXTREME WARNING MODAL FOR DELETING STATUS */}
      {authModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h3 style={{ color: 'var(--status-red-text)', marginBottom: '12px' }}>DANGER: Delete Status</h3>
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>
              You are about to delete the status <strong>"{authModal.statusToDelete}"</strong>. Doing this while there are active or completed orders using this status may break the software.
            </p>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>1. Enter Admin Password ("admin123" for now)</label>
              <input type="password" className="input" value={authModal.password} onChange={e => setAuthModal({...authModal, password: e.target.value})} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>2. Type the name of the status exactly: <em>{authModal.statusToDelete}</em></label>
              <input type="text" className="input" value={authModal.statusName} onChange={e => setAuthModal({...authModal, statusName: e.target.value})} />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>3. Type the following agreement exactly:</label>
              <div style={{ background: '#f5f5f5', color: '#333', padding: '6px 8px', fontSize: '12px', marginBottom: '8px', fontFamily: 'monospace' }}>
                I understand deleteing this while there may be active orders can break the software
              </div>
              <input type="text" className="input" value={authModal.agreement} onChange={e => setAuthModal({...authModal, agreement: e.target.value})} />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setAuthModal({ ...authModal, isOpen: false })}>Cancel</button>
              <button className="btn btn-danger" onClick={executeDeleteStatus}>PERMANENTLY DELETE</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
