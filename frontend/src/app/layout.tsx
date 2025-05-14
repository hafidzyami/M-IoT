import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "M-IoT Dashboard",
  description: "By Prof Y Bandung & Hafidz Shidqi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
