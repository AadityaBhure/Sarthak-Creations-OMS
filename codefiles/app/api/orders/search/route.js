import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

export async function POST(request) {
  try {
    const { page = 1, limit = 50, filters = [], sort = { column: 'created_at', direction: 'desc' }, statusContext } = await request.json();

    const supabase = createServerClient();
    
    let query = supabase
      .from('orders')
      .select(`
        *,
        clients (id, name),
        product_names (id, name),
        product_types (id, name)
      `, { count: 'exact' });

    // Apply base context (Active vs Completed)
    if (statusContext === 'completed') {
      query = query.eq('status', 'Completed');
    } else if (statusContext === 'active') {
      query = query.neq('status', 'Completed');
    }

    // Apply dynamic user filters
    if (filters.length > 0) {
      const hasOr = filters.some((f, i) => i < filters.length - 1 && f.logic === 'or');
      
      if (!hasOr) {
        // Standard high-performance linear filtering (All ANDs)
        for (const rule of filters) {
          if (!rule.column || !rule.operator || rule.value === undefined || rule.value === '') continue;
          const { column, operator, value } = rule;
          switch (operator) {
            case 'eq': query = query.eq(column, value); break;
            case 'neq': query = query.neq(column, value); break;
            case 'gt': query = query.gt(column, value); break;
            case 'lt': query = query.lt(column, value); break;
            case 'gte': query = query.gte(column, value); break;
            case 'lte': query = query.lte(column, value); break;
            case 'ilike': query = query.ilike(column, `%${value}%`); break;
          }
        }
      } else {
        // Complex grouped filtering for mixed AND / OR
        const orGroups = [];
        let currentAndGroup = [];

        for (let i = 0; i < filters.length; i++) {
          const rule = filters[i];
          if (!rule.column || !rule.operator || rule.value === undefined || rule.value === '') continue;

          let val = rule.value;
          if (rule.operator === 'ilike') val = `%${val}%`;
          // Escape strings with commas, quotes, or parentheses for PostgREST
          if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('(') || val.includes(')'))) {
            val = `"${val.replace(/"/g, '""')}"`;
          }

          currentAndGroup.push(`${rule.column}.${rule.operator}.${val}`);

          if (rule.logic === 'or' || i === filters.length - 1) {
            if (currentAndGroup.length > 0) {
              if (currentAndGroup.length === 1) {
                orGroups.push(currentAndGroup[0]);
              } else {
                orGroups.push(`and(${currentAndGroup.join(',')})`);
              }
            }
            currentAndGroup = [];
          }
        }

        if (orGroups.length > 0) {
          query = query.or(orGroups.join(','));
        }
      }
    }

    // Apply sorting
    if (sort && sort.column) {
      let orderStr = sort.column;
      if (orderStr.includes('.')) {
        const [table, col] = orderStr.split('.');
        orderStr = `${table}(${col})`;
      }
      query = query.order(orderStr, { ascending: sort.direction === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
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
