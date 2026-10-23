import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Mitr } from "next/font/google";
import "./globals.css";

const bodyFont = IBM_Plex_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });
const displayFont = Mitr({ subsets: ["thai", "latin"], weight: ["500", "600"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "Tonphueng Connect | ผึ้งพาเดิน",
  description: "รวมสินค้าและประสบการณ์ชุมชนบ้านต้นผึ้ง จังหวัดเชียงใหม่",
  icons: { icon: "/images/logo.jpeg", apple: "/images/logo.jpeg" },
};

export const viewport: Viewport = {
  themeColor: "#264830",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
