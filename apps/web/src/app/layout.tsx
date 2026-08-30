import './globals.css';
import type { Metadata } from 'next';
import { AppLayout } from '@/components/common/AppLayout';

export const metadata: Metadata = {
  title: 'ArogyaSetu+ | District Command Centre',
  description: 'Rural Healthcare Platform for SIH 2026',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)]">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
