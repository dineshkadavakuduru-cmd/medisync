'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { ToastContainer } from '@/components/common/Toast';

const NO_SIDEBAR_ROUTES = ['/welcome'];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !NO_SIDEBAR_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="container">{children}</div>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
