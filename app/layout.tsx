import './globals.css';
import { Providers } from '@/components/ui/providers';
import { Sora } from 'next/font/google';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sora.variable} antialiased`}>
        <Providers>
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
