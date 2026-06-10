import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

export async function GET() {
  try {
    const supabase = createServerClient();
    
    // Get the retention days from settings
    const { data: settings } = await supabase
      .from('app_config')
      .select('settings')
      .eq('id', 1)
      .single();
      
    const retentionDays = settings?.settings?.log_retention_days || 30;
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffIso = cutoffDate.toISOString();

    // Delete logs older than the cutoff date
    const { error } = await supabase
      .from('activity_logs')
      .delete()
      .lt('created_at', cutoffIso);
      
    if (error) {
      console.error('Error auto-purging activity logs:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Purged logs older than ${retentionDays} days.` });
  } catch (error) {
    console.error('Logs cleanup error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
