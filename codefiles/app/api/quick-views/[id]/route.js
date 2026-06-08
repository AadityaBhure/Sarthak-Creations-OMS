import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { name, filters } = await request.json();

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (filters !== undefined) updateData.filters = filters;

    const supabase = createServerClient();

    const { data: existingView } = await supabase.from('quick_views').select('name, filters').eq('id', id).single();

    const { data, error } = await supabase
      .from('quick_views')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A quick view with this name already exists.' }, { status: 400 });
      }
      throw error;
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (payload?.userId) {
      const changes = {};
      if (existingView) {
        if (existingView.name !== data.name) changes['View Name'] = { old: existingView.name, new: data.name };
        if (JSON.stringify(existingView.filters) !== JSON.stringify(data.filters)) {
          changes['Filters'] = { old: 'Previous Filters', new: 'Updated Filters' };
        }
      }

      if (Object.keys(changes).length > 0) {
        await logActivity({
          userId: payload.userId,
          username: payload.username,
          action: 'UPDATE',
          module: 'Manage Views',
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

    const { data: recordToLog } = await supabase.from('quick_views').select('name').eq('id', id).single();

    const { error } = await supabase
      .from('quick_views')
      .delete()
      .eq('id', id);

    if (error) throw error;

    if (recordToLog) {
      const cookieStore = await cookies();
      const token = cookieStore.get('session')?.value;
      const payload = token ? await verifyToken(token) : null;
      if (payload?.userId) {
        await logActivity({
          userId: payload.userId,
          username: payload.username,
          action: 'DELETE',
          module: 'Manage Views',
          recordId: id,
          details: { 'Deleted View': recordToLog.name }
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
