import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { requireAdmin } from '@/lib/require-admin';
import { EXPORT_TABLES, readExportTable } from '@/lib/database-export.mjs';
import JSZip from 'jszip';
import Papa from 'papaparse';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const db = createServerClient();
    const zip = new JSZip();
    const manifest = {
      formatVersion: 1,
      startedAt: new Date().toISOString(),
      scope: 'Business data for both modules, including recoverable deleted records and numbering registers.',
      limitations: 'Not a transaction-consistent database backup. Does not include credentials, users, audit logs, schema, functions, policies, or storage. Use Supabase backups for disaster recovery. Avoid editing records during export.',
      tables: {},
    };
    for (const [table, keys] of EXPORT_TABLES) {
      const rows = await readExportTable(db, table, keys);
      manifest.tables[table] = rows.length;
      // JSON preserves nested data and exact values; CSV is safe for opening in Excel.
      zip.file(`${table}.json`, JSON.stringify(rows, null, 2));
      zip.file(`${table}.csv`, Papa.unparse(rows, { escapeFormulae: true }));
      if (table === 'orders') {
        zip.file('active_orders.csv', Papa.unparse(rows.filter(row => row.status !== 'Completed'), { escapeFormulae: true }));
        zip.file('completed_orders.csv', Papa.unparse(rows.filter(row => row.status === 'Completed'), { escapeFormulae: true }));
      }
    }
    manifest.finishedAt = new Date().toISOString();
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    const content = await zip.generateAsync({ type: 'nodebuffer' });
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="oms_business_data_export.zip"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Database export]', error);
    return NextResponse.json({ error: 'Export failed. No partial download was created. Please try again or check the server logs.' }, { status: 500 });
  }
}
