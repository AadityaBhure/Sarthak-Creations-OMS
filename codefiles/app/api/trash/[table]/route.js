import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

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

    // --- AUTO-PURGE LOGIC ---
    // Fetch global retention days
    const { data: settingsData } = await supabase
      .from('global_settings')
      .select('recycle_retention_days')
      .eq('id', 'default')
      .single();
    
    const retentionDays = settingsData?.recycle_retention_days || 10;
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffIso = cutoffDate.toISOString();

    // Perform hard delete on records older than cutoff date
    await supabase
      .from(table)
      .delete()
      .lt('deleted_at', cutoffIso);
    // ------------------------

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

    // Fetch the record to log what was permanently deleted
    const { data: recordToLog } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) throw error;

    if (recordToLog) {
      const cookieStore = await cookies();
      const token = cookieStore.get('session')?.value;
      const payload = token ? await verifyToken(token) : null;
      if (payload?.userId) {
        let identifier = recordToLog.name || recordToLog.po_number || recordToLog.first_name || 'Unknown Item';
        await logActivity({
          userId: payload.userId,
          username: payload.username,
          action: 'DELETE',
          module: 'Deleted Records',
          recordId: id,
          details: { 'Permanently Deleted Item': identifier }
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
