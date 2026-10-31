'use client';
import { useState } from 'react';
import {
  api,
  MasterSelect,
  VendorJobFields,
  dateTime,
  localInput,
  inputTimestamp,
} from './Common';
import styles from './vendor-jobs.module.css';
export default function StageDialog({ card, mode, masters, onClose, onSaved }) {
  const [stages, setStages] = useState(card.stages.map((s) => ({ ...s })));
  const [next, setNext] = useState({ vendor_id: '', job_type_id: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editing = mode === 'sequence';
  const progressing = mode === 'progress';
  function change(index, key, value) {
    setStages((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [key]: value } : s)),
    );
  }
  function move(index, delta) {
    const result = [...stages];
    [result[index], result[index + delta]] = [
      result[index + delta],
      result[index],
    ];
    setStages(result);
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const data = progressing
        ? next
        : {
            stages: stages.map((s) => {
              const item = {
                vendor_id: s.vendor_id,
                job_type_id: s.job_type_id,
              };
              if (s.id) item.id = s.id;
              // Omit existing timestamps unless explicitly edited; preserve DB precision.
              if (s.editedTime !== undefined)
                item.started_at = inputTimestamp(s.editedTime);
              return item;
            }),
          };
      await api(`cards/${card.id}`, {
        action: mode,
        revision: card.revision,
        ...data,
      });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-overlay">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Vendor History"
      >
        <h3>
          {progressing
            ? 'Update Progress'
            : editing
              ? 'Edit Sequence'
              : 'Vendor History'}{' '}
          — {card.job_card_number}
        </h3>
        <p className={styles.note}>
          {progressing
            ? 'Saving adds a stage with the current system time.'
            : editing
              ? 'Sequence order determines current work. Existing timestamps stay unchanged unless you edit them. New stages receive the save time unless you enter a time.'
              : 'Stages are displayed in their saved sequence order.'}{' '}
          Times are shown in India Standard Time.
        </p>
        {error && (
          <div className="banner banner-error" role="alert">
            {error}
          </div>
        )}
        {progressing ? (
          <div className={styles.grid}>
            <VendorJobFields
              {...{ masters }}
              value={next}
              onChange={setNext}
              disabled={busy}
            />
          </div>
        ) : (
          stages.map((s, i) => (
            <div className={styles.stage} key={s.id || s.clientKey}>
              <strong>{i + 1}</strong>
              {editing ? (
                <>
                  <MasterSelect
                    label={`Stage ${i + 1} Vendor`}
                    items={masters.vendors}
                    value={s.vendor_id}
                    disabled={busy}
                    onChange={(v) => change(i, 'vendor_id', v)}
                  />
                  <MasterSelect
                    label={`Stage ${i + 1} Job`}
                    items={masters.jobs}
                    value={s.job_type_id}
                    disabled={busy}
                    onChange={(v) => change(i, 'job_type_id', v)}
                  />
                  <label>
                    Stage time (IST)
                    <input
                      className="form-input"
                      aria-label={`Stage ${i + 1} time`}
                      type="datetime-local"
                      step="1"
                      value={
                        s.editedTime !== undefined
                          ? s.editedTime
                          : localInput(s.started_at)
                      }
                      disabled={busy}
                      onChange={(e) => change(i, 'editedTime', e.target.value)}
                    />
                    {!s.id && s.editedTime === undefined && (
                      <small>Automatic on Save</small>
                    )}
                  </label>
                  <div className={styles.stageActions}>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={busy || i === 0}
                      onClick={() => move(i, -1)}
                    >
                      Move Up
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={busy || i === stages.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      Move Down
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy || stages.length === 1}
                      onClick={() =>
                        setStages(stages.filter((_, n) => n !== i))
                      }
                    >
                      Remove Stage
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span>{s.vendor_name}</span>
                  <span>{s.job_name}</span>
                  <span>{dateTime(s.started_at)}</span>
                </>
              )}
            </div>
          ))
        )}
        {editing && (
          <button
            className="btn btn-secondary"
            style={{ marginTop: 16 }}
            disabled={busy}
            onClick={() =>
              setStages([
                ...stages,
                {
                  clientKey: crypto.randomUUID(),
                  vendor_id: '',
                  job_type_id: '',
                },
              ])
            }
          >
            + Add Stage
          </button>
        )}
        <div className={styles.actions}>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={onClose}
          >
            {editing ? 'Discard' : progressing ? 'Cancel' : 'Close'}
          </button>
          {(editing || progressing) && (
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              {busy ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
