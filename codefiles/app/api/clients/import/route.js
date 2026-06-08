import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

const BATCH_SIZE = 200;

export async function POST(request) {
  try {
    const { rows } = await request.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data provided.' }, { status: 400 });
    }

    // Clean data
    const validRows = rows
      .map(row => ({
        name: row.name ? String(row.name).trim() : '',
        address: row.address ? String(row.address).trim() : null,
        phone_number: row.phone_number ? String(row.phone_number).trim() : null
      }))
      .filter(row => row.name !== '');

    if (validRows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in the CSV.' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Split into chunks and upsert each batch
    let totalInserted = 0;
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from('clients')
        .upsert(batch, { onConflict: 'name', ignoreDuplicates: true })
        .select();

      if (error) throw error;
      totalInserted += data ? data.length : 0;
    }

    const skippedCount = validRows.length - totalInserted;

    return NextResponse.json({
      success: true,
      inserted: totalInserted,
      skipped: skippedCount
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
