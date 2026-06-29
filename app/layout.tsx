import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Watchdog - AI-Powered Monitoring',
  description: 'Real-time API monitoring with AI-powered anomaly detection',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}