import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tonphueng Connect | ผึ้งพาเดิน",
  description: "รวมสินค้าและประสบการณ์ชุมชนบ้านต้นผึ้ง จังหวัดเชียงใหม่",
};

export const viewport: Viewport = {
  themeColor: "#f5f7ef",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
