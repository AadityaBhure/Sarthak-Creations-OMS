import { context, failure } from '@/lib/vendor-jobs/server';
import {
  filterExpression,
  FIELDS,
  BusinessError,
} from '@/lib/vendor-jobs/domain.mjs';
export async function POST(request) {
  try {
    const { db } = await context(request);
    const {
      page = 1,
      limit = 50,
      filters = [],
      sort = { column: 'created_at', direction: 'desc' },
      statusContext = 'active',
    } = await request.json();
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      ![25, 50, 100, 200].includes(limit)
    )
      throw new BusinessError('Select a valid page and page size.');
    if (!['active', 'completed', 'canceled', 'deleted'].includes(statusContext))
      throw new BusinessError('Invalid Job Card view.');
    if (
      ![...FIELDS.map((f) => f.key), 'deleted_at'].includes(sort.column) ||
      !['asc', 'desc'].includes(sort.direction)
    )
      throw new BusinessError('Select a valid sort column.');
    let query = db.from('vjt_tracking').select('*', { count: 'exact' });
    if (statusContext === 'deleted')
      query = query.not('deleted_at', 'is', null);
    else {
      query = query.is('deleted_at', null);
      query = statusContext === 'active'
        ? query.in('status', ['Active', 'Hold'])
        : query.eq('status', statusContext === 'completed' ? 'Completed' : 'Canceled');
    }
    const expression = filterExpression(filters);
    if (expression) query = query.or(expression);
    query = query
      .order(sort.column, { ascending: sort.direction === 'asc' })
      .order('id')
      .range((page - 1) * limit, page * limit - 1);
    const { data, count, error } = await query;
    if (error) throw error;
    return Response.json({ data, meta: { totalRowCount: count, page, limit } });
  } catch (error) {
    return failure(error);
  }
}
