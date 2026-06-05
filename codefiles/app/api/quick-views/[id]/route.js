import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { name, filters } = await request.json();

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (filters !== undefined) updateData.filters = filters;

    const supabase = createServerClient();
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

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    const { error } = await supabase
      .from('quick_views')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
