"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAdminAudit } from "@/lib/api/admins";
import { listAdmins } from "@/lib/api/admins";
import { cardStyle } from "@/components/panel/page-shell";
import type { AdminAuditEntry, AdminAuditResult } from "@/lib/api/contract";

const PAGE_SIZE = 50;
const RESULT_OPTIONS: Array<{ value: AdminAuditResult | ""; label: string }> = [
  { value: "", label: "Todos" },
  { value: "ok", label: "OK" },
  { value: "failed", label: "Failed" },
  { value: "denied", label: "Denied" },
  { value: "unverified", label: "Unverified" },
  { value: "expired_confirm", label: "Expired confirm" },
];

export function AdminAuditView({ tenantId }: { tenantId: string }) {
  const [adminFilter, setAdminFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [resultFilter, setResultFilter] = useState<AdminAuditResult | "">("");
  const [page, setPage] = useState(0);

  const admins = useQuery({
    queryKey: ["admins", tenantId],
    queryFn: () => listAdmins(tenantId),
  });

  const audit = useQuery({
    queryKey: [
      "admin-audit",
      tenantId,
      adminFilter,
      actionFilter,
      resultFilter,
      page,
    ],
    queryFn: () =>
      listAdminAudit(tenantId, {
        admin_user_id: adminFilter || undefined,
        action: actionFilter || undefined,
        result: resultFilter || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });

  const items = audit.data?.items ?? [];
  const total = audit.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const adminLabelById = new Map(
    (admins.data ?? []).map((a) => [a.id, a.label || `+${a.phone_e164}`])
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <FilterLabel>Admin</FilterLabel>
        <select
          value={adminFilter}
          onChange={(e) => {
            setAdminFilter(e.target.value);
            setPage(0);
          }}
          style={selectStyle}
        >
          <option value="">Todos</option>
          {(admins.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.label || `+${a.phone_e164}`}
            </option>
          ))}
        </select>

        <FilterLabel>Acción</FilterLabel>
        <input
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(0);
          }}
          placeholder="ej: stats.read"
          style={{ ...inputStyle, minWidth: 160 }}
        />

        <FilterLabel>Resultado</FilterLabel>
        <select
          value={resultFilter}
          onChange={(e) => {
            setResultFilter(e.target.value as AdminAuditResult | "");
            setPage(0);
          }}
          style={selectStyle}
        >
          {RESULT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <div style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text-3)" }}>
          {total} entries · página {page + 1}/{totalPages}
        </div>
      </div>

      {audit.isLoading && !audit.data && (
        <div style={{ padding: 24, color: "var(--text-2)", fontSize: 12.5 }}>
          Cargando audit log…
        </div>
      )}

      {audit.data && items.length === 0 && (
        <div
          className="glass"
          style={{ ...cardStyle, color: "var(--text-2)", fontSize: 12.5 }}
        >
          Sin entradas para los filtros aplicados.
        </div>
      )}

      {items.length > 0 && (
        <div
          className="glass"
          style={{ ...cardStyle, padding: 0, overflow: "hidden" }}
        >
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
          >
            <thead>
              <tr style={{ background: "var(--hair)" }}>
                <Th>Fecha</Th>
                <Th>Admin</Th>
                <Th>Acción</Th>
                <Th>Resultado</Th>
                <Th>Detalle</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <AuditRow
                  key={entry.id}
                  entry={entry}
                  adminLabel={
                    entry.admin_user_id
                      ? adminLabelById.get(entry.admin_user_id) ??
                        `+${entry.admin_phone}`
                      : `+${entry.admin_phone}`
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={pageButtonStyle}
          >
            ← Anterior
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= totalPages}
            style={pageButtonStyle}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function AuditRow({
  entry,
  adminLabel,
}: {
  entry: AdminAuditEntry;
  adminLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = entry.payload || entry.result_detail;

  return (
    <>
      <tr
        style={{
          borderTop: "1px solid var(--hair)",
          cursor: hasDetail ? "pointer" : "default",
        }}
        onClick={() => hasDetail && setExpanded(!expanded)}
      >
        <Td>
          <span style={{ color: "var(--text-2)", fontSize: 11.5 }}>
            {new Date(entry.created_at).toLocaleString()}
          </span>
        </Td>
        <Td>
          <span style={{ fontSize: 12 }}>{adminLabel}</span>
        </Td>
        <Td>
          <code
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 11,
              color: "var(--text-1)",
            }}
          >
            {entry.action}
          </code>
        </Td>
        <Td>
          <ResultBadge result={entry.result} />
        </Td>
        <Td>
          <span style={{ color: "var(--text-3)", fontSize: 11.5 }}>
            {hasDetail
              ? expanded
                ? "▾ ocultar"
                : "▸ ver"
              : "—"}
          </span>
        </Td>
      </tr>
      {expanded && hasDetail && (
        <tr style={{ background: "var(--bg-2)" }}>
          <td colSpan={5} style={{ padding: "10px 14px 14px" }}>
            <DetailPanel
              payload={entry.payload}
              resultDetail={entry.result_detail}
              traceId={entry.trace_id}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function DetailPanel({
  payload,
  resultDetail,
  traceId,
}: {
  payload: unknown;
  resultDetail: unknown;
  traceId: string | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {traceId && (
        <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>
          trace_id:{" "}
          <code style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            {traceId}
          </code>
        </div>
      )}
      {payload != null && (
        <CodeBlock label="payload" value={payload} />
      )}
      {resultDetail != null && (
        <CodeBlock label="result_detail" value={resultDetail} />
      )}
    </div>
  );
}

function CodeBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <pre
        style={{
          margin: 0,
          padding: 10,
          background: "var(--bg-1)",
          border: "1px solid var(--hair)",
          borderRadius: 5,
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: 11,
          color: "var(--text-1)",
          overflow: "auto",
          maxHeight: 280,
        }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function ResultBadge({ result }: { result: AdminAuditResult }) {
  const color =
    result === "ok"
      ? "var(--z-green)"
      : result === "failed"
        ? "var(--z-red)"
        : result === "denied" || result === "unverified"
          ? "var(--z-amber)"
          : "var(--text-3)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 600,
        color,
        border: `1px solid ${color}`,
      }}
    >
      {result}
    </span>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10.5,
        color: "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "9px 14px",
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "var(--text-3)",
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "9px 14px", verticalAlign: "middle" }}>{children}</td>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 5,
  border: "1px solid var(--hair-strong)",
  background: "var(--bg-2)",
  color: "var(--text-0)",
  fontSize: 12,
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const pageButtonStyle: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 5,
  border: "1px solid var(--hair-strong)",
  background: "transparent",
  color: "var(--text-1)",
  fontSize: 11.5,
  cursor: "pointer",
};
