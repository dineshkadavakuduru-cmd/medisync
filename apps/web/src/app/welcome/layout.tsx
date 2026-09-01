import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MediSync — Bridging Rural Healthcare with AI',
  description: 'A unified platform connecting Sub-Centres, PHCs, CHCs & District Hospitals — powered by AI triage, real-time monitoring, and offline-first design. Built for SIH 2026 — PS26133',
};

export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
