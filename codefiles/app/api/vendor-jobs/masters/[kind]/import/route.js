import { context, failure, ensureSchema, allRows, audit } from '@/lib/vendor-jobs/server';
import { MASTER_TABLES, BusinessError } from '@/lib/vendor-jobs/domain.mjs';
import { IMPORT_COLUMNS, prepareImport, saveImport } from '@/lib/vendor-jobs/import.mjs';

export async function POST(request, { params }) {
  try {
    const { kind } = await params;
    const { db, user } = await context(request);
    if (!Object.hasOwn(IMPORT_COLUMNS, kind)) throw new BusinessError('Import is unavailable for this master.', 404);
    await ensureSchema(db);
    const { rows, force } = await request.json();
    const existing = await allRows(db, MASTER_TABLES[kind], 'id,name,deleted_at');
    const jobs = kind === 'vendors' ? await allRows(db, MASTER_TABLES.jobs, 'id,name,deleted_at') : [];
    const plan = prepareImport(kind, rows, existing, jobs, force === true);
    if (plan.requiresConfirmation) return Response.json(plan);
    const result = await saveImport(plan, async data => {
      const { data: saved, error } = await db.rpc('vjt_save_master', { p_kind: kind, p_id: null, p_data: data });
      if (error) throw error;
      return saved;
    }, result => audit(user, 'CREATE', result, `Vendor Job Tracking / ${kind}`));
    return Response.json(result);
  } catch (error) {
    return failure(error);
  }
}
