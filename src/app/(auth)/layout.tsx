import { QueryProvider } from "@/providers/query-provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 20px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </QueryProvider>
  );
}
