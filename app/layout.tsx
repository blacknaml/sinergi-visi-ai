import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

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
      <body className={`${outfit.variable} font-sans antialiased`}>
        <div className="bg-mesh" />
        <main className="relative min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
