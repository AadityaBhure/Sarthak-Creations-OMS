import { context, failure, allRows, ensureSchema } from '@/lib/vendor-jobs/server';
import { BusinessError } from '@/lib/vendor-jobs/domain.mjs';

export async function GET(request) {
  try {
    const { db } = await context(request);
    await ensureSchema(db);
    const kind = new URL(request.url).searchParams.get('kind');
    if (!['vendors', 'jobs', 'papers', 'cards'].includes(kind)) throw new BusinessError('Invalid deleted records category.');
    const { error: setupError } = await db.rpc('vjt_recycle_ready');
    if (setupError) throw new BusinessError('Run 20260929_vendor_job_deleted_records.sql in Supabase SQL Editor to enable the centralized Recycle Bin and automatic retention.', 503);
    const rows = await allRows(db, 'vjt_deleted_records');
    return Response.json(rows.filter(row => row.kind === kind).map(row => row.record).sort((a, b) => b.deleted_at.localeCompare(a.deleted_at)));
  } catch (error) { return failure(error); }
}
