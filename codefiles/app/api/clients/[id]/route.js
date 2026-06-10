import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { name, contact_person, phone_number } = await request.json();

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (contact_person !== undefined) updateData.contact_person = contact_person ? contact_person.trim() : null;
    if (phone_number !== undefined) updateData.phone_number = phone_number ? phone_number.trim() : null;

    const supabase = createServerClient();

    // Fetch existing client to build before/after map
    const { data: existingClient } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

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

    // Log the activity
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (payload && (payload.userId || payload.role === 'admin')) {
      // Build before/after map
      const changes = {};
      if (existingClient) {
        for (const key of Object.keys(updateData)) {
          if (existingClient[key] !== updateData[key]) {
            changes[key] = { old: existingClient[key], new: updateData[key] };
          }
        }
      }

      // Only log if there are actual changes
      if (Object.keys(changes).length > 0) {
        await logActivity({
          userId: payload.userId || null,
          username: payload.username || 'Admin',
          action: 'UPDATE',
          module: 'Client List',
          recordId: id,
          details: changes
        });
      }
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

    // Log the activity
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (payload && (payload.userId || payload.role === 'admin')) {
      await logActivity({
        userId: payload.userId || null,
        username: payload.username || 'Admin',
        action: 'DELETE',
        module: 'Client List',
        recordId: id,
        details: { name: client.name }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
