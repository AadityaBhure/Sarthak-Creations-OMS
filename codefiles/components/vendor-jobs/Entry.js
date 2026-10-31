'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  useMasters,
  useDialogs,
  useUnsaved,
  MasterSelect,
  VendorJobFields,
  localInput,
} from './Common';
import styles from './vendor-jobs.module.css';
const empty = {
  job_title: '',
  product_type_id: null,
  quantity: '',
  paper_type_id: '',
  vendor_id: '',
  job_type_id: '',
  remarks: '',
};
export default function Entry() {
  const { masters, loading, error, refresh: refreshMasters } = useMasters();
  const [draft, setDraft] = useState(empty);
  const [defaults, setDefaults] = useState(null);
  const [defaultsLoading, setDefaultsLoading] = useState(true);
  const [number, setNumber] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const { notify, confirm, dialogs } = useDialogs();
  const router = useRouter();
  useUnsaved(
    JSON.stringify(draft) !== JSON.stringify(empty) ||
      Boolean(
        defaults &&
        (number !== defaults.job_card_number ||
          entryDate !== localInput(defaults.created_at).slice(0, 10)),
      ),
  );
  async function loadDefaults(resetDate = true) {
    setDefaultsLoading(true);
    try {
      const data = await api('cards');
      setDefaults(data);
      setNumber(data.job_card_number);
      if (resetDate) setEntryDate(localInput(data.created_at).slice(0, 10));
    } finally {
      setDefaultsLoading(false);
    }
  }
  useEffect(() => {
    loadDefaults().catch((e) => setFormError(e.message));
  }, []);
  async function save(e) {
    e.preventDefault();
    const another = e.nativeEvent.submitter?.value === 'another';
    setBusy(true);
    setFormError('');
    try {
      const created_at =
        entryDate === localInput(defaults.created_at).slice(0, 10)
          ? defaults.created_at
          : new Date(entryDate + 'T00:00:00+05:30').toISOString();
      const payload = {
        ...draft,
        quantity: Number(draft.quantity.replace(/,/g, '')),
        created_at,
        ...(number === defaults.job_card_number
          ? { expected_number: number }
          : { job_card_number: number }),
      };
      let row;
      try {
        row = await api('cards', payload);
      } catch (err) {
        if (err.code === 'NUMBER_CHANGED') {
          await loadDefaults(false);
          throw err;
        }
        if (err.code !== 'DUPLICATE_NUMBER') throw err;
        if (
          !(await confirm(
            err.message,
            'Duplicate Job Card Number',
            'Continue Anyway',
          ))
        )
          return;
        row = await api('cards', { ...payload, confirm_duplicate: true });
      }
      setDraft(empty);
      if (another) {
        await loadDefaults();
        notify(row.job_card_number + ' created.');
      } else router.push('/vendor-jobs/active');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="masters-page" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          New Job Card
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Create a new vendor job. Select from your existing master lists.
        </p>
      </div>
      {(error || formError) && (
        <div className="form-error" role="alert" style={{ marginBottom: 20 }}>
          {formError || error}
        </div>
      )}
      {loading || defaultsLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading form data...</p>
      ) : !defaults || error ? (
        <button
          className="btn btn-secondary"
          onClick={() => {
            setFormError('');
            refreshMasters();
            loadDefaults().catch((e) => setFormError(e.message));
          }}
        >
          Retry loading form
        </button>
      ) : (
        <form className={styles.form} onSubmit={save}>
          <label className="form-group">
            <span className="form-label">Count</span>
            <input className="form-input" aria-label="Count" value="Assigned automatically on save" readOnly />
          </label>
          <div className={styles.grid}>
            <label className="form-group">
              <span className="form-label">
                Date of Entry <span className="required">*</span>
              </span>
              <input
                aria-label="Date of Entry"
                type="date"
                className="form-input"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
                disabled={busy}
              />
            </label>
            <label className="form-group">
              <span className="form-label">
                Job Card Number <span className="required">*</span>
              </span>
              <input
                aria-label="Job Card Number"
                className="form-input"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
                maxLength={100}
                disabled={busy}
              />
            </label>
          </div>
          <div className={styles.grid}>
            <VendorJobFields
              masters={masters}
              value={draft}
              onChange={setDraft}
              disabled={busy}
            />
          </div>
          <div className={styles.grid}>
            <label className="form-group">
              <span className="form-label">Job Title</span>
              <input aria-label="Job Title" className="form-input" placeholder="Nickname for this job (optional)" maxLength={200} value={draft.job_title} disabled={busy} onChange={e => setDraft({ ...draft, job_title: e.target.value })} />
            </label>
            <div className="form-group">
              <label className="form-label">Product Type</label>
              <MasterSelect label="Product Type" items={masters.products} value={draft.product_type_id} disabled={busy} clearable onChange={id => setDraft({ ...draft, product_type_id: id || null })} />
              <small>Optional. Uses the Product Types master in Client Progress Tracking.</small>
            </div>
          </div>
          <div className={styles.grid}>
            <div className="form-group">
              <label className="form-label">
                Paper Type <span className="required">*</span>
              </label>
              <MasterSelect
                label="Paper Type"
                items={masters.papers}
                value={draft.paper_type_id}
                disabled={busy}
                onChange={(id) => setDraft({ ...draft, paper_type_id: id })}
              />
            </div>
            <label className="form-group">
              <span className="form-label">
                Quantity <span className="required">*</span>
              </span>
              <input
                aria-label="Quantity"
                className="form-input"
                placeholder="Enter qty"
                required
                inputMode="numeric"
                value={draft.quantity}
                disabled={busy}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setDraft({
                    ...draft,
                    quantity: raw ? Number(raw).toLocaleString('en-IN') : '',
                  });
                }}
              />
            </label>
          </div>
          <label className="form-group">
            <span className="form-label">Remarks</span>
            <textarea
              className="form-textarea"
              placeholder="Any optional notes or details..."
              style={{ minHeight: 80 }}
              disabled={busy}
              value={draft.remarks}
              onChange={(e) => setDraft({ ...draft, remarks: e.target.value })}
            />
          </label>
          <div
            style={{
              display: 'flex',
              gap: 12,
              marginTop: 16,
              borderTop: '1px solid var(--border)',
              paddingTop: 20,
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => router.push('/vendor-jobs/active')}
            >
              Cancel
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                disabled={busy || Boolean(error)}
                value="another"
              >
                Save & Add Another
              </button>
              <button
                className="btn btn-primary"
                disabled={busy || Boolean(error)}
                value="save"
              >
                {busy ? 'Saving...' : 'Save Job Card'}
              </button>
            </div>
          </div>
        </form>
      )}
      {dialogs}
    </div>
  );
}
