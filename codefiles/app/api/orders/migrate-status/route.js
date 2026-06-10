import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

export async function POST(request) {
  try {
    const { oldName, newName } = await request.json();

    if (!oldName || !newName) {
      return NextResponse.json({ error: 'Missing oldName or newName' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Update all orders with the old status to the new status
    const { error } = await supabase
      .from('orders')
      .update({ status: newName })
      .eq('status', oldName);

    if (error) {
      console.error('Error migrating status:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Migrated status from ${oldName} to ${newName}` });
  } catch (err) {
    console.error('Migrate status error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
