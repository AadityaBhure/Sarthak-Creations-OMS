import AppShell from '@/components/AppShell';
import { SettingsProvider } from '@/components/SettingsProvider';

export default function ProtectedLayout({ children }) {
  return (
    <SettingsProvider>
      <AppShell>{children}</AppShell>
    </SettingsProvider>
  );
}
