import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import ConditionalLayout from "@/components/ConditionalLayout";
import PWAProvider from "@/components/PWAProvider";

const openSans = Open_Sans({
  variable: "--font-main",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  themeColor: "#1a3a6b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "ARIFA | Seguridad e Higiene Laboral",
  description:
    "Servicios integrales de seguridad e higiene laboral, protección contra incendios y capacitación.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ARIFA",
    startupImage: "/logos/180x180.png",
  },
  icons: {
    icon: "/logos/favicon.png",
    shortcut: "/logos/favicon.png",
    apple: "/logos/180x180.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={openSans.variable}>
      <body>
        <PWAProvider />
        <ConditionalLayout>{children}</ConditionalLayout>
      </body>
    </html>
  );
}
