import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { readSession } from "../src/server/session";
import { signOut } from "./actions";

// Every page depends on the signed-in person; nothing may be prerendered or cached across people.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Echo of Me",
  description: "Because your love deserves a voice beyond time.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link href={session ? "/home" : "/"} className="brand">
              Echo <span>of</span> Me
            </Link>
            <div className="row header-actions">
              <span className="prerelease" title="Pre-release test build. Do not store real personal material yet.">
                Pre-release test build
              </span>
              {session && (
                <form action={signOut}>
                  <button className="link" type="submit">Sign out</button>
                </form>
              )}
            </div>
          </header>
          <main>{children}</main>
          <footer>
            Echo of Me · By Quintessence Intelligence
          </footer>
        </div>
      </body>
    </html>
  );
}
