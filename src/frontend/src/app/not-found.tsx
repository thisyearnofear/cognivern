import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        padding: "2rem",
        fontFamily: "system-ui",
        textAlign: "center",
      }}
    >
      <h1>404 — Page not found</h1>
      <p>The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link
        href="/"
        style={{
          display: "inline-block",
          marginTop: "1rem",
          padding: "0.5rem 1rem",
          background: "#0284c7",
          color: "white",
          borderRadius: "0.5rem",
          textDecoration: "none",
        }}
      >
        Go home
      </Link>
    </div>
  );
}
