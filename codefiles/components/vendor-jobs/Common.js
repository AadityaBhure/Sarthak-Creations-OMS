'use client';
import { useEffect, useRef, useState } from 'react';
import Select from 'react-select';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AlertModal from '@/components/ui/AlertModal';
import styles from './vendor-jobs.module.css';

export async function api(path, body) {
  const res = await fetch(
    `/api/vendor-jobs/${path}`,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const data = await res.json().catch(() => ({
    error: 'Your session may have expired. Refresh and sign in again.',
  }));
  if (!res.ok || data.error) {
    const error = new Error(data.error || 'Could not complete the request.');
    error.code = data.code;
    throw error;
  }
  return data;
}
export function useMasters(includeDeleted = false) {
  const [masters, setMasters] = useState({ vendors: [], jobs: [], papers: [], products: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function refresh() {
    setLoading(true);
    try {
      setMasters(
        await api('masters' + (includeDeleted ? '?includeDeleted=true' : '')),
      );
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  return { masters, loading, error, refresh };
}
export function MasterSelect({
  items = [],
  value,
  onChange,
  label,
  multi = false,
  disabled = false,
  compact = false,
  clearable = false,
  allowDeleted = false,
}) {
  const options = items.map((x) => ({
    value: x.id,
    label: x.name + (x.deleted_at ? ' (Deleted)' : ''),
    isDisabled: Boolean(x.deleted_at) && !allowDeleted,
  }));
  return (
    <Select
      aria-label={label}
      instanceId={label}
      isMulti={multi}
      isClearable={clearable}
      isDisabled={disabled}
      options={options}
      value={
        multi
          ? options.filter((o) => (value || []).includes(o.value))
          : options.find((o) => o.value === value) || null
      }
      onChange={(v) => onChange(multi ? v.map((o) => o.value) : v?.value || '')}
      placeholder={`Select ${label}...`}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      styles={{
        control: (b) => ({
          ...b,
          minWidth: 160,
          minHeight: compact ? 32 : 38,
          height: multi ? undefined : compact ? 32 : 38,
          fontSize: compact ? 13 : 14,
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
          boxShadow: 'none',
        }),
        menu: (b) => ({ ...b, backgroundColor: 'var(--bg-surface)' }),
        menuPortal: (b) => ({ ...b, zIndex: 100000 }),
        singleValue: (b) => ({ ...b, color: 'var(--text-primary)' }),
        valueContainer: (b) => ({
          ...b,
          padding: compact ? '0px 8px' : '2px 8px',
        }),
        dropdownIndicator: (b) => ({
          ...b,
          padding: compact ? '0px 4px' : b.padding,
        }),
        input: (b) => ({ ...b, color: 'var(--text-primary)' }),
        option: (b, s) => ({
          ...b,
          backgroundColor: s.isFocused
            ? 'var(--table-row-hover)'
            : 'var(--bg-surface)',
          color: 'var(--text-primary)',
        }),
        multiValue: (b) => ({
          ...b,
          backgroundColor: 'var(--table-header-bg)',
        }),
        multiValueLabel: (b) => ({ ...b, color: 'var(--text-primary)' }),
      }}
    />
  );
}
// Same 32px table select / 26px badge treatment as the Order List.
export function TableSelect({
  label,
  items,
  value,
  onChange,
  disabled = false,
  badge = false,
}) {
  const completed = value === 'Completed';
  const background = value === 'Hold' ? 'var(--badge-approval-bg)' : value === 'Canceled' ? 'var(--status-red-bg, #fee2e2)' : completed
    ? 'var(--badge-completed-bg)'
    : 'var(--badge-design-bg)';
  const color = value === 'Hold' ? 'var(--badge-approval-text)' : value === 'Canceled' ? 'var(--status-red-text, #991b1b)' : completed
    ? 'var(--badge-completed-text)'
    : 'var(--badge-design-text)';
  return (
    <Select
      aria-label={label}
      instanceId={label}
      options={items}
      value={items.find((o) => o.value === value) || null}
      isDisabled={disabled}
      onChange={(o) => onChange(o?.value || '')}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      styles={{
        control: (b) => ({
          ...b,
          minWidth: badge ? 140 : 160,
          minHeight: badge ? 26 : 32,
          height: badge ? 26 : 32,
          fontSize: badge ? 12 : 13,
          fontWeight: badge ? 600 : 400,
          backgroundColor: badge ? background : 'var(--bg-surface)',
          borderColor: badge ? 'transparent' : 'var(--border)',
          borderRadius: badge ? 12 : b.borderRadius,
          boxShadow: 'none',
          cursor: 'pointer',
        }),
        menu: (b) => ({
          ...b,
          backgroundColor: 'var(--bg-surface)',
          zIndex: 9999,
        }),
        menuPortal: (b) => ({ ...b, zIndex: 100000 }),
        option: (b, s) => ({
          ...b,
          backgroundColor: s.isFocused
            ? 'var(--table-row-hover)'
            : 'transparent',
          color: 'var(--text-primary)',
          cursor: 'pointer',
        }),
        singleValue: (b) => ({
          ...b,
          color: badge ? color : 'var(--text-primary)',
        }),
        input: (b) => ({ ...b, color: 'var(--text-primary)' }),
        valueContainer: (b) => ({
          ...b,
          padding: '0px 8px',
          height: badge ? 24 : 30,
        }),
        indicatorsContainer: (b) => ({ ...b, height: badge ? 24 : 30 }),
        dropdownIndicator: (b) => ({
          ...b,
          padding: '0px 4px',
          color: badge ? color : b.color,
        }),
        indicatorSeparator: (b) => (badge ? { display: 'none' } : b),
      }}
    />
  );
}
export function useDialogs() {
  const [question, setQuestion] = useState(null);
  const resolver = useRef(null);
  const [alert, setAlert] = useState(null);
  function confirm(message, title = 'Confirm', confirmText = 'Confirm', confirmColor = 'primary') {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setQuestion({ message, title, confirmText, confirmColor });
    });
  }
  function answer(value) {
    resolver.current?.(value);
    resolver.current = null;
    setQuestion(null);
  }
  useEffect(() => () => resolver.current?.(false), []);
  const dialogs = (
    <>
      <ConfirmModal
        isOpen={Boolean(question)}
        {...question}
        onConfirm={() => answer(true)}
        onCancel={() => answer(false)}
      />
      <AlertModal
        isOpen={Boolean(alert)}
        title="Vendor Job Tracking"
        message={alert || ''}
        onClose={() => setAlert(null)}
      />
    </>
  );
  return { confirm, notify: setAlert, dialogs };
}
export function useUnsaved(dirty) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}
export function Pagination({
  page,
  limit,
  total,
  onPage,
  onLimit,
  disabled = false,
}) {
  return (
    <div className={`${styles.pagination} no-print`}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 14 }}>Rows per page:</span>
        <select
          aria-label="Rows per page"
          className="form-input"
          style={{ padding: '4px 8px', fontSize: 13, width: 'auto' }}
          value={limit}
          disabled={disabled}
          onChange={(e) => onLimit(Number(e.target.value))}
        >
          {[25, 50, 100, 200].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 14 }}>
          Showing {total ? (page - 1) * limit + 1 : 0} to{' '}
          {Math.min(page * limit, total)} of {total}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={disabled || page === 1}
            onClick={() => onPage(page - 1)}
          >
            Previous
          </button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={disabled || page * limit >= total}
            onClick={() => onPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export function dateTime(value) {
  return value
    ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' })
    : '—';
}
export function localInput(value) {
  if (!value) return '';
  const d = new Date(value);
  return new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 19);
}
export function inputTimestamp(value) {
  return value ? new Date(`${value}+05:30`).toISOString() : '';
}
export function VendorJobFields({
  masters,
  value,
  onChange,
  disabled = false,
}) {
  const vendor = masters.vendors.find((v) => v.id === value.vendor_id);
  const capable = masters.jobs.filter((j) =>
    vendor?.capabilities.includes(j.id),
  );
  // Capability membership is guidance, not an unapproved strict restriction.
  const items = [
    ...capable,
    ...masters.jobs.filter((j) => !vendor?.capabilities.includes(j.id)),
  ];
  return (
    <>
      <div className="form-group">
        <label className="form-label">Vendor *</label>
        <MasterSelect
          label="Vendor"
          items={masters.vendors}
          value={value.vendor_id}
          disabled={disabled}
          onChange={(id) => onChange({ ...value, vendor_id: id })}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Job Type *</label>
        <MasterSelect
          label="Job Type"
          items={items}
          value={value.job_type_id}
          disabled={disabled}
          onChange={(id) => onChange({ ...value, job_type_id: id })}
        />
        {vendor && (
          <small className={styles.note}>
            Capabilities:{' '}
            {capable.map((j) => j.name).join(', ') || 'Not specified'}
          </small>
        )}
      </div>
    </>
  );
}
