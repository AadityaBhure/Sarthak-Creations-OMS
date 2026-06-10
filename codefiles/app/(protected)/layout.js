import AppShell from '@/components/AppShell';
import { SettingsProvider } from '@/components/SettingsProvider';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export default async function ProtectedLayout({ children }) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  const session = sessionCookie ? await verifyToken(sessionCookie.value) : null;

  return (
    <SettingsProvider>
      <AppShell user={session}>{children}</AppShell>
    </SettingsProvider>
  );
}
