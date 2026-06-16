'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Select from 'react-select';
import AlertModal from '@/components/ui/AlertModal';
import { useGlobalSettings } from '@/components/SettingsProvider';

export default function NewOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });

  function showAlert(title, message) {
    setAlertInfo({ isOpen: true, title, message });
  }

  const { settings, loading: settingsLoading } = useGlobalSettings();
  const STATUS_OPTIONS = settings?.status_options?.map(s => {
    const name = typeof s === 'string' ? s : s.name;
    return { value: name, label: name };
  }) || [];

  // Master Data Options
  const [clients, setClients] = useState([]);
  const [productNames, setProductNames] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [executives, setExecutives] = useState([]);

  // Target Date Input mode
  const [targetInputMode, setTargetInputMode] = useState('days'); // 'days' or 'date'
  const [targetDays, setTargetDays] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    date_of_entry: new Date().toISOString().split('T')[0],
    po_number: '',
    client_id: null, // Select option object
    product_name_id: null,
    product_type_id: null,
    quantity: '',
    status: null,
    executive_id: null,
    target_date: '',
    remark: ''
  });

  useEffect(() => {
    if (STATUS_OPTIONS.length > 0 && !formData.status) {
      setFormData(prev => ({ ...prev, status: STATUS_OPTIONS[0] }));
    }
  }, [settingsLoading]);

  useEffect(() => {
    async function fetchMasters() {
      try {
        const [clientRes, pNamesRes, pTypesRes, execRes] = await Promise.all([
          fetch('/api/clients'),
          fetch('/api/product-names'),
          fetch('/api/product-types'),
          fetch('/api/executives')
        ]);

        if (!clientRes.ok || !pNamesRes.ok || !pTypesRes.ok || !execRes.ok) {
          throw new Error('Failed to load master data');
        }

        const clientData = await clientRes.json();
        const pNamesData = await pNamesRes.json();
        const pTypesData = await pTypesRes.json();
        const execData = await execRes.json();

        setClients(clientData.map(c => ({ value: c.id, label: c.name })));
        setProductNames(pNamesData.map(p => ({ value: p.id, label: p.name, client_id: p.client_id })));
        setProductTypes(pTypesData.map(p => ({ value: p.id, label: p.name })));
        setExecutives(execData.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name} (${e.username})` })));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchMasters();
  }, []);

  async function handleSubmit(e, isSaveAndAddAnother) {
    e.preventDefault();
    setError('');
    
    if (!formData.client_id || !formData.product_name_id || !formData.product_type_id) {
      setError('Please select Client, Product List, and Product Type.');
      return;
    }

    setSaving(true);
    
    try {
      // Calculate target date if mode is days
      let finalTargetDate = formData.target_date;
      if (targetInputMode === 'days' && targetDays) {
        const d = new Date(formData.date_of_entry);
        d.setDate(d.getDate() + parseInt(targetDays, 10));
        finalTargetDate = d.toISOString().split('T')[0];
      }

      const payload = {
        date_of_entry: formData.date_of_entry,
        po_number: formData.po_number,
        client_id: formData.client_id.value,
        product_name_id: formData.product_name_id.value,
        product_type_id: formData.product_type_id.value,
        quantity: parseInt(String(formData.quantity).replace(/,/g, ''), 10) || 0,
        status: formData.status.value,
        executive_id: formData.executive_id ? formData.executive_id.value : null,
        target_date: finalTargetDate || null,
        remark: formData.remark
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');

      if (isSaveAndAddAnother) {
        setFormData({
          ...formData,
          po_number: '',
          quantity: '',
          remark: '',
          executive_id: null,
          target_date: ''
        });
        setTargetDays('');
        window.scrollTo(0, 0);
        showAlert('Success', 'Order saved successfully!');
      } else {
        router.push('/orders');
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // React-Select custom styles to match vanilla CSS theme
  const selectStyles = {
    control: (base) => ({
      ...base,
      minHeight: '38px',
      backgroundColor: 'var(--bg-surface)',
      borderColor: 'var(--border)',
      boxShadow: 'none',
      '&:hover': { borderColor: 'var(--border-focus)' }
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      zIndex: 9999
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? 'var(--table-row-hover)' : 'transparent',
      color: 'var(--text-primary)',
      cursor: 'pointer',
      '&:active': { backgroundColor: 'var(--border)' }
    }),
    singleValue: (base) => ({
      ...base,
      color: 'var(--text-primary)'
    }),
    input: (base) => ({
      ...base,
      color: 'var(--text-primary)',
      margin: 0,
      padding: 0
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '2px 8px'
    })
  };

  if (loading || settingsLoading) {
    return (
      <div className="masters-page">
        <p style={{ color: 'var(--text-muted)' }}>Loading form data...</p>
      </div>
    );
  }

  return (
    <div className="masters-page" style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>New Order</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Create a new production order. Select from your existing master lists.
        </p>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '20px' }}>{error}</div>}

      <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Date of Entry <span className="required">*</span></label>
            <input 
              type="date" 
              className="form-input" 
              value={formData.date_of_entry}
              onChange={e => setFormData({ ...formData, date_of_entry: e.target.value })}
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">PO Number <span className="required">*</span></label>
            <input 
              type="text" 
              className="form-input" 
              value={formData.po_number}
              onChange={e => setFormData({ ...formData, po_number: e.target.value })}
              placeholder="Enter PO Num"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Client Name <span className="required">*</span></label>
          <Select 
            options={clients} 
            styles={selectStyles}
            value={formData.client_id}
            onChange={val => setFormData({ ...formData, client_id: val, product_name_id: null })}
            placeholder="Search Client..."
            isClearable
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Product List <span className="required">*</span></label>
            <Select 
              options={productNames.filter(p => !p.client_id || p.client_id === formData.client_id?.value)} 
              styles={selectStyles}
              value={formData.product_name_id}
              onChange={val => setFormData({ ...formData, product_name_id: val })}
              placeholder={formData.client_id ? "Search Product List..." : "Select Client First"}
              isClearable
              isDisabled={!formData.client_id}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Product Type <span className="required">*</span></label>
            <Select 
              options={productTypes} 
              styles={selectStyles}
              value={formData.product_type_id}
              onChange={val => setFormData({ ...formData, product_type_id: val })}
              placeholder="Search Product Type..."
              isClearable
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Quantity <span className="required">*</span></label>
            <input 
              type="text" 
              className="form-input" 
              value={formData.quantity}
              onChange={e => {
                const rawVal = e.target.value.replace(/[^0-9]/g, '');
                if (!rawVal) {
                  setFormData({ ...formData, quantity: '' });
                  return;
                }
                const formatted = Number(rawVal).toLocaleString('en-IN');
                setFormData({ ...formData, quantity: formatted });
              }}
              placeholder="Enter qty"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Initial Status <span className="required">*</span></label>
            <Select 
              options={STATUS_OPTIONS} 
              styles={selectStyles}
              value={formData.status}
              onChange={val => setFormData({ ...formData, status: val })}
              isClearable={false}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Assigned Executive</label>
            <Select 
              options={executives} 
              styles={selectStyles}
              value={formData.executive_id}
              onChange={val => setFormData({ ...formData, executive_id: val })}
              placeholder="Assign to..."
              isClearable
            />
          </div>
          
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Target Overdue</label>
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                <button 
                  type="button" 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: targetInputMode === 'days' ? 'var(--primary-color)' : 'var(--text-muted)', fontWeight: targetInputMode === 'days' ? '600' : '400' }}
                  onClick={() => setTargetInputMode('days')}
                >
                  Days
                </button>
                <span style={{ color: 'var(--border)' }}>|</span>
                <button 
                  type="button" 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: targetInputMode === 'date' ? 'var(--primary-color)' : 'var(--text-muted)', fontWeight: targetInputMode === 'date' ? '600' : '400' }}
                  onClick={() => setTargetInputMode('date')}
                >
                  Date
                </button>
              </div>
            </div>
            
            {targetInputMode === 'days' ? (
              <input 
                type="number" 
                className="form-input" 
                value={targetDays}
                onChange={e => setTargetDays(e.target.value)}
                placeholder="Number of days from Entry Date"
                min="0"
              />
            ) : (
              <input 
                type="date" 
                className="form-input" 
                value={formData.target_date}
                onChange={e => setFormData({ ...formData, target_date: e.target.value })}
              />
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Remark</label>
          <textarea 
            className="form-textarea" 
            value={formData.remark}
            onChange={e => setFormData({ ...formData, remark: e.target.value })}
            placeholder="Any optional notes or details..."
            style={{ minHeight: '80px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={() => router.push('/orders')}
            disabled={saving}
          >
            Cancel
          </button>
          
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={(e) => handleSubmit(e, true)}
              disabled={saving}
            >
              Save & Add Another
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              onClick={(e) => handleSubmit(e, false)}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Order'}
            </button>
          </div>
        </div>
      </form>
      <AlertModal
        isOpen={alertInfo.isOpen}
        title={alertInfo.title}
        message={alertInfo.message}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
      />
    </div>
  );
}
