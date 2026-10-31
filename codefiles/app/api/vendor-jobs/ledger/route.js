import { context, failure } from '@/lib/vendor-jobs/server';
import { ledgerQuery } from '@/lib/vendor-jobs/ledger.mjs';

export async function POST(request) {
  try {
    const { db } = await context(request);
    const { page, limit, vendorId, includeDeleted, sort, expression } = ledgerQuery(await request.json());
    let query = db.from('vjt_vendor_ledger').select('*', { count: 'exact' });
    if (vendorId) query = query.eq('vendor_id', vendorId);
    if (!includeDeleted) query = query.is('deleted_at', null);
    if (expression) query = query.or(expression);
    const { data, count, error } = await query.order(sort.column, { ascending: sort.direction === 'asc', nullsFirst: false }).order('id').range((page - 1) * limit, page * limit - 1);
    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code)) return Response.json({ error: 'The Vendor-wise Ledger update is not installed. Run 20261029_vendor_ledger.sql in Supabase SQL Editor, then refresh.', code: 'SETUP_REQUIRED' }, { status: 503 });
      throw error;
    }
    return Response.json({ data, meta: { totalRowCount: count, page, limit } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
