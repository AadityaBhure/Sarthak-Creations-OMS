import {
  context,
  failure,
  audit,
  ensureSchema,
} from '@/lib/vendor-jobs/server';
import { validateMutation } from '@/lib/vendor-jobs/domain.mjs';
export async function GET(request) {
  try {
    const { db } = await context(request);
    await ensureSchema(db);
    const { data, error } = await db.rpc('vjt_entry_defaults');
    if (error) throw error;
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request) {
  try {
    const { db, user } = await context(request);
    await ensureSchema(db);
    const input = validateMutation('create', await request.json());
    const { data, error } = await db.rpc('vjt_mutate_details', {
      p_action: 'create',
      p_data: input,
    });
    if (error) throw error;
    await audit(user, 'CREATE', data);
    return Response.json(data.after, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
