import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { first_name, last_name, phone_number } = await request.json();

    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name.trim();
    if (last_name !== undefined) updateData.last_name = last_name.trim();
    if (phone_number !== undefined) {
      if (!/^\d{10}$/.test(phone_number.trim())) {
        return NextResponse.json({ error: 'Phone number must be exactly 10 digits.' }, { status: 400 });
      }
      updateData.phone_number = phone_number.trim();
    }

    if (updateData.first_name || updateData.last_name) {
      // If either name changed, we need both to regenerate username
      const supabase = createServerClient();
      const { data: user } = await supabase.from('users').select('first_name, last_name').eq('id', id).single();
      const fn = updateData.first_name || user.first_name;
      const ln = updateData.last_name || user.last_name;
      updateData.username = (fn + ln).toLowerCase();
    }

    const supabase = createServerClient();

    // Fetch existing user to build before/after map
    const { data: existingUser } = await supabase
      .from('users')
      .select('first_name, last_name, phone_number, role')
      .eq('id', id)
      .single();

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, first_name, last_name, username, phone_number, role')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'An executive with this Name or Phone Number already exists.' }, { status: 400 });
      }
      throw error;
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (payload && (payload.userId || payload.role === 'admin')) {
      const changes = {};
      if (existingUser) {
        if (existingUser.first_name !== data.first_name) changes['First Name'] = { old: existingUser.first_name, new: data.first_name };
        if (existingUser.last_name !== data.last_name) changes['Last Name'] = { old: existingUser.last_name, new: data.last_name };
        if (existingUser.phone_number !== data.phone_number) changes['Phone'] = { old: existingUser.phone_number, new: data.phone_number };
        if (existingUser.role !== data.role) changes['Role'] = { old: existingUser.role, new: data.role };
      }

      if (Object.keys(changes).length > 0) {
        await logActivity({
          userId: payload.userId || null,
          username: payload.username || 'Admin',
          action: 'UPDATE',
          module: 'Executive List',
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

    // 1. Fetch user to backup
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, first_name, last_name, username, phone_number, role, created_at')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // 2. Insert to deleted_users
    const { error: insertError } = await supabase
      .from('deleted_users')
      .upsert([user]);

    if (insertError) throw insertError;

    // 3. Delete from users
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (deleteError) {
      // rollback
      await supabase.from('deleted_users').delete().eq('id', id);
      
      if (deleteError.code === '23503') {
        throw new Error('Cannot delete this Executive because they are currently assigned to Orders. Please reassign their orders first.');
      }
      throw deleteError;
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (payload && (payload.userId || payload.role === 'admin')) {
      await logActivity({
        userId: payload.userId || null,
        username: payload.username || 'Admin',
        action: 'DELETE',
        module: 'Executive List',
        recordId: id,
        details: { 'Executive Name': `${user.first_name} ${user.last_name}`.trim() }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
