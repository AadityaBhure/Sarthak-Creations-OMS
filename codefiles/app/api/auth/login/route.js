import { createServerClient } from '@/lib/supabaseClient';
import { signToken } from '@/lib/auth';
import { compare, hash } from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;
    const supabase = createServerClient();

    if (action === 'register') {
      const { first_name, last_name, username, phone_number, password } = body;

      if (!first_name || !last_name || !username || !phone_number || !password) {
        return Response.json({ error: 'All fields are required.' }, { status: 400 });
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .or(`username.eq.${username},phone_number.eq.${phone_number}`)
        .maybeSingle();

      if (existingUser) {
        return Response.json(
          { error: 'A user with this username or phone number already exists.' },
          { status: 400 }
        );
      }

      const password_hash = await hash(password, 10);

      // Insert new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            username: username.trim(),
            phone_number: phone_number.trim(),
            password_hash
          }
        ])
        .select('id, first_name, last_name, username, phone_number, role')
        .single();

      if (insertError) {
        console.error('[register insert error]', insertError);
        return Response.json({ error: 'Failed to create user.' }, { status: 500 });
      }

      // Sign JWT and set httpOnly cookie
      const token = await signToken({
        authenticated: true,
        userId: newUser.id,
        username: newUser.username,
        role: newUser.role,
        firstName: newUser.first_name,
        lastName: newUser.last_name
      });
      
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const cookieStore = await cookies();
      cookieStore.set('session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
        sameSite: 'lax',
        path: '/',
      });

      return Response.json({ success: true, user: { id: newUser.id, username: newUser.username } }, { status: 200 });
    }

    if (action === 'login') {
      const { identifier, password } = body;

      if (!identifier || !password) {
        return Response.json(
          { error: 'Username/Phone and password are required.' },
          { status: 400 }
        );
      }
      
      // Find user by either username or phone number
      const { data: user, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, username, password_hash, role')
        .or(`username.eq.${identifier},phone_number.eq.${identifier}`)
        .maybeSingle();

      if (error || !user) {
        // Fallback to app_config logic JUST IN CASE it's the admin account and they haven't migrated it into users table yet
        if (identifier === 'admin') {
           const { data: rows } = await supabase.from('app_config').select('key, value').in('key', ['username', 'password_hash']);
           const storedUsername = rows?.find((r) => r.key === 'username')?.value;
           const storedPasswordHash = rows?.find((r) => r.key === 'password_hash')?.value;
           if (identifier.toLowerCase() === storedUsername?.toLowerCase()) {
              const passwordMatch = await compare(password, storedPasswordHash);
              if (passwordMatch) {
                const token = await signToken({ authenticated: true, role: 'admin' });
                const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                const cookieStore = await cookies();
                cookieStore.set('session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', expires: expiresAt, sameSite: 'lax', path: '/' });
                return Response.json({ success: true }, { status: 200 });
              }
           }
        }
        
        return Response.json(
          { error: 'Invalid username/phone or password.' },
          { status: 401 }
        );
      }

      // Validate password using bcrypt
      const passwordMatch = await compare(password, user.password_hash);
      if (!passwordMatch) {
        return Response.json(
          { error: 'Invalid username/phone or password.' },
          { status: 401 }
        );
      }

      // Sign JWT and set httpOnly cookie
      const token = await signToken({ 
        authenticated: true,
        userId: user.id,
        username: user.username,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      });
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
    }

    return Response.json({ error: 'Invalid action.' }, { status: 400 });

  } catch (err) {
    console.error('[auth API error]', err);
    return Response.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
