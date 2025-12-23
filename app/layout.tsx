import './globals.css';
import { Providers } from '@/components/ui/providers';
import { Sora } from 'next/font/google';
import { Kantumruy_Pro } from 'next/font/google';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
});

const kantumruyPro = Kantumruy_Pro({
  subsets: ['khmer', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-kantumruy-pro',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sora.variable} ${kantumruyPro.variable} antialiased`}>
        <Providers>
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
