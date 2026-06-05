import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export default async function RootPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  const payload = token ? await verifyToken(token) : null;

  if (payload) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
