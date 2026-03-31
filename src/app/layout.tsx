"use client";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { usePathname } from "next/navigation";

const openSans = Open_Sans({
  variable: "--font-main",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <html lang="es" className={openSans.variable}>
      <body>
        {!isAdmin && <Header />}
        <main>{children}</main>
        {!isAdmin && <Footer />}
      </body>
    </html>
  );
}
