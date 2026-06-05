import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

// Allowed tables for trash operations
const ALLOWED_TABLES = [
  'deleted_clients',
  'deleted_product_names',
  'deleted_product_types',
  'deleted_orders'
];

export async function GET(request, { params }) {
  try {
    const { table } = await params;
    
    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Invalid trash table' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('deleted_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { table } = await params;
    
    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Invalid trash table' }, { status: 400 });
    }

    // Read ID from search params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required for permanent deletion' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
