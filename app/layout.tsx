import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Near to me — Find your kind of nearby",
  description:
    "A local discovery guide for the good places around you. Explore, save and share your neighbourhood.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
