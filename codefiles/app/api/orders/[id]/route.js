import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const updates = await request.json();
    
    // Convert empty strings to null or leave as is if needed
    // Note: client_id, etc. might be updated inline later, but mostly status, quantity, remark

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;

    return NextResponse.json(data[0]);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    // 1. Fetch the original order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // 2. Upsert into deleted_orders
    const { error: insertError } = await supabase
      .from('deleted_orders')
      .upsert([order]);

    if (insertError) throw insertError;

    // 3. Delete from active orders
    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);

    if (deleteError) {
      // ROLLBACK: Clean up the ghost copy from the trash if deletion fails
      await supabase.from('deleted_orders').delete().eq('id', id);
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
