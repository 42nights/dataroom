import type { Metadata } from "next";
import { Inter, Crimson_Pro } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const crimson = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-crimson",
});

export const metadata: Metadata = {
  title: "42nights Data Room",
  description: "Internal data room for the 42nights team.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${crimson.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
