import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

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

    const { data: usersData } = await supabase.from('users').select('id, first_name, last_name, username');
    const usersMap = {};
    if (usersData) {
      usersData.forEach(u => { usersMap[u.id] = u; });
    }

    const dataWithUsers = data.map(order => ({
      ...order,
      users: order.executive_id ? usersMap[order.executive_id] || null : null
    }));

    return NextResponse.json(dataWithUsers);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { date_of_entry, po_number, client_id, product_name_id, product_type_id, quantity, status, remark, executive_id, target_date } = body;

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
          remark: remark || '',
          executive_id: executive_id || null,
          target_date: target_date || null
        }
      ])
      .select();

    if (error) throw error;

    // Log the activity
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (payload?.userId) {
      let clientName = 'Unknown';
      let productName = 'Unknown';
      let execName = 'Unassigned';

      // Fetch names for logger
      if (client_id) {
        const { data: c } = await supabase.from('clients').select('name').eq('id', client_id).single();
        if (c) clientName = c.name;
      }
      if (product_name_id) {
        const { data: p } = await supabase.from('product_names').select('name').eq('id', product_name_id).single();
        if (p) productName = p.name;
      }
      if (executive_id) {
        const { data: u } = await supabase.from('users').select('first_name, last_name').eq('id', executive_id).single();
        if (u) execName = `${u.first_name} ${u.last_name || ''}`.trim();
      }

      await logActivity({
        userId: payload.userId,
        username: payload.username,
        action: 'CREATE',
        module: 'New Orders',
        recordId: data[0].id,
        details: {
          'PO Number': po_number,
          'Client': clientName,
          'Product': productName,
          'Quantity': quantity,
          'Status': status || 'Design Confirmed',
          'Assigned Executive': execName,
          'Target Date': target_date || 'None',
          'Remark': remark || ''
        }
      });
    }

    return NextResponse.json(data[0]);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
