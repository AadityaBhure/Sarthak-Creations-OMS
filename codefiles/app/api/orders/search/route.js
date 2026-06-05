import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

export async function POST(request) {
  try {
    const { page = 1, limit = 50, filters = [], statusContext } = await request.json();

    const supabase = createServerClient();
    
    let query = supabase
      .from('orders')
      .select(`
        *,
        clients (id, name),
        product_names (id, name),
        product_types (id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply base context (Active vs Completed)
    if (statusContext === 'completed') {
      query = query.eq('status', 'Completed');
    } else if (statusContext === 'active') {
      query = query.neq('status', 'Completed');
    }

    // Apply dynamic user filters
    for (const rule of filters) {
      if (!rule.column || !rule.operator || rule.value === undefined || rule.value === '') continue;
      
      const { column, operator, value } = rule;

      switch (operator) {
        case 'eq':
          query = query.eq(column, value);
          break;
        case 'neq':
          query = query.neq(column, value);
          break;
        case 'gt':
          query = query.gt(column, value);
          break;
        case 'lt':
          query = query.lt(column, value);
          break;
        case 'gte':
          query = query.gte(column, value);
          break;
        case 'lte':
          query = query.lte(column, value);
          break;
        case 'ilike':
          query = query.ilike(column, `%${value}%`);
          break;
      }
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      data,
      meta: {
        totalRowCount: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
