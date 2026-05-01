import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "48px 20px 96px",
        maxWidth: 760,
        margin: "0 auto",
        color: "var(--text-0)",
        lineHeight: 1.65,
        fontSize: 15,
      }}
    >
      <Link
        href="/"
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.16em",
          color: "var(--text-3)",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        ← Zero by NavApex
      </Link>
      <article style={{ marginTop: 28 }}>{children}</article>
    </div>
  );
}
