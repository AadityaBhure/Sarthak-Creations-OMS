import './globals.css';

export const metadata = {
  title: 'Sarthak Creations — Order Management System',
  description: 'Internal order tracking and production management system for Sarthak Creations.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
