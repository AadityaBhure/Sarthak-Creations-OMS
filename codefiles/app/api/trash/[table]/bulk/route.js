import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

const TABLE_MAP = {
  'deleted_clients': 'clients',
  'deleted_product_names': 'product_names',
  'deleted_product_types': 'product_types',
  'deleted_orders': 'orders'
};

export async function POST(request, { params }) {
  try {
    const { table } = await params;
    const { action, ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided.' }, { status: 400 });
    }

    const supabase = createServerClient();

    if (action === 'delete') {
      // Permanent delete
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .in('id', ids);

      if (deleteError) throw deleteError;
      return NextResponse.json({ success: true, count: ids.length });
    } 
    
    if (action === 'restore') {
      const targetTable = TABLE_MAP[table];
      if (!targetTable) return NextResponse.json({ error: 'Invalid trash table' }, { status: 400 });

      // Fetch all to restore
      const { data: records, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .in('id', ids);

      if (fetchError) throw fetchError;

      let successCount = 0;
      let duplicateCount = 0;
      let missingMasterCount = 0;

      // Restore one by one to gracefully handle constraints without failing the entire batch
      await Promise.all(records.map(async (record) => {
        const { deleted_at, ...originalRecord } = record;
        const { error: insertError } = await supabase.from(targetTable).insert([originalRecord]);

        if (insertError) {
          if (insertError.code === '23505') {
            duplicateCount++;
          } else if (insertError.code === '23503') {
            missingMasterCount++;
          } else {
            throw insertError;
          }
        } else {
          // If insert succeeds, delete from trash
          await supabase.from(table).delete().eq('id', record.id);
          successCount++;
        }
      }));

      let warnings = [];
      if (duplicateCount > 0) warnings.push(`${duplicateCount} skipped due to duplicate names.`);
      if (missingMasterCount > 0) warnings.push(`${missingMasterCount} skipped due to missing Client/Product List/Type.`);

      return NextResponse.json({ 
        success: true, 
        count: successCount,
        warning: warnings.length > 0 ? warnings.join(' ') : null
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
