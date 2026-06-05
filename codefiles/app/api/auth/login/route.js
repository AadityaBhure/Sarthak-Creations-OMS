import { createServerClient } from '@/lib/supabaseClient';
import { signToken } from '@/lib/auth';
import { compare } from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return Response.json(
        { error: 'Username and password are required.' },
        { status: 400 }
      );
    }

    // Fetch credentials from Supabase app_config table
    const supabase = createServerClient();
    const { data: rows, error } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['username', 'password_hash']);

    if (error || !rows || rows.length < 2) {
      return Response.json(
        { error: 'Authentication service unavailable.' },
        { status: 503 }
      );
    }

    const storedUsername = rows.find((r) => r.key === 'username')?.value;
    const storedPasswordHash = rows.find((r) => r.key === 'password_hash')?.value;

    // Validate username (case-insensitive)
    if (username.toLowerCase() !== storedUsername?.toLowerCase()) {
      return Response.json(
        { error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    // Validate password using bcrypt
    const passwordMatch = await compare(password, storedPasswordHash);
    if (!passwordMatch) {
      return Response.json(
        { error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    // Sign JWT and set httpOnly cookie
    const token = await signToken({ authenticated: true });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const cookieStore = await cookies();
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
      sameSite: 'lax',
      path: '/',
    });

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[login]', err);
    return Response.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
