import {
  context,
  failure,
  audit,
  ensureSchema,
} from '@/lib/vendor-jobs/server';
import {
  MASTER_TABLES,
  uuid,
  BusinessError,
} from '@/lib/vendor-jobs/domain.mjs';
export async function POST(request, { params }) {
  try {
    const { db, user } = await context(request);
    await ensureSchema(db);
    const { kind, id } = await params;
    if (!Object.hasOwn(MASTER_TABLES, kind) || !uuid(id))
      throw new BusinessError('Invalid master record.');
    const input = await request.json();
    if (
      !['delete', 'restore', 'purge'].includes(input.action) ||
      !Number.isInteger(input.revision) ||
      input.revision < 1 ||
      Object.keys(input).some((k) => !['action', 'revision'].includes(k))
    )
      throw new BusinessError('Invalid master action.');
    const { data, error } = await db.rpc(input.action === 'purge' ? 'vjt_purge_master' : 'vjt_master_lifecycle', {
      p_kind: kind,
      p_id: id,
      ...(input.action === 'purge' ? {} : { p_action: input.action }),
      p_revision: input.revision,
    });
    if (error && input.action === 'purge' && ['PGRST202', '42883'].includes(error.code))
      throw new BusinessError('Run 20260929_vendor_job_deleted_records.sql in Supabase SQL Editor to enable permanent deletion of masters.', 503);
    if (error) throw error;
    await audit(
      user,
      { delete: 'DELETE', restore: 'RESTORE', purge: 'PERMANENT_DELETE' }[input.action],
      data,
      `Vendor Job Tracking / ${kind}`,
    );
    return Response.json({ record: data.after });
  } catch (error) {
    return failure(error);
  }
}
