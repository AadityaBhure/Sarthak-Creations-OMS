import { createServerClient } from '@/lib/supabaseClient';
import { compare } from 'bcryptjs';

export async function POST(request) {
  try {
    const { password } = await request.json();

    if (!password) {
      return Response.json({ error: 'Password is required.' }, { status: 400 });
    }

    // Fetch credentials from Supabase app_config table
    const supabase = createServerClient();
    const { data: rows, error } = await supabase
      .from('app_config')
      .select('key, value')
      .eq('key', 'password_hash');

    if (error || !rows || rows.length === 0) {
      return Response.json(
        { error: 'Authentication service unavailable.' },
        { status: 503 }
      );
    }

    const storedPasswordHash = rows[0].value;

    // Validate password using bcrypt
    const passwordMatch = await compare(password, storedPasswordHash);
    if (!passwordMatch) {
      return Response.json({ success: false }, { status: 401 });
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[verify-password]', err);
    return Response.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
