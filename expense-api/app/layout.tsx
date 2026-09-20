import "./globals.css";

export const metadata = {
  title: "مصروفاتي",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans bg-bg text-ink min-h-screen">
        <div className="mx-auto max-w-[480px] min-h-screen bg-bg flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
