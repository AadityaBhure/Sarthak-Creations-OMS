'use client';
import { useEffect, useState } from 'react';
import { FIELDS, OPERATORS } from '@/lib/vendor-jobs/domain.mjs';
import { MasterSelect, TableSelect } from './Common';
import styles from './vendor-jobs.module.css';
export default function Filters({
  rules,
  onChange,
  masters,
  disabled,
  context = 'active',
  fields = FIELDS,
  allowDeleted = false,
}) {
  const [views, setViews] = useState([]);
  const [current, setCurrent] = useState('custom');
  const [name, setName] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const module = 'vendor_jobs_' + context;
  async function load() {
    try {
      const r = await fetch('/api/quick-views?module=' + module);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setViews(d);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [module]);
  function edit(next) {
    setCurrent('custom');
    onChange(next);
  }
  function change(i, key, value) {
    edit(
      rules.map((r, n) => {
        if (n !== i) return r;
        if (key === 'column') {
          const f = fields.find((f) => (f.filter || f.key) === value);
          return {
            column: value,
            operator: OPERATORS[f.type][0][0],
            value: '',
            logic: r.logic,
          };
        }
        return { ...r, [key]: value };
      }),
    );
  }
  function add() {
    edit([
      ...rules,
      { column: 'job_card_number', operator: 'eq', value: '', logic: 'and' },
    ]);
  }
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/quick-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, module, filters: rules }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await load();
      setCurrent(d.id);
      setName(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="card no-print" style={{ marginBottom: 16, padding: 16 }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: rules.length ? 16 : 0,
        }}
      >
        <strong style={{ fontSize: 14 }}>Quick Views:</strong>
        <div style={{ width: 250 }}>
          <TableSelect
            label="Quick View"
            disabled={disabled}
            items={[
              { value: 'custom', label: 'Custom View' },
              ...views.map((v) => ({ value: v.id, label: v.name })),
            ]}
            value={current}
            onChange={(v) => {
              setCurrent(v);
              onChange(
                v === 'custom' ? [] : views.find((x) => x.id === v).filters,
              );
            }}
          />
        </div>
        {current === 'custom' && rules.length > 0 && (
          <button
            className="btn btn-secondary btn-sm"
            disabled={disabled}
            onClick={() => setName('')}
          >
            Save as Quick View
          </button>
        )}
        {!rules.length && (
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 'auto' }}
            disabled={disabled}
            onClick={add}
          >
            + Add Filter Rule
          </button>
        )}
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {rules.map((r, i) => {
        const f = fields.find((f) => (f.filter || f.key) === r.column);
        return (
          <div className={styles.filter} key={i}>
            <div style={{ width: 200 }}>
              <TableSelect
                label={'Filter field ' + (i + 1)}
                disabled={disabled}
                items={fields.map((f) => ({
                  value: f.filter || f.key,
                  label: f.label,
                }))}
                value={r.column}
                onChange={(v) => change(i, 'column', v)}
              />
            </div>
            <div style={{ width: 150 }}>
              <TableSelect
                label={'Filter operator ' + (i + 1)}
                disabled={disabled}
                items={OPERATORS[f.type].map(([value, label]) => ({
                  value,
                  label,
                }))}
                value={r.operator}
                onChange={(v) => change(i, 'operator', v)}
              />
            </div>
            <div style={{ width: 200 }}>
              {f.master ? (
                <MasterSelect
                  compact
                  allowDeleted={allowDeleted}
                  label={'Filter value ' + (i + 1)}
                  items={masters[f.master]}
                  value={r.value}
                  disabled={disabled}
                  onChange={(v) => change(i, 'value', v)}
                />
              ) : f.type === 'select' ? (
                <TableSelect
                  label={'Filter value ' + (i + 1)}
                  disabled={disabled}
                  items={[
                    { value: 'Active', label: 'Active' },
                    { value: 'Completed', label: 'Completed' },
                    { value: 'Hold', label: 'Hold' },
                    { value: 'Canceled', label: 'Canceled' },
                  ]}
                  value={r.value}
                  onChange={(v) => change(i, 'value', v)}
                />
              ) : (
                <input
                  className="form-input"
                  style={{
                    height: 32,
                    padding: '4px 8px',
                    fontSize: 13,
                    width: '100%',
                  }}
                  aria-label={'Filter value ' + (i + 1)}
                  type={
                    f.type === 'date'
                      ? 'date'
                      : f.type === 'number'
                        ? 'number'
                        : 'text'
                  }
                  value={r.value}
                  disabled={disabled}
                  onChange={(e) => change(i, 'value', e.target.value)}
                />
              )}
            </div>
            {r.operator === 'between' && (
              <>
                <span>to</span>
                <input
                  className="form-input"
                  style={{ height: 32 }}
                  aria-label={'Filter end ' + (i + 1)}
                  type={f.type === 'date' ? 'date' : 'number'}
                  value={r.valueTo ?? ''}
                  disabled={disabled}
                  onChange={(e) => change(i, 'valueTo', e.target.value)}
                />
              </>
            )}
            <button
              className="btn btn-ghost btn-sm"
              aria-label={'Remove filter ' + (i + 1)}
              style={{ padding: '4px 8px', color: 'var(--btn-danger-bg)' }}
              disabled={disabled}
              onClick={() => edit(rules.filter((_, n) => n !== i))}
            >
              ✕
            </button>
            {i < rules.length - 1 && (
              <select
                className="form-input"
                aria-label={'Filter logic ' + (i + 1)}
                style={{
                  height: 32,
                  width: 100,
                  fontWeight: 600,
                  marginLeft: 16,
                }}
                value={r.logic}
                disabled={disabled}
                onChange={(e) => change(i, 'logic', e.target.value)}
              >
                <option value="and">AND</option>
                <option value="or">OR</option>
              </select>
            )}
          </div>
        );
      })}
      {rules.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={disabled}
            onClick={add}
          >
            + Add Rule
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={disabled}
            onClick={() => edit([])}
          >
            Clear All
          </button>
        </div>
      )}
      {name !== null && (
        <div className="modal-overlay">
          <form
            className="modal-content"
            style={{ maxWidth: 400 }}
            onSubmit={save}
          >
            <h3>Save Quick View</h3>
            <label className="form-label">
              View Name
              <input
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={saving}
              />
            </label>
            {error && <div className="form-error">{error}</div>}
            <div className={styles.actions}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => setName(null)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" disabled={saving}>
                Save View
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
