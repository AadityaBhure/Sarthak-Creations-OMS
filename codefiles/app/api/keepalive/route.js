import { createServerClient } from '@/lib/supabaseClient';

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const supabase = createServerClient();
    // Minimal query to keep Supabase project alive (prevents free-tier pause)
    const { error } = await supabase.from('clients').select('id').limit(1);
    if (error) throw error;
    return Response.json({ alive: true }, { status: 200 });
  } catch {
    return Response.json({ alive: false }, { status: 500 });
  }
}
