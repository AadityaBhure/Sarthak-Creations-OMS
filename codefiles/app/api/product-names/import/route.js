import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

export async function POST(request) {
  try {
    const { rows } = await request.json(); // Array of { name }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data provided.' }, { status: 400 });
    }

    // Clean data
    const validRows = rows
      .map(row => ({ name: row.name ? row.name.trim() : '' }))
      .filter(row => row.name !== '');

    if (validRows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in the CSV.' }, { status: 400 });
    }

    const supabase = createServerClient();
    
    // Bulk upsert ignoring duplicates
    const { data, error } = await supabase
      .from('product_names')
      .upsert(validRows, { onConflict: 'name', ignoreDuplicates: true })
      .select();

    if (error) throw error;

    const insertedCount = data ? data.length : 0;
    const skippedCount = rows.length - insertedCount;

    return NextResponse.json({ 
      success: true, 
      inserted: insertedCount, 
      skipped: skippedCount 
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
