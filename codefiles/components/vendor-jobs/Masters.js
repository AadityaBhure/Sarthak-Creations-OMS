'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ExcelImportModal from '@/components/excel/ExcelImportModal';
import { IMPORT_COLUMNS } from '@/lib/vendor-jobs/import.mjs';
import { useGlobalSettings } from '@/components/SettingsProvider';
import {
  api,
  useMasters,
  useDialogs,
  useUnsaved,
  MasterSelect,
  Pagination,
} from './Common';
import styles from './vendor-jobs.module.css';

const names = { vendors: 'Vendor', jobs: 'Job Type', papers: 'Paper Type' };
export default function Masters({ kind }) {
  const router = useRouter();
  const { masters, loading, error, refresh } = useMasters(true);
  const { settings } = useGlobalSettings();
  const { confirm, notify, dialogs } = useDialogs();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(null);
  const [editable, setEditable] = useState(false);
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const rows = masters[kind].filter((r) => !r.deleted_at);
  const label = names[kind];
  const limit = size || settings?.default_pagination || 50;
  const dirty = Object.keys(edits).length > 0;
  useUnsaved(dirty || Boolean(draft));
  const filtered = rows.filter((r) =>
    [r.name, r.concerned_persons, r.concerned_contacts].some((v) =>
      v?.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  const visible = filtered.slice((page - 1) * limit, page * limit);
  function change(row, key, value) {
    setEdits((prev) => ({
      ...prev,
      [row.id]: { ...row, ...prev[row.id], [key]: value },
    }));
  }
  function payload(row) {
    const result = { name: row.name };
    if (row.id) Object.assign(result, { id: row.id, revision: row.revision });
    if (kind === 'vendors')
      Object.assign(result, {
        address: row.address,
        concerned_persons: row.concerned_persons,
        concerned_contacts: row.concerned_contacts,
        capabilities: row.capabilities,
      });
    return result;
  }
  async function save() {
    setBusy(true);
    const failures = [];
    for (const row of Object.values(edits)) {
      try {
        await api(`masters/${kind}`, payload(row));
        setEdits((prev) => {
          const n = { ...prev };
          delete n[row.id];
          return n;
        });
      } catch (e) {
        failures.push(`${row.name}: ${e.message}`);
      }
    }
    await refresh();
    setBusy(false);
    if (failures.length) notify(failures.join('\n'));
  }
  async function add(e) {
    e.preventDefault();
    const deletedMatch = masters[kind].find(
      (row) => row.deleted_at && row.name.trim().toLowerCase() === draft.name.trim().toLowerCase(),
    );
    if (deletedMatch && !(await confirm(
      `${deletedMatch.name} is in the Recycle Bin. Restore the existing ${label.toLowerCase()} with its saved details and history? Details entered in this form will not replace the saved details. You can edit them after restoring.`,
      `Restore ${label}`,
      'Restore',
    ))) return;
    setBusy(true);
    try {
      if (deletedMatch) {
        await api(`masters/${kind}/${deletedMatch.id}`, {
          action: 'restore',
          revision: deletedMatch.revision,
        });
        setSearch('');
        setPage(1);
      } else {
        await api(`masters/${kind}`, payload(draft));
      }
      setDraft(null);
      await refresh();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function lifecycle(row) {
    const action = 'delete';
    if (
      !(await confirm(
        `Move ${row.name} to Deleted Records? Existing Job Cards and history will be kept.`,
        'Delete Master',
        'Delete',
      ))
    )
      return;
    setBusy(true);
    try {
      await api(`masters/${kind}/${row.id}`, {
        action,
        revision: row.revision,
      });
      setPage(1);
      await refresh();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  const fields =
    kind === 'vendors'
      ? [
          ['name', 'Vendor Name'],
          ['address', 'Address'],
          ['concerned_persons', 'Concerned Person(s)'],
          ['concerned_contacts', 'Concerned Person Contact(s)'],
        ]
      : [['name', `${label} Name`]];
  return (
    <div className="masters-page">
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            className="btn btn-primary"
            disabled={busy || dirty}
            onClick={() =>
              setDraft({
                name: '',
                address: '',
                concerned_persons: '',
                concerned_contacts: '',
                capabilities: [],
              })
            }
          >
            + Add {label}
          </button>
          {IMPORT_COLUMNS[kind] && (
            <button
              className="btn btn-secondary"
              disabled={busy || dirty || Boolean(draft) || loading}
              onClick={() => setShowImport(true)}
            >
              Import Excel
            </button>
          )}
          <input
            className="toolbar-search"
            aria-label={`Search ${label}`}
            placeholder={`Search ${label.toLowerCase()}s...`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <button
            className="btn btn-secondary"
            disabled={busy || dirty || Boolean(draft)}
            onClick={() => router.push(`/vendor-jobs/deleted?tab=${kind}`)}
          >
            {`Deleted Records (${masters[kind].filter((r) => r.deleted_at).length})`}
          </button>
        </div>
        <div className={styles.right}>
          <label className="editable-toggle">
            <input
              type="checkbox"
              checked={editable}
              disabled={busy}
              onChange={async (e) => {
                const next = e.target.checked;
                if (!next && dirty) {
                  if (!(await confirm('Discard unsaved master changes?')))
                    return;
                  setEdits({});
                }
                setEditable(next);
              }}
            />{' '}
            Editable
          </label>
        </div>
      </div>
      {error && (
        <div role="alert" className="banner banner-error">
          {error}
        </div>
      )}
      <Pagination
        {...{ page, limit }}
        total={filtered.length}
        disabled={busy}
        onPage={setPage}
        onLimit={(n) => {
          setSize(n);
          setPage(1);
        }}
      />
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sr.</th>
              {fields.map(([k, l]) => (
                <th key={k}>{l}</th>
              ))}
              {kind === 'vendors' && <th>Job Capabilities</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>Loading masters...</td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={8}>No records found.</td>
              </tr>
            ) : (
              visible.map((row, i) => {
                const val = edits[row.id] || row;
                return (
                  <tr key={row.id}>
                    <td>{(page - 1) * limit + i + 1}</td>
                    {fields.map(([key, l]) => (
                      <td
                        key={key}
                        className={
                          edits[row.id]?.[key] !== undefined
                            ? 'cell-edited'
                            : ''
                        }
                      >
                        {editable ? (
                          <input
                            aria-label={`${l} ${row.name}`}
                            className="form-input"
                            disabled={busy}
                            value={val[key]}
                            onChange={(e) => change(row, key, e.target.value)}
                          />
                        ) : (
                          row[key] || '—'
                        )}
                      </td>
                    ))}
                    {kind === 'vendors' && (
                      <td>
                        {editable ? (
                          <MasterSelect
                            label={`Capabilities ${row.name}`}
                            multi
                            items={masters.jobs}
                            value={val.capabilities}
                            disabled={busy}
                            onChange={(ids) => change(row, 'capabilities', ids)}
                          />
                        ) : (
                          masters.jobs
                            .filter((j) => row.capabilities.includes(j.id))
                            .map((j) => j.name)
                            .join(', ') || '—'
                        )}
                      </td>
                    )}
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={busy || dirty}
                        onClick={() => lifecycle(row)}
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
      {dirty && (
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
      )}
      {draft && (
        <div className="modal-overlay">
          <div
            className={styles.modal}
            style={{ maxWidth: 600 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Add ${label}`}
          >
            <h3>Add {label}</h3>
            <form onSubmit={add}>
              <div className={styles.grid}>
                {fields.map(([key, l]) => (
                  <label className="form-group" key={key}>
                    {l}
                    {key === 'name' ? ' *' : ''}
                    <input
                      className="form-input"
                      required={key === 'name'}
                      maxLength={key === 'name' ? 200 : undefined}
                      value={draft[key]}
                      disabled={busy}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                {kind === 'vendors' && (
                  <div className="form-group">
                    <label>Job Capabilities</label>
                    <MasterSelect
                      label="Capabilities"
                      multi
                      items={masters.jobs}
                      value={draft.capabilities}
                      disabled={busy}
                      onChange={(ids) =>
                        setDraft({ ...draft, capabilities: ids })
                      }
                    />
                  </div>
                )}
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" disabled={busy}>
                  Save {label}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showImport && (
        <ExcelImportModal
          isOpen
          onClose={() => setShowImport(false)}
          entityName={kind === 'vendors' ? 'Vendors' : 'Paper Types'}
          importEndpoint={`/api/vendor-jobs/masters/${kind}/import`}
          columnMap={IMPORT_COLUMNS[kind]}
          confirmationTitle="Missing Job Capabilities Detected"
          instructions={kind === 'vendors'
            ? 'Only Vendor Name needs a value. Separate multiple people, contacts, and Job Capabilities with semicolons. Keep contacts as Text in Excel. Capabilities must match active Job Type names.'
            : 'Paper Type Name is required. Names may contain up to 200 characters.'}
          onSuccess={() => { setPage(1); refresh(); }}
        />
      )}
      {dialogs}
    </div>
  );
}
