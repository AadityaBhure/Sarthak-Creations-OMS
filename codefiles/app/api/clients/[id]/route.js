import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { name, address } = await request.json();

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (address !== undefined) updateData.address = address.trim();

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A client with this name already exists.' }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    // 1. Fetch the client to get its data
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // 2. Upsert into deleted_clients (upsert prevents duplicate key errors if a previous delete partially failed)
    const { error: insertError } = await supabase
      .from('deleted_clients')
      .upsert([client]);

    if (insertError) throw insertError;

    // 3. Delete from clients
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (deleteError) {
      // ROLLBACK: If the delete fails (e.g., due to an active order Foreign Key constraint),
      // we immediately remove the ghost copy from the trash to keep the database perfectly clean.
      await supabase.from('deleted_clients').delete().eq('id', id);
      
      if (deleteError.code === '23503') {
        throw new Error('Cannot delete this Client because it is currently linked to an Active Order. Please delete or reassign the related active orders first.');
      }
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
