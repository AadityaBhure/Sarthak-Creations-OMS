import AppShell from '@/components/AppShell';

export default function ProtectedLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
