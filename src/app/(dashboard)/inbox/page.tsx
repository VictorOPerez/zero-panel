import { Suspense } from "react";
import { InboxView } from "@/components/inbox/inbox-view";

export const metadata = { title: "Inbox — Zero" };

export default function InboxPage() {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <InboxView />
    </Suspense>
  );
}

function InboxSkeleton() {
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* List skeleton */}
      <section
        style={{
          width: 360,
          flexShrink: 0,
          borderRight: "1px solid var(--hair)",
          background: "rgba(0,0,0,0.12)",
          padding: 14,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 40 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ display: "flex", gap: 10 }}>
              <div className="shimmer" style={{ width: 30, height: 30, borderRadius: 15, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="shimmer" style={{ width: "50%", height: 11, borderRadius: 4 }} />
                <div className="shimmer" style={{ width: "90%", height: 10, borderRadius: 4 }} />
                <div className="shimmer" style={{ width: 60, height: 10, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* Conversation skeleton */}
      <div style={{ flex: 1, padding: 20 }}>
        <div className="shimmer" style={{ width: 260, height: 20, borderRadius: 4 }} />
        <div style={{ height: 8 }} />
        <div className="shimmer" style={{ width: 180, height: 12, borderRadius: 4 }} />
        <div style={{ height: 24 }} />
        {[240, 320, 200, 280].map((w, i) => (
          <div key={i} style={{ display: "flex", justifyContent: i % 2 ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div className="shimmer" style={{ width: w, height: 48, borderRadius: 10 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
