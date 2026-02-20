import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Max Success Plan Premium Services Quicksizer",
  description: "Quick sizer and configurator for customer engagement planning."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
