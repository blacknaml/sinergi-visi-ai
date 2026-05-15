import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "SinergiVisi AI | Autonomous Customer Support",
  description: "Instant claim validation for household glassware using Gemini 3 Flash.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="font-sans antialiased">
        <div className="bg-mesh" />
        <main className="relative min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
