import {
  context,
  failure,
  audit,
  ensureSchema,
} from '@/lib/vendor-jobs/server';
import {
  validateMutation,
  uuid,
  BusinessError,
} from '@/lib/vendor-jobs/domain.mjs';
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { db, user } = await context(request);
    await ensureSchema(db);
    if (!uuid(id)) throw new BusinessError('Invalid Job Card.');
    const { action, ...input } = await request.json();
    if (action === 'create')
      throw new BusinessError('Use the New Job Card page.');
    validateMutation(action, input);
    const { data, error } = await db.rpc('vjt_mutate_details', {
      p_action: action,
      p_id: id,
      p_data: input,
    });
    if (error) throw error;
    await audit(
      user,
      {
        delete: 'DELETE',
        restore: 'RESTORE',
        purge: 'PERMANENT_DELETE',
        progress: 'UPDATE_PROGRESS',
        sequence: 'EDIT_SEQUENCE',
        complete: 'COMPLETE',
        reopen: 'REOPEN',
        save: 'UPDATE',
      }[action] || 'UPDATE',
      data,
    );
    return Response.json({ record: data.after, success: true });
  } catch (error) {
    return failure(error);
  }
}
