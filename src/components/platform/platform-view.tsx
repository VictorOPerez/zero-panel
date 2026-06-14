"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Search,
  Phone,
  Plus,
  CheckCircle2,
  X,
  ShieldAlert,
  Building2,
  PhoneForwarded,
  ExternalLink,
  LogIn,
  Check,
  Trash2,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { PageShell } from "@/components/panel/page-shell";
import {
  listPlatformTenants,
  adminProvisionNumber,
  type PlatformTenant,
} from "@/lib/api/platform";
import {
  searchAvailableNumbers,
  listTenantNumbers,
  updateNumberForward,
} from "@/lib/api/numbers";
import { ApiError } from "@/lib/api/client";
import type { AvailableNumber, TenantNumber } from "@/lib/api/contract";

// Celular del dueño para recibir la llamada de verificación de Meta (por voz).
// Se guarda en el browser del dueño (es su propio centro de control); el botón
// "Redirigir a mí" lo aplica a cualquier número con un clic.
const OWNER_FORWARD_KEY = "zero.platform.ownerForward";

export function PlatformView() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  if (!hydrated) {
    return <div style={loadingStyle}>Cargando…</div>;
  }

  // Defensa en UI (el backend igual gatea a super_admin). El cliente común
  // jamás debería llegar acá porque la entrada del sidebar no le aparece.
  if (user?.role !== "super_admin") {
    return (
      <PageShell title="Centro de Control" subtitle="">
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderRadius: 10,
            border: "1px solid oklch(0.68 0.21 25 / 0.4)",
            background: "oklch(0.68 0.21 25 / 0.08)",
            color: "var(--z-red)",
            fontSize: 13,
          }}
        >
          <ShieldAlert size={16} /> No autorizado. Esta sección es solo para el
          dueño de la plataforma.
        </div>
      </PageShell>
    );
  }

  return <PlatformControl />;
}

function PlatformControl() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ownerForward, setOwnerForward] = useState("");

  // Cargar el celular del dueño guardado.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOwnerForward(window.localStorage.getItem(OWNER_FORWARD_KEY) ?? "");
  }, []);

  function persistOwnerForward(value: string) {
    setOwnerForward(value);
    if (typeof window !== "undefined") {
      const trimmed = value.trim();
      if (trimmed) window.localStorage.setItem(OWNER_FORWARD_KEY, trimmed);
      else window.localStorage.removeItem(OWNER_FORWARD_KEY);
    }
  }

  const tenantsQuery = useQuery({
    queryKey: ["platform-tenants", appliedSearch],
    queryFn: () => listPlatformTenants(appliedSearch || undefined),
  });

  return (
    <PageShell
      title="Centro de Control"
      subtitle="Todos los negocios de la plataforma. Provisioná números llave en mano (sin cobro), entrá a cualquier negocio y entregalo listo."
    >
      {/* Celular del dueño para verificación de Meta */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid oklch(0.80 0.13 200 / 0.25)",
          background: "oklch(0.80 0.13 200 / 0.05)",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <PhoneForwarded size={15} style={{ color: "var(--z-cyan)", flexShrink: 0 }} />
        <div style={{ fontSize: 12.5, color: "var(--text-1)", flex: 1, minWidth: 180 }}>
          <strong style={{ color: "var(--text-0)" }}>Tu celular para Meta.</strong>{" "}
          Cuando conectás un número a WhatsApp, la llamada de verificación se
          redirige a este teléfono. Lo aplicás con un clic por número.
        </div>
        <input
          type="tel"
          value={ownerForward}
          onChange={(e) => persistOwnerForward(e.target.value)}
          placeholder="+13526021604"
          style={{ ...inputStyle, width: 180 }}
        />
      </div>

      {/* Buscador */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedSearch(search.trim());
        }}
        style={{ display: "flex", gap: 8, marginBottom: 16 }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-3)",
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar negocio por nombre…"
            style={{ ...inputStyle, paddingLeft: 30 }}
          />
        </div>
        <button type="submit" style={primaryBtn}>
          Buscar
        </button>
      </form>

      {tenantsQuery.isLoading && (
        <div style={loadingStyle}>Cargando negocios…</div>
      )}

      {tenantsQuery.isError && (
        <div style={errorStyle}>No pudimos cargar los negocios. Reintentá.</div>
      )}

      {tenantsQuery.data && tenantsQuery.data.length === 0 && (
        <div style={loadingStyle}>Sin negocios para esa búsqueda.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tenantsQuery.data?.map((t) => (
          <TenantCard
            key={t.id}
            tenant={t}
            ownerForward={ownerForward.trim()}
            expanded={expanded === t.id}
            onToggle={() =>
              setExpanded((cur) => (cur === t.id ? null : t.id))
            }
          />
        ))}
      </div>
    </PageShell>
  );
}

function TenantCard({
  tenant,
  ownerForward,
  expanded,
  onToggle,
}: {
  tenant: PlatformTenant;
  ownerForward: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const setActiveTenant = useAuthStore((s) => s.setActiveTenant);

  // Impersonación: como super_admin pasa todos los gates del backend, "entrar"
  // = setear el tenant activo. El panel entero pasa a operar como ese negocio.
  function enterTenant() {
    setActiveTenant(tenant.id);
    router.push("/inbox");
  }

  return (
    <div
      className="glass"
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid var(--hair)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--hair)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Building2 size={16} style={{ color: "var(--z-cyan)" }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-0)" }}>
            {tenant.name}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: "var(--text-3)",
              fontFamily: "var(--font-jetbrains-mono)",
              marginTop: 2,
            }}
          >
            {tenant.id}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Chip label={tenant.plan} tone="cyan" />
          <Chip
            label={tenant.status}
            tone={tenant.status === "active" ? "green" : "muted"}
          />
          {tenant.override && <Chip label={tenant.override} tone="amber" />}
        </div>

        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button type="button" onClick={enterTenant} style={ghostBtn} title="Entrar a este negocio (como si fueras el cliente)">
            <LogIn size={13} /> Entrar
          </button>
          <button type="button" onClick={onToggle} style={ghostBtn}>
            <Phone size={13} /> {expanded ? "Cerrar" : "Números"}
          </button>
        </div>
      </div>

      {expanded && (
        <TenantNumbersPanel tenantId={tenant.id} ownerForward={ownerForward} />
      )}
    </div>
  );
}

function TenantNumbersPanel({
  tenantId,
  ownerForward,
}: {
  tenantId: string;
  ownerForward: string;
}) {
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);

  const numbersQuery = useQuery({
    queryKey: ["platform-tenant-numbers", tenantId],
    queryFn: () => listTenantNumbers(tenantId),
  });

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: "1px solid var(--hair)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-3)", fontWeight: 600 }}>
          Números del negocio
        </div>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          style={{ ...primaryBtn, marginLeft: "auto" }}
        >
          <Plus size={13} /> Provisionar (sin cobro)
        </button>
      </div>

      {numbersQuery.isLoading && <div style={loadingStyle}>Cargando…</div>}

      {numbersQuery.data && numbersQuery.data.length === 0 && (
        <div style={{ fontSize: 12.5, color: "var(--text-3)", padding: "6px 0" }}>
          Este negocio todavía no tiene números. Provisioná uno para entregárselo
          listo.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {numbersQuery.data?.map((n) => (
          <NumberLine
            key={n.id}
            number={n}
            tenantId={tenantId}
            ownerForward={ownerForward}
          />
        ))}
      </div>

      {wizardOpen && (
        <ProvisionWizard
          tenantId={tenantId}
          defaultForward={ownerForward}
          onClose={() => setWizardOpen(false)}
          onProvisioned={() => {
            qc.invalidateQueries({
              queryKey: ["platform-tenant-numbers", tenantId],
            });
          }}
        />
      )}
    </div>
  );
}

function NumberLine({
  number,
  tenantId,
  ownerForward,
}: {
  number: TenantNumber;
  tenantId: string;
  ownerForward: string;
}) {
  const qc = useQueryClient();
  const [forward, setForward] = useState(number.forward_to_phone ?? "");
  const [lastServer, setLastServer] = useState(number.forward_to_phone);

  // Sync local cuando el server devuelve otro valor (patrón "ajustar en render").
  if (lastServer !== number.forward_to_phone) {
    setLastServer(number.forward_to_phone);
    setForward(number.forward_to_phone ?? "");
  }

  const mut = useMutation({
    mutationFn: (value: string | null) =>
      updateNumberForward(tenantId, number.id, value),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["platform-tenant-numbers", tenantId] }),
  });

  const statusTone =
    number.status === "active"
      ? "green"
      : number.status === "released"
        ? "muted"
        : "amber";

  const current = number.forward_to_phone ?? "";
  const dirty = forward.trim() !== current;
  const canRedirectToMe = ownerForward && current !== normalize(ownerForward);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid var(--hair)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Phone size={13} style={{ color: "var(--z-cyan)", flexShrink: 0 }} />
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            fontFamily: "var(--font-jetbrains-mono)",
          }}
        >
          +{number.phone_e164}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
          {number.country} · {number.provider}
        </span>
        <span style={{ marginLeft: "auto" }}>
          <Chip label={number.status} tone={statusTone} />
        </span>
      </div>

      {/* Control de reenvío de la llamada de verificación */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-3)",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <PhoneForwarded size={11} /> Reenvío
        </span>
        <input
          type="tel"
          value={forward}
          onChange={(e) => setForward(e.target.value)}
          placeholder="sin reenvío"
          style={{ ...inputStyle, width: 170, padding: "5px 8px", fontSize: 12 }}
          disabled={mut.isPending}
        />
        {dirty && (
          <button
            type="button"
            onClick={() => mut.mutate(forward.trim() || null)}
            disabled={mut.isPending}
            style={miniPrimaryBtn}
            title="Guardar este número de reenvío"
          >
            {mut.isPending ? (
              <Loader2 size={11} style={{ animation: "spin 900ms linear infinite" }} />
            ) : (
              <Check size={11} />
            )}
            Guardar
          </button>
        )}
        {canRedirectToMe && (
          <button
            type="button"
            onClick={() => mut.mutate(ownerForward)}
            disabled={mut.isPending}
            style={miniGhostBtn}
            title="Redirigir la llamada de Meta a tu celular para conectar este número"
          >
            <PhoneForwarded size={11} /> Redirigir a mí
          </button>
        )}
        {current && (
          <button
            type="button"
            onClick={() => mut.mutate(null)}
            disabled={mut.isPending}
            style={miniGhostBtn}
            title="Quitar el reenvío (para que el cliente conecte su propio teléfono)"
          >
            <Trash2 size={11} /> Limpiar
          </button>
        )}
      </div>
    </div>
  );
}

function ProvisionWizard({
  tenantId,
  defaultForward,
  onClose,
  onProvisioned,
}: {
  tenantId: string;
  defaultForward: string;
  onClose: () => void;
  onProvisioned: () => void;
}) {
  const [areaCode, setAreaCode] = useState("");
  const [results, setResults] = useState<AvailableNumber[] | null>(null);
  const [selected, setSelected] = useState<AvailableNumber | null>(null);
  const [forwardToPhone, setForwardToPhone] = useState(defaultForward);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<TenantNumber | null>(null);

  const searchMut = useMutation({
    mutationFn: () =>
      searchAvailableNumbers(tenantId, {
        country: "US",
        areaCode: areaCode.trim() || undefined,
        limit: 20,
      }),
    onSuccess: (items) => {
      setResults(items);
      setSelected(items[0] ?? null);
      setError(null);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError && err.payload.error === "provider_missing_key"
          ? "Falta TELNYX_API_KEY en el backend. Cargala en Railway para poder comprar números."
          : err instanceof ApiError
            ? err.payload.error
            : "Error buscando números."
      );
      setResults(null);
      setSelected(null);
    },
  });

  useEffect(() => {
    searchMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const provisionMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("no_selection");
      return adminProvisionNumber(tenantId, {
        phone_e164: selected.phone_e164,
        country: selected.country,
        forward_to_phone: forwardToPhone.trim() || undefined,
      });
    },
    onSuccess: (number) => {
      setDone(number);
      onProvisioned();
    },
    onError: (err) => {
      setError(
        err instanceof ApiError && err.payload.error === "provider_missing_key"
          ? "Falta TELNYX_API_KEY en el backend."
          : err instanceof ApiError
            ? typeof err.payload.detail === "string"
              ? err.payload.detail
              : err.payload.error
            : "No pudimos provisionar el número."
      );
    },
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !provisionMut.isPending) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="glass"
        style={{
          width: "min(620px, 100%)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 12,
          border: "1px solid var(--hair-strong)",
          background: "var(--surface-1, rgba(15,15,20,0.96))",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px",
            borderBottom: "1px solid var(--hair)",
          }}
        >
          <Phone size={15} style={{ color: "var(--z-cyan)" }} />
          <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
            Provisionar número (sin cobro)
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={provisionMut.isPending}
            aria-label="Cerrar"
            style={iconBtn}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
          {done ? (
            <div
              style={{
                padding: 16,
                borderRadius: 10,
                border: "1px solid oklch(0.78 0.15 155 / 0.35)",
                background: "oklch(0.78 0.15 155 / 0.07)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                <CheckCircle2 size={17} style={{ color: "var(--z-green)" }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}>
                  Número provisionado · +{done.phone_e164}
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55 }}>
                Quedó asignado al negocio <strong>sin cobro</strong>. Ahora
                conectalo a WhatsApp vos mismo:
                <ol style={{ margin: "8px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
                  <li>
                    Verificá que el reenvío apunte a tu celular{" "}
                    {done.forward_to_phone ? `(+${done.forward_to_phone})` : "(usá «Redirigir a mí» en la lista)"}.
                  </li>
                  <li>
                    Abrí{" "}
                    <a
                      href="https://business.facebook.com/wa/manage/phone-numbers/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={linkStyle}
                    >
                      WhatsApp Manager → Phone numbers{" "}
                      <ExternalLink size={10} style={{ display: "inline", verticalAlign: "middle" }} />
                    </a>{" "}
                    y agregá <strong>+{done.phone_e164}</strong> verificando por
                    <strong> llamada (voz)</strong>.
                  </li>
                  <li>
                    Cuando termines, pasá el reenvío al teléfono del cliente (o
                    limpialo) con los botones de la lista.
                  </li>
                </ol>
              </div>
              <button type="button" onClick={onClose} style={{ ...primaryBtn, marginTop: 14 }}>
                Listo
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end", marginBottom: 14 }}>
                <Field label="Area code (opcional · US)">
                  <input
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="305"
                    inputMode="numeric"
                    style={inputStyle}
                    disabled={searchMut.isPending}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    searchMut.mutate();
                  }}
                  disabled={searchMut.isPending}
                  style={primaryBtn}
                >
                  {searchMut.isPending ? (
                    <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
                  ) : (
                    <Search size={13} />
                  )}
                  Buscar
                </button>
              </div>

              {error && <div style={errorStyle}>{error}</div>}

              {results && results.length === 0 && (
                <div style={loadingStyle}>Sin resultados. Probá otro area code.</div>
              )}

              {results && results.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {results.map((item) => {
                    const isSel = selected?.phone_e164 === item.phone_e164;
                    return (
                      <button
                        key={item.phone_e164}
                        type="button"
                        onClick={() => setSelected(item)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 12px",
                          borderRadius: 8,
                          border: isSel ? "1px solid var(--z-cyan)" : "1px solid var(--hair)",
                          background: isSel ? "oklch(0.80 0.13 200 / 0.08)" : "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          color: "var(--text-0)",
                        }}
                      >
                        <Phone size={13} style={{ color: isSel ? "var(--z-cyan)" : "var(--text-3)" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-jetbrains-mono)" }}>
                            +{item.phone_e164}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                            {item.region || item.country}
                          </div>
                        </div>
                        {isSel && <CheckCircle2 size={14} style={{ color: "var(--z-cyan)" }} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {selected && (
                <div style={{ marginTop: 14 }}>
                  <Field label="Celular de reenvío (para el código por voz · opcional)">
                    <input
                      type="tel"
                      value={forwardToPhone}
                      onChange={(e) => setForwardToPhone(e.target.value)}
                      placeholder="+13526021604"
                      style={inputStyle}
                    />
                  </Field>
                  <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 8, lineHeight: 1.5 }}>
                    No se cobra nada: el número queda asignado al negocio. Después
                    lo conectás a Meta vos mismo (OTP por voz a este celular).
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {!done && (
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              padding: "12px 18px",
              borderTop: "1px solid var(--hair)",
              background: "rgba(0,0,0,0.15)",
            }}
          >
            <button type="button" onClick={onClose} disabled={provisionMut.isPending} style={ghostBtn}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => provisionMut.mutate()}
              disabled={!selected || provisionMut.isPending}
              style={{ ...primaryBtn, opacity: !selected ? 0.5 : 1 }}
            >
              {provisionMut.isPending ? (
                <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
              ) : (
                <CheckCircle2 size={13} />
              )}
              {selected ? `Provisionar +${selected.phone_e164}` : "Provisionar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────── Helpers ──────────────────────────────────

// El backend normaliza el teléfono a solo dígitos; comparamos igual para saber
// si el reenvío ya apunta al celular del dueño.
function normalize(phone: string): string {
  return phone.replace(/\D/g, "");
}

type ChipTone = "cyan" | "green" | "amber" | "muted";

function Chip({ label, tone }: { label: string; tone: ChipTone }) {
  const map: Record<ChipTone, { color: string; bg: string; border: string }> = {
    cyan: {
      color: "oklch(0.80 0.13 200)",
      bg: "oklch(0.80 0.13 200 / 0.10)",
      border: "oklch(0.80 0.13 200 / 0.4)",
    },
    green: {
      color: "oklch(0.78 0.18 145)",
      bg: "oklch(0.78 0.18 145 / 0.12)",
      border: "oklch(0.78 0.18 145 / 0.4)",
    },
    amber: {
      color: "oklch(0.85 0.18 90)",
      bg: "oklch(0.85 0.18 90 / 0.10)",
      border: "oklch(0.85 0.18 90 / 0.4)",
    },
    muted: {
      color: "var(--text-3)",
      bg: "rgba(255,255,255,0.04)",
      border: "var(--hair)",
    },
  };
  const cfg = map[tone];
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: "var(--font-jetbrains-mono)",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: 4,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {label}
    </span>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--hair)",
  background: "rgba(0,0,0,0.2)",
  color: "var(--text-0)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  minWidth: 0,
};

const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  borderRadius: 5,
  border: "none",
  background: "var(--aurora)",
  color: "#0a0a0f",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  borderRadius: 5,
  border: "1px solid var(--hair)",
  background: "transparent",
  color: "var(--text-1)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
};

const miniPrimaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 9px",
  borderRadius: 5,
  border: "none",
  background: "var(--aurora)",
  color: "#0a0a0f",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

const miniGhostBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 9px",
  borderRadius: 5,
  border: "1px solid var(--hair)",
  background: "transparent",
  color: "var(--text-1)",
  fontSize: 11,
  fontWeight: 500,
  cursor: "pointer",
};

const iconBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  borderRadius: 6,
  border: "1px solid var(--hair)",
  background: "transparent",
  color: "var(--text-3)",
  cursor: "pointer",
  flexShrink: 0,
};

const loadingStyle: React.CSSProperties = {
  padding: 24,
  textAlign: "center",
  color: "var(--text-3)",
  fontSize: 13,
};

const errorStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid oklch(0.68 0.21 25 / 0.4)",
  background: "oklch(0.68 0.21 25 / 0.08)",
  color: "var(--z-red)",
  fontSize: 12.5,
  marginBottom: 12,
};

const linkStyle: React.CSSProperties = {
  color: "var(--z-cyan)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};
