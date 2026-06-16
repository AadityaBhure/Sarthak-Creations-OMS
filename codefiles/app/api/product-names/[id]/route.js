import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { name, client_id } = await request.json();

    if (name !== undefined && (!name || String(name).trim() === '')) {
      return NextResponse.json({ error: 'Product list name is required.' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Fetch existing product
    const { data: existingProduct } = await supabase
      .from('product_names')
      .select('name, client_id')
      .eq('id', id)
      .single();

    const updates = {};
    if (name !== undefined) {
      updates.name = String(name).trim();
    }
    if (client_id !== undefined) {
      updates.client_id = client_id || null;
    }

    const { data, error } = await supabase
      .from('product_names')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A product with this name already exists.' }, { status: 400 });
      }
      throw error;
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (payload && (payload.userId || payload.role === 'admin')) {
      if (existingProduct && existingProduct.name !== data.name) {
        await logActivity({
          userId: payload.userId || null,
          username: payload.username || 'Admin',
          action: 'UPDATE',
          module: 'Product Lists',
          recordId: id,
          details: { 'Product List': { old: existingProduct.name, new: data.name } }
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
      .from('product_names')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const { error: insertError } = await supabase
      .from('deleted_product_names')
      .upsert([record]);

    if (insertError) throw insertError;

    const { error: deleteError } = await supabase
      .from('product_names')
      .delete()
      .eq('id', id);

    if (deleteError) {
      // ROLLBACK: If the delete fails, clean up the ghost copy from the trash
      await supabase.from('deleted_product_names').delete().eq('id', id);

      if (deleteError.code === '23503') {
        throw new Error('Cannot delete this Product List because it is currently linked to an Active Order. Please delete or reassign the related active orders first.');
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
        module: 'Product Lists',
        recordId: id,
        details: { 'Product List': record.name }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
