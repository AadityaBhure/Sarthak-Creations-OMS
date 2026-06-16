import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'Sarthak Creations — Order Management System',
  description: 'Internal order tracking and production management system for Sarthak Creations.',
};

export default function RootLayout({ children }) {
  const initScript = `
    try {
      const d = localStorage.getItem('oms-density') || 'comfortable';
      document.documentElement.setAttribute('data-density', d);
      
      const t = localStorage.getItem('oms-theme') || 'light';
      document.documentElement.setAttribute('data-theme', t);
    } catch (e) {}
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
