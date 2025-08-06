import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import DevFooter from "@/components/DevFooter";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Client Insights Hub",
  description: "Health and wellness coaching platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <DevFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
