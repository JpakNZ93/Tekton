import "./globals.css";
import "../styles/annotation.css";
import Link from "next/link";

export const metadata = {
  title: "Tekton 营造",
  description:
    "Tekton 营造 — evidence-based 3D reconstruction. Nothing renders without a cited source. Notre-Dame de Paris (la flèche, west towers) · Nanchan Temple.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-md border border-zinc-700/80 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur">
          <Link href="/" className="hover:text-white">
            Home
          </Link>
          <span className="text-zinc-600">|</span>
          <Link href="/projects" className="hover:text-white">
            Projects
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
