import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { name } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Product type is required.' }, { status: 400 });
    }

    const supabase = createServerClient();
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
      .insert([record]);

    if (insertError) throw insertError;

    const { error: deleteError } = await supabase
      .from('product_types')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
