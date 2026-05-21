import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CIRIS Review",
  description: "Visual production review & approval for creative teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
