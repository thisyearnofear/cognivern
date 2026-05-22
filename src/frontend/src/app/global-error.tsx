"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div
          style={{
            padding: "2rem",
            fontFamily: "system-ui",
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          <h1>Something went wrong</h1>
          <p style={{ color: "#666" }}>{error.message}</p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              background: "#0284c7",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
