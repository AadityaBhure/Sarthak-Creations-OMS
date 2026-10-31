import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { createServerClient } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logger';
import { BusinessError } from './domain.mjs';
import { hasAllowedOrigin } from './request-origin.mjs';
import { connectionError } from './connection-error.mjs';
const setupMessage =
  'The Job Status update is not installed. Run the entire 20261029_vendor_job_statuses.sql file in Supabase SQL Editor after the Job Card details migration, then retry.';
export async function ensureSchema(db) {
  const { data, error } = await db.rpc('vjt_schema_version');
  if (error || data !== 5) {
    if (error && !['PGRST202', '42883'].includes(error.code)) throw error;
    throw new BusinessError(setupMessage, 503, 'SETUP_REQUIRED');
  }
}

export async function context(request) {
  const token = (await cookies()).get('session')?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) throw new BusinessError('Please sign in to continue.', 401);
  if (!hasAllowedOrigin(request))
    throw new BusinessError(
      'Please submit changes from this application.',
      403,
    );
  return { db: createServerClient(), user };
}
export function failure(error) {
  const connectionMessage = connectionError(error);
  if (connectionMessage) {
    console.error('[Vendor Job Tracking] database connection unavailable');
    return Response.json({ error: connectionMessage, code: 'DATABASE_UNAVAILABLE' }, { status: 503 });
  }
  if (error.code === 'P0003')
    return Response.json(
      { error: error.message, code: 'NUMBER_CHANGED' },
      { status: 409 },
    );
  if (error instanceof BusinessError)
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  const messages = {
    23505: 'A master with this name already exists.',
    23503:
      'A selected master is unavailable. Refresh your master lists and try again.',
    23514: 'Check required fields and enter a positive whole quantity.',
    23502: 'Please complete all required fields.',
    '22P02':
      'One of the supplied values is invalid. Check the form and try again.',
    22007: 'Enter a valid date and time.',
    40001: 'This record changed. Refresh and review your edits before saving.',
  };
  if (error.code === 'P0002')
    return Response.json(
      { error: error.message, code: 'DUPLICATE_NUMBER' },
      { status: 409 },
    );
  if (error.code === 'P0001')
    return Response.json({ error: error.message }, { status: 400 });
  if (['42P01', 'PGRST205', 'PGRST202'].includes(error.code))
    return Response.json(
      {
        error: setupMessage,
      },
      { status: 503 },
    );
  console.error('[Vendor Job Tracking]', error.code || error.name);
  return Response.json(
    {
      error:
        messages[error.code] ||
        'Could not complete this request. Please try again.',
    },
    { status: error.code === '40001' ? 409 : 500 },
  );
}
export async function audit(
  user,
  action,
  result,
  module = 'Vendor Job Tracking',
) {
  await logActivity({
    userId: user.userId || null,
    username: user.username || 'Admin',
    action,
    module,
    recordId: result.id,
    details: { Record: { old: result.before, new: result.after } },
  });
}
export async function allRows(db, table, select = '*') {
  const rows = [];
  for (let page = 0; ; page++) {
    const { data, error } = await db
      .from(table)
      .select(select)
      .order('id')
      .range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
