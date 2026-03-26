import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const openSans = Open_Sans({
  variable: "--font-main",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "ARIFA | Especialistas en Seguridad e Higiene Laboral",
  description:
    "ARIFA: Asesoramiento integral en seguridad e higiene laboral, protección contra incendios, capacitaciones y elaboración de documentación técnica en Córdoba, Argentina.",
  keywords: "seguridad, higiene laboral, protección contra incendios, matafuegos, córdoba, argentina, ARIFA",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={openSans.variable}>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
