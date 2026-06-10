import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('global_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const supabase = createServerClient();

    // Fetch existing settings
    const { data: existingSettings } = await supabase
      .from('global_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    const { error } = await supabase
      .from('global_settings')
      .update(body)
      .eq('id', 'default');

    if (error) throw error;

    // Log the activity
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (payload && (payload.userId || payload.role === 'admin')) {
      const changes = {};
      if (existingSettings) {
        for (const key of Object.keys(body)) {
          if (existingSettings[key] !== body[key]) {
            changes[key] = { old: existingSettings[key], new: body[key] };
          }
        }
      }

      if (Object.keys(changes).length > 0) {
        await logActivity({
          userId: payload.userId || null,
          username: payload.username || 'Admin',
          action: 'UPDATE',
          module: 'Settings',
          recordId: 'default',
          details: changes
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
