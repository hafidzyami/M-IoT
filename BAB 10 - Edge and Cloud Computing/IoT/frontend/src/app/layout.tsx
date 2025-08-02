import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IoT by YB & HS",
  description: "Real-time IoT sensor monitoring dashboard",
  icons: {
    icon: [
      { url: '/favicon.ico' },
    ],
    apple: [
      { url: '/iot-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}