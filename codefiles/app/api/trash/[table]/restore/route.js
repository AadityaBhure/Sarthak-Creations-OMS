import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

const TABLE_MAP = {
  'deleted_clients': 'clients',
  'deleted_product_names': 'product_names',
  'deleted_product_types': 'product_types',
  'deleted_orders': 'orders'
};

export async function POST(request, { params }) {
  try {
    const { table } = await params;
    const targetTable = TABLE_MAP[table];

    if (!targetTable) {
      return NextResponse.json({ error: 'Invalid trash table' }, { status: 400 });
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID is required to restore' }, { status: 400 });
    }

    const supabase = createServerClient();

    // 1. Fetch from trash
    const { data: record, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // 2. Remove the deleted_at field before inserting back
    const { deleted_at, ...originalRecord } = record;

    // 3. Insert back to original table
    const { error: insertError } = await supabase
      .from(targetTable)
      .insert([originalRecord]);

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'A record with this name already exists in the active list. You cannot restore this unless the active one is deleted/renamed.' }, { status: 400 });
      }
      if (insertError.code === '23503') {
        return NextResponse.json({ error: 'Cannot restore this Order because the Client or Product it belongs to is currently in the Recycle Bin. Please restore them first.' }, { status: 400 });
      }
      throw insertError;
    }

    // 4. Delete from trash
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (payload?.userId) {
      let identifier = originalRecord.name || originalRecord.po_number || originalRecord.first_name || 'Unknown Item';
      await logActivity({
        userId: payload.userId,
        username: payload.username,
        action: 'RESTORE',
        module: 'Deleted Records',
        recordId: id,
        details: { 'Restored Item': identifier }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
