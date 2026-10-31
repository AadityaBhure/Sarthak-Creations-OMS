'use client';
import { FIELDS } from '@/lib/vendor-jobs/domain.mjs';
import { dateTime } from './Common';
export default function Exports({
  rows,
  selected,
  columns,
  title,
  settings,
  disabled,
  availableFields = FIELDS,
  filename = 'vendor-jobs',
}) {
  const fields = availableFields.filter((f) => columns.includes(f.key));
  const data = rows
    .filter((r) => !selected.size || selected.has(r.id))
    .map((r) =>
      fields.map((f) =>
        f.type === 'date' ? (r[f.key] ? dateTime(r[f.key]) : '') : String(r[f.key] ?? ''),
      ),
    );
  function csv() {
    const quote = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const text = [fields.map((f) => f.label), ...data]
      .map((row) =>
        row.map((v) => quote(/^[=+@\-\t\r]/.test(v) ? "'" + v : v)).join(','),
      )
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  async function pdf() {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(settings?.print_header_name || 'Sarthak Creations', 14, 15);
    doc.setFontSize(10);
    doc.text(title, 14, 22);
    autoTable(doc, {
      startY: 30,
      head: [fields.map((f) => f.label)],
      body: data,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 30, 30] },
    });
    doc.save(filename + '.pdf');
  }
  return (
    <>
      <button
        className="btn btn-secondary btn-sm"
        disabled={disabled}
        onClick={csv}
      >
        Export CSV
      </button>
      <button
        className="btn btn-secondary btn-sm"
        disabled={disabled}
        onClick={pdf}
      >
        Export PDF
      </button>
      <button
        className="btn btn-secondary btn-sm"
        disabled={disabled}
        onClick={() => window.print()}
      >
        Print
      </button>
    </>
  );
}
