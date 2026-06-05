import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

export async function POST(request) {
  try {
    const { ids } = await request.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided.' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: toDelete, error: fetchError } = await supabase
      .from('product_types')
      .select('*')
      .in('id', ids);

    if (fetchError) throw fetchError;

    if (toDelete && toDelete.length > 0) {
      const { error: insertError } = await supabase
        .from('deleted_product_types')
        .upsert(toDelete.map(r => ({ ...r })), { onConflict: 'id', ignoreDuplicates: true });
      if (insertError) throw insertError;
    }

    const { error: deleteError } = await supabase
      .from('product_types')
      .delete()
      .in('id', ids);

    if (deleteError) {
      if (deleteError.code === '23503') {
        let deletedCount = 0;
        let skippedCount = 0;
        
        await Promise.all(ids.map(async (id) => {
          const { error: singleDeleteError } = await supabase.from('product_types').delete().eq('id', id);
          if (singleDeleteError) {
             skippedCount++;
             await supabase.from('deleted_product_types').delete().eq('id', id);
          } else {
             deletedCount++;
          }
        }));
        
        return NextResponse.json({ 
          success: true, 
          deleted: deletedCount,
          warning: skippedCount > 0 ? `${skippedCount} records were skipped because they are currently used in an order.` : null
        });
      }

      if (toDelete && toDelete.length > 0) {
        await supabase.from('deleted_product_types').delete().in('id', toDelete.map(t => t.id));
      }
      throw deleteError;
    }

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
