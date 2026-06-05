import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { name } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Product name is required.' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('product_names')
      .update({ name: name.trim() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A product with this name already exists.' }, { status: 400 });
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
      .from('product_names')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const { error: insertError } = await supabase
      .from('deleted_product_names')
      .insert([record]);

    if (insertError) throw insertError;

    const { error: deleteError } = await supabase
      .from('product_names')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
