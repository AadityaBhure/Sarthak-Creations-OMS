import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { name } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Product type is required.' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Fetch existing product type
    const { data: existingProductType } = await supabase
      .from('product_types')
      .select('name')
      .eq('id', id)
      .single();

    const { data, error } = await supabase
      .from('product_types')
      .update({ name: name.trim() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A product type with this name already exists.' }, { status: 400 });
      }
      throw error;
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (payload?.userId) {
      if (existingProductType && existingProductType.name !== data.name) {
        await logActivity({
          userId: payload.userId,
          username: payload.username,
          action: 'UPDATE',
          module: 'Product Types',
          recordId: id,
          details: { 'Product Type': { old: existingProductType.name, new: data.name } }
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

    const { data: record, error: fetchError } = await supabase
      .from('product_types')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const { error: insertError } = await supabase
      .from('deleted_product_types')
      .upsert([record]);

    if (insertError) throw insertError;

    const { error: deleteError } = await supabase
      .from('product_types')
      .delete()
      .eq('id', id);

    if (deleteError) {
      // ROLLBACK: If the delete fails, clean up the ghost copy from the trash
      await supabase.from('deleted_product_types').delete().eq('id', id);

      if (deleteError.code === '23503') {
        throw new Error('Cannot delete this Product Type because it is currently linked to an Active Order. Please delete or reassign the related active orders first.');
      }
      throw deleteError;
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (payload?.userId) {
      await logActivity({
        userId: payload.userId,
        username: payload.username,
        action: 'DELETE',
        module: 'Product Types',
        recordId: id,
        details: { 'Product Type': record.name }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
