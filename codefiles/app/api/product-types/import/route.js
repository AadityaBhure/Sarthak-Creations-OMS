import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

const BATCH_SIZE = 200;

export async function POST(request) {
  try {
    const { rows } = await request.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data provided.' }, { status: 400 });
    }

    const cleanedRows = rows.map(row => ({ name: row.name ? row.name.trim() : '' }));

    const supabase = createServerClient();

    // Fetch existing product types to check for duplicates
    const { data: existingTypes, error: existingError } = await supabase
      .from('product_types')
      .select('name');
    
    if (existingError) throw existingError;

    const existingSet = new Set(existingTypes.map(pt => pt.name.toLowerCase()));

    const recordsToInsert = [];
    const skippedRows = [];
    const insertedRows = [];

    cleanedRows.forEach(row => {
      if (!row.name) {
        skippedRows.push({ ...row, reason: 'Missing name' });
        return;
      }

      const nameLower = row.name.toLowerCase();
      
      if (!existingSet.has(nameLower)) {
        recordsToInsert.push(row);
        existingSet.add(nameLower); // prevent duplicates within the same import file
      } else {
        skippedRows.push({ ...row, reason: 'Duplicate product type' });
      }
    });

    let totalInserted = 0;
    if (recordsToInsert.length > 0) {
      for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
        const batch = recordsToInsert.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
          .from('product_types')
          .insert(batch)
          .select();

        if (error) throw error;
        if (data) {
          totalInserted += data.length;
          insertedRows.push(...data);
        }
      }
    }

    return NextResponse.json({
      success: true,
      inserted: totalInserted,
      skipped: skippedRows.length,
      insertedRows: insertedRows,
      skippedRows: skippedRows
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
