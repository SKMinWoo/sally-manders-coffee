import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/shop/Header";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sally Mander's · South Austin", template: "%s · Sally Mander's" },
  description: "A simulated coffee shop in South Austin that never closes, built to show how its developer works.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <Header />
        {children}
        <p className="sim-note">
          Sally Mander&rsquo;s is a simulated coffee shop, built to show how its developer works. The orders,
          the takings and the waits come from a simulator; nothing here is for sale. The figures are open:{" "}
          <Link href="/docs">read the API</Link>, or see <Link href="/office">the back office</Link>, where each line of
          the developer&rsquo;s résumé sits beside the version of it running here.
        </p>
      </body>
    </html>
  );
}
