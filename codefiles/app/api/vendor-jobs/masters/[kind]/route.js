import {
  context,
  failure,
  audit,
  ensureSchema,
  allRows,
} from '@/lib/vendor-jobs/server';
import {
  validateMaster,
  uuid,
  BusinessError,
  MASTER_TABLES,
} from '@/lib/vendor-jobs/domain.mjs';
export async function POST(request, { params }) {
  try {
    const { kind } = await params;
    const { db, user } = await context(request);
    await ensureSchema(db);
    const { id, ...input } = await request.json();
    if (id !== undefined && !uuid(id))
      throw new BusinessError('Invalid master record.');
    const data = validateMaster(kind, input, Boolean(id));
    const { data: result, error } = await db.rpc('vjt_save_master', {
      p_kind: kind,
      p_id: id || null,
      p_data: data,
    });
    if (error?.code === '23505') {
      const records = await allRows(db, MASTER_TABLES[kind], 'id,name,deleted_at');
      const match = records.find(row => row.name.trim().toLowerCase() === data.name.toLowerCase());
      if (match?.deleted_at) {
        throw new BusinessError(
          `${match.name} is in the Recycle Bin. Restore it from the master Recycle Bin to use it again.`,
          409,
          'MASTER_IN_RECYCLE_BIN',
        );
      }
    }
    if (error) throw error;
    await audit(
      user,
      id ? 'UPDATE' : 'CREATE',
      result,
      `Vendor Job Tracking / ${kind}`,
    );
    return Response.json(result.after);
  } catch (error) {
    return failure(error);
  }
}
