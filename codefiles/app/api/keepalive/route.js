import { createServerClient } from '@/lib/supabaseClient';

export async function GET() {
  try {
    const supabase = createServerClient();
    // Minimal query to keep Supabase project alive (prevents free-tier pause)
    await supabase.from('clients').select('id').limit(1);
    return Response.json({ alive: true }, { status: 200 });
  } catch {
    return Response.json({ alive: false }, { status: 500 });
  }
}
