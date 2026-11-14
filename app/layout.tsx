import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sally Mander's · South Austin",
  description: "A simulated coffee shop in South Austin that never closes, built to show how its developer works.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
