import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

// Return a response before any database operation when authorization fails.
export async function requireAdmin() {
  const token = (await cookies()).get('session')?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return Response.json({ error: 'Please sign in.' }, { status: 401 });
  if (session.role !== 'admin') {
    return Response.json({ error: 'Administrator access required.' }, { status: 403 });
  }
  return null;
}
