import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Betting Chain',
  description: 'AI-powered multi-model betting analysis pipeline',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
