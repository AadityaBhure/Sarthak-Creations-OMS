'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useGlobalSettings } from '@/components/SettingsProvider';
import { FIELDS } from '@/lib/vendor-jobs/domain.mjs';
import {
  api,
  useMasters,
  useDialogs,
  useUnsaved,
  MasterSelect,
  TableSelect,
  Pagination,
  dateTime,
} from './Common';
import Filters from './Filters';
import StageDialog from './StageDialog';
import Exports from './Exports';
import styles from './vendor-jobs.module.css';

export default function Tracking({ context = 'active' }) {
  const { masters, error: masterError } = useMasters();
  const { settings } = useGlobalSettings();
  const { confirm, notify, dialogs } = useDialogs();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(null);
  const limit = size || settings?.default_pagination || 50;
  const [filters, setFilters] = useState([]);
  const [sort, setSort] = useState({
    column: context === 'deleted' ? 'deleted_at' : 'created_at',
    direction: 'desc',
  });
  const [editable, setEditable] = useState(false);
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const lastChecked = useRef(null);
  const [columns, setColumns] = useState(FIELDS.map((f) => f.key));
  const [columnMenu, setColumnMenu] = useState(false);
  const [dialog, setDialog] = useState(null);
  const requestId = useRef(0);
  const dirty = Object.keys(edits).length > 0;
  useUnsaved(dirty || Boolean(dialog && dialog.mode !== 'view'));
  const active = context === 'active';
  const deleted = context === 'deleted';
  const title = deleted
    ? 'Deleted Job Cards'
    : active
      ? 'Vendor Job Tracking'
      : context === 'canceled' ? 'Canceled Jobs' : 'Completed Jobs';
  async function refresh() {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const data = await api('search', {
        page,
        limit,
        filters,
        sort,
        statusContext: context,
      });
      if (id !== requestId.current) return;
      setRows(data.data);
      setTotal(data.meta.totalRowCount);
      setError('');
      setSelected(new Set());
      lastChecked.current = null;
    } catch (e) {
      if (id === requestId.current) setError(e.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
    return () => {
      requestId.current++;
    };
  }, [page, limit, filters, sort, context]);
  // Active duration values refresh on a clock without replacing staged edits.
  useEffect(() => {
    if (!active || dirty || busy || dialog) return;
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [active, dirty, busy, dialog, page, limit, filters, sort]);
  function change(row, key, value) {
    setEdits((prev) => ({
      ...prev,
      [row.id]: { revision: row.revision, ...prev[row.id], [key]: value },
    }));
  }
  async function mutate(row, action, data = {}) {
    return api(`cards/${row.id}`, { action, revision: row.revision, ...data });
  }
  async function saveRow(id, edit) {
    const data = { ...edit };
    if (data.quantity !== undefined)
      data.quantity = Number(String(data.quantity).replace(/,/g, ''));
    const row = rows.find((r) => r.id === id);
    if ('vendor_id' in data || 'job_type_id' in data) {
      data.vendor_id = data.vendor_id ?? row.current_vendor_id;
      data.job_type_id = data.job_type_id ?? row.current_job_id;
    }
    try {
      await api(`cards/${id}`, { action: 'save', ...data });
    } catch (e) {
      if (e.code !== 'DUPLICATE_NUMBER') throw e;
      if (
        !(await confirm(
          e.message,
          'Duplicate Job Card Number',
          'Continue Anyway',
        ))
      )
        return false;
      await api(`cards/${id}`, {
        action: 'save',
        ...data,
        confirm_duplicate: true,
      });
    }
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    return true;
  }
  async function save() {
    setBusy(true);
    const failures = [];
    for (const [id, edit] of Object.entries(edits)) {
      try {
        await saveRow(id, edit);
      } catch (e) {
        failures.push(
          `${rows.find((r) => r.id === id)?.job_card_number || 'Job Card'}: ${e.message}`,
        );
      }
    }
    await refresh();
    setBusy(false);
    if (failures.length) notify(failures.join('\n'));
  }
  async function action(row, kind) {
    const messages = {
      delete: 'Move this Job Card and its complete history to the Recycle Bin?',
      restore: 'Restore this Job Card and its complete history?',
      purge:
        'Permanently delete this Job Card and its stage history? Vendor, Job Type and Paper Type masters will be kept.',
      complete:
        'Mark this Job Card Completed? Durations will stop until it is sent back to Active.',
    };
    if (
      !(await confirm(
        messages[kind],
        row.job_card_number,
        kind === 'purge' ? 'Delete Permanently' : 'Confirm',
      ))
    )
      return;
    setBusy(true);
    try {
      await mutate(row, kind);
      await refresh();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function bulk(kind) {
    if (
      !(await confirm(
        `${kind === 'purge' ? 'Permanently delete' : kind === 'complete' ? 'Complete' : kind === 'restore' ? 'Restore' : 'Move to Recycle Bin'} ${selected.size} selected Job Cards with their history?${kind === 'complete' ? '' : ''}`,
        'Selected Job Cards',
      ))
    )
      return;
    setBusy(true);
    const failures = [];
    for (const row of rows.filter((r) => selected.has(r.id))) {
      try {
        await mutate(row, kind);
      } catch (e) {
        failures.push(`${row.job_card_number}: ${e.message}`);
      }
    }
    await refresh();
    setBusy(false);
    if (failures.length) notify(failures.join('\n'));
  }
  function select(e, index) {
    const next = new Set(selected);
    const checked = e.target.checked;
    const start =
      e.nativeEvent.shiftKey && lastChecked.current !== null
        ? Math.min(index, lastChecked.current)
        : index;
    const end =
      e.nativeEvent.shiftKey && lastChecked.current !== null
        ? Math.max(index, lastChecked.current)
        : index;
    for (let i = start; i <= end; i++) {
      if (checked) next.add(rows[i].id);
      else next.delete(rows[i].id);
    }
    lastChecked.current = index;
    setSelected(next);
  }
  const locked = busy || dirty;
  function cell(row, key) {
    const edit = edits[row.id];
    const val = edit?.[key] !== undefined ? edit[key] : row[key];
    if (active && ['current_vendor', 'current_job'].includes(key)) {
      const vendor = key === 'current_vendor';
      const field = vendor ? 'vendor_id' : 'job_type_id';
      return (
        <TableSelect
          label={`${vendor ? 'Current Vendor' : 'Current Job'} ${row.job_card_number}`}
          items={(vendor ? masters.vendors : masters.jobs).map((m) => ({
            value: m.id,
            label: m.name,
          }))}
          value={
            edit?.[field] ??
            row[vendor ? 'current_vendor_id' : 'current_job_id']
          }
          disabled={busy}
          onChange={(v) => change(row, field, v)}
        />
      );
    }
    if (
      active &&
      editable &&
      ['job_card_number', 'job_title', 'product_type', 'quantity', 'remarks', 'paper_type'].includes(key)
    ) {
      if (key === 'product_type') {
        const items = masters.products || [];
        const options = row.product_type_id && !items.some(p => p.id === row.product_type_id)
          ? [...items, { id: row.product_type_id, name: row.product_type || 'Unavailable Product Type', deleted_at: 'deleted' }] : items;
        return <MasterSelect label={`Product Type ${row.job_card_number}`} items={options} value={edit && 'product_type_id' in edit ? edit.product_type_id : row.product_type_id} disabled={busy} clearable onChange={v => change(row, 'product_type_id', v || null)} />;
      }
      if (key === 'paper_type')
        return (
          <MasterSelect
            label={`Paper Type ${row.id}`}
            items={masters.papers}
            value={edit?.paper_type_id || row.paper_type_id}
            disabled={busy}
            onChange={(v) => change(row, 'paper_type_id', v)}
          />
        );
      if (key === 'remarks')
        return (
          <textarea
            aria-label={`Remarks ${row.job_card_number}`}
            className="form-input"
            disabled={busy}
            value={val}
            onChange={(e) => change(row, key, e.target.value)}
          />
        );
      return (
        <input
          aria-label={`${key === 'quantity' ? 'Quantity' : key === 'job_title' ? 'Job Title' : 'Job Card Number'} ${row.job_card_number}`}
          maxLength={key === 'job_title' ? 200 : undefined}
          className="form-input"
          value={val ?? ''}
          disabled={busy}
          onChange={(e) =>
            change(
              row,
              key,
              key === 'quantity'
                ? e.target.value.replace(/[^0-9]/g, '')
                : e.target.value,
            )
          }
        />
      );
    }
    if (key === 'status') {
      if (!deleted)
        return (
          <TableSelect
            label={`Status ${row.job_card_number}`}
            badge
            disabled={busy}
            value={edit?.status || row.status}
            items={active ? [
              { value: 'Active', label: active ? 'Active' : 'Send to Active' },
              { value: 'Hold', label: 'Hold' },
              {
                value: 'Completed',
                label: active ? 'Mark Completed' : 'Completed',
              },
              { value: 'Canceled', label: 'Cancel Job' },
            ] : [
              { value: row.status, label: row.status },
              { value: 'Active', label: 'Send to Active' },
            ]}
            onChange={(v) => change(row, 'status', v)}
          />
        );

      return (
        <span
          className={`${styles.status} ${row.status === 'Completed' ? styles.completed : ''}`}
        >
          {row.status}
        </span>
      );
    }
    if (key === 'created_at') return dateTime(row.created_at);
    if (key === 'quantity') return row.quantity.toLocaleString('en-IN');
    if (key === 'vendor_history')
      return (
        <div className={styles.history}>
          {row.vendor_history}
          <div>
            <button
              className="btn btn-ghost btn-sm"
              disabled={busy || dirty}
              onClick={() =>
                setDialog({
                  card: row,
                  mode: active && editable ? 'sequence' : 'view',
                })
              }
            >
              {active && editable ? 'Edit Sequence' : 'View History & Times'}
            </button>
          </div>
        </div>
      );
    return val ?? '—';
  }
  return (
    <div className="masters-page">
      <div
        className="toolbar"
        style={{ justifyContent: 'space-between', marginBottom: 16 }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {active && (
            <Link className="btn btn-primary" href="/vendor-jobs/new">
              + New Job Card
            </Link>
          )}
          <Exports
            {...{ rows, selected, columns, title, settings }}
            disabled={locked || loading}
          />
          <button
            className="btn btn-secondary btn-sm"
            disabled={locked || loading}
            onClick={refresh}
          >
            Refresh
          </button>
        </div>
        <div className={styles.right}>
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setColumnMenu(!columnMenu)}
            >
              Columns ▾
            </button>
            {columnMenu && (
              <div
                className={styles.panel}
                style={{
                  position: 'absolute',
                  right: 0,
                  zIndex: 100,
                  minWidth: 220,
                }}
              >
                {FIELDS.map((f) => (
                  <label key={f.key} style={{ display: 'block' }}>
                    <input
                      type="checkbox"
                      checked={columns.includes(f.key)}
                      onChange={() =>
                        setColumns((prev) =>
                          prev.includes(f.key)
                            ? prev.length > 1
                              ? prev.filter((k) => k !== f.key)
                              : prev
                            : [...prev, f.key],
                        )
                      }
                    />{' '}
                    {f.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          {active && (
            <label className="editable-toggle">
              <input
                type="checkbox"
                checked={editable}
                disabled={busy}
                onChange={async (e) => {
                  const next = e.target.checked;
                  if (!next && dirty) {
                    if (!(await confirm('Discard unsaved Job Card changes?')))
                      return;
                    setEdits({});
                  }
                  setEditable(next);
                }}
              />{' '}
              Editable
            </label>
          )}
        </div>
      </div>
      {!active && (
        <p className={styles.note}>
          {deleted
            ? 'Job Card history is retained together. Automatic purge is not enabled while the policy is pending.'
            : context === 'canceled'
              ? 'Durations stop at cancellation. Use Status to send a job back to Active. Time spent Canceled is excluded from durations.'
              : 'Durations stop at completion. Use Status to send a job back to Active. Time spent Completed is excluded from durations.'}
        </p>
      )}
      <Filters
        context={context}
        rules={filters}
        masters={masters}
        disabled={locked}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />
      {(error || masterError) && (
        <div className="banner banner-error" role="alert">
          {error || masterError}
        </div>
      )}
      <Pagination
        {...{ page, limit, total }}
        disabled={locked || loading}
        onPage={setPage}
        onLimit={(n) => {
          setSize(n);
          setPage(1);
        }}
      />
      <div className="table-container">
        <table className={`data-table ${styles.table}`}>
          <thead>
            <tr>
              <th>
                <input
                  aria-label="Select all on this page"
                  type="checkbox"
                  disabled={locked}
                  checked={
                    rows.length > 0 && rows.every((r) => selected.has(r.id))
                  }
                  onChange={(e) => {
                    setSelected(
                      new Set(e.target.checked ? rows.map((r) => r.id) : []),
                    );
                    lastChecked.current = null;
                  }}
                />
              </th>
              <th>Sr.</th>
              {FIELDS.filter((f) => columns.includes(f.key)).map((f) => (
                <th
                  key={f.key}
                  style={{
                    cursor: locked ? 'default' : 'pointer',
                    userSelect: 'none',
                  }}
                  aria-disabled={locked}
                  onClick={() => {
                    if (locked) return;
                    setSort({
                      column: f.key,
                      direction:
                        sort.column === f.key && sort.direction === 'asc'
                          ? 'desc'
                          : 'asc',
                    });
                    setPage(1);
                  }}
                >
                  {f.label}{' '}
                  {sort.column === f.key
                    ? sort.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </th>
              ))}
              {!active && <th>{deleted ? 'Deleted On' : context === 'canceled' ? 'Canceled On' : 'Completed On'}</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={15}>Loading Job Cards...</td>
              </tr>
            ) : !rows.length ? (
              <tr>
                <td colSpan={15}>No Job Cards found matching filters.</td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.id}
                  style={{
                    background: selected.has(row.id)
                      ? 'var(--table-row-selected)'
                      : undefined,
                  }}
                >
                  <td>
                    <input
                      aria-label={`Select ${row.job_card_number}`}
                      type="checkbox"
                      disabled={locked}
                      checked={selected.has(row.id)}
                      onChange={(e) => select(e, i)}
                    />
                  </td>
                  <td>{(page - 1) * limit + i + 1}</td>
                  {FIELDS.filter((f) => columns.includes(f.key)).map((f) => (
                    <td
                      key={f.key}
                      className={
                        edits[row.id]?.[f.key] !== undefined ||
                        (f.key === 'paper_type' &&
                          edits[row.id]?.paper_type_id) ||
                        (f.key === 'current_vendor' &&
                          edits[row.id]?.vendor_id) ||
                        (f.key === 'current_job' && edits[row.id]?.job_type_id)
                          ? 'cell-edited'
                          : ''
                      }
                    >
                      {cell(row, f.key)}
                    </td>
                  ))}
                  {!active && (
                    <td>
                      {dateTime(deleted ? row.deleted_at : context === 'canceled' ? row.canceled_at : row.completed_at)}
                    </td>
                  )}
                  <td>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {deleted ? (
                        <>
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={locked}
                            onClick={() => action(row, 'restore')}
                          >
                            Restore
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={locked}
                            onClick={() => action(row, 'purge')}
                          >
                            Delete Permanently
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={locked}
                          onClick={() => action(row, 'delete')}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        {...{ page, limit, total }}
        disabled={locked || loading}
        onPage={setPage}
        onLimit={(n) => {
          setSize(n);
          setPage(1);
        }}
      />
      {dirty ? (
        <div className="floating-save">
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => setEdits({})}
          >
            Discard
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy
              ? 'Saving...'
              : `Save Changes (${Object.keys(edits).length} edits)`}
          </button>
        </div>
      ) : (
        selected.size > 0 && (
          <div className="floating-save">
            <strong>{selected.size} selected</strong>
            {active && (
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => bulk('complete')}
              >
                Mark Completed
              </button>
            )}
            {deleted && (
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => bulk('restore')}
              >
                Restore Selected
              </button>
            )}
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => bulk(deleted ? 'purge' : 'delete')}
            >
              {deleted ? 'Delete Permanently' : 'Delete Selected'}
            </button>
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        )
      )}
      {dialog && (
        <StageDialog
          {...dialog}
          masters={masters}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialogs}
    </div>
  );
}
