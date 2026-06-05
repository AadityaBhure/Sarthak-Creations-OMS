import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

export async function GET(request) {
  try {
    // Read the "status" search param. If "completed" is passed, fetch only completed.
    // Otherwise, fetch active (not completed) orders.
    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get('status');

    const supabase = createServerClient();
    
    let query = supabase
      .from('orders')
      .select(`
        *,
        clients (id, name),
        product_names (id, name),
        product_types (id, name)
      `)
      .order('created_at', { ascending: false });

    if (filterStatus === 'completed') {
      query = query.eq('status', 'Completed');
    } else {
      query = query.neq('status', 'Completed');
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { date_of_entry, po_number, client_id, product_name_id, product_type_id, quantity, status, remark } = body;

    // Basic validation
    if (!date_of_entry || !po_number || !client_id || !product_name_id || !product_type_id || !quantity) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('orders')
      .insert([
        {
          date_of_entry,
          po_number,
          client_id,
          product_name_id,
          product_type_id,
          quantity: parseInt(quantity, 10),
          status: status || 'Design Confirmed',
          remark: remark || ''
        }
      ])
      .select();

    if (error) throw error;

    return NextResponse.json(data[0]);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
