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
  LogIn,
  Check,
  Trash2,
  UserPlus,
  Link2,
  Copy,
  MessageCircle,
  Palette,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { PageShell } from "@/components/panel/page-shell";
import {
  listPlatformTenants,
  createPlatformTenant,
  createMagicLink,
  getWaProfile,
  updateWaProfile,
  listNumberPool,
  assignPoolNumber,
  type PlatformTenant,
  type WaProfile,
  type PoolNumber,
} from "@/lib/api/platform";
import { listTenantNumbers, updateNumberForward } from "@/lib/api/numbers";
import { ApiError } from "@/lib/api/client";
import { TelnyxBalanceCard } from "@/components/platform/telnyx-balance-card";
import { NumberPoolSection } from "@/components/platform/number-pool-section";
import type { TenantNumber } from "@/lib/api/contract";

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
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

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
      subtitle="Todos los negocios de la plataforma. Creá un negocio, provisioná números llave en mano (sin cobro), entrá a cualquiera y entregá un link de acceso."
      actions={
        <button type="button" onClick={() => setCreateOpen(true)} style={primaryBtn}>
          <UserPlus size={13} /> Crear negocio
        </button>
      }
    >
      {/* Saldo del proveedor de números (Telnyx) — siempre visible */}
      <TelnyxBalanceCard />

      {/* Pool de números llave-en-mano */}
      <NumberPoolSection />

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

      {createOpen && (
        <CreateTenantModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["platform-tenants"] });
            setAppliedSearch("");
            setSearch("");
          }}
        />
      )}
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
  const [linkOpen, setLinkOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);

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
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 3,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11.5,
                fontFamily: "var(--font-jetbrains-mono)",
                color: tenant.whatsapp_number ? "var(--text-1)" : "var(--text-3)",
              }}
              title="Número de WhatsApp asignado"
            >
              <MessageCircle
                size={12}
                style={{ color: tenant.whatsapp_number ? "oklch(0.78 0.15 155)" : "var(--text-3)" }}
              />
              {tenant.whatsapp_number
                ? `+${tenant.whatsapp_number.replace(/^\+/, "")}`
                : "sin WhatsApp"}
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--text-3)",
                fontFamily: "var(--font-jetbrains-mono)",
              }}
            >
              {tenant.id}
            </span>
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
          <button type="button" onClick={() => setLinkOpen(true)} style={ghostBtn} title="Generar un link de acceso para el cliente">
            <Link2 size={13} /> Link
          </button>
          <button
            type="button"
            onClick={() => setBrandOpen(true)}
            style={ghostBtn}
            title="Editar la marca de WhatsApp (logo + perfil)"
            disabled={!tenant.whatsapp_enabled}
          >
            <Palette size={13} /> Marca
          </button>
          <button type="button" onClick={onToggle} style={ghostBtn}>
            <Phone size={13} /> {expanded ? "Cerrar" : "Números"}
          </button>
        </div>
      </div>

      {expanded && (
        <TenantNumbersPanel tenantId={tenant.id} ownerForward={ownerForward} />
      )}

      {linkOpen && (
        <MagicLinkModal
          tenantId={tenant.id}
          tenantName={tenant.name}
          onClose={() => setLinkOpen(false)}
        />
      )}

      {brandOpen && (
        <BrandModal
          tenantId={tenant.id}
          tenantName={tenant.name}
          onClose={() => setBrandOpen(false)}
        />
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
          <Plus size={13} /> Asignar del pool
        </button>
      </div>

      {numbersQuery.isLoading && <div style={loadingStyle}>Cargando…</div>}

      {numbersQuery.data && numbersQuery.data.length === 0 && (
        <div style={{ fontSize: 12.5, color: "var(--text-3)", padding: "6px 0" }}>
          Sin números directos. Asigná uno del pool para entregárselo listo (o el
          bot lo hace solo en el onboarding).
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
        <AssignFromPoolModal
          tenantId={tenantId}
          onClose={() => setWizardOpen(false)}
          onAssigned={() => {
            qc.invalidateQueries({ queryKey: ["platform-tenant-numbers", tenantId] });
            qc.invalidateQueries({ queryKey: ["platform-tenants"] });
            qc.invalidateQueries({ queryKey: ["number-pool"] });
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

function AssignFromPoolModal({
  tenantId,
  onClose,
  onAssigned,
}: {
  tenantId: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PoolNumber | null>(null);

  const poolQuery = useQuery({ queryKey: ["number-pool"], queryFn: listNumberPool });
  const available = (poolQuery.data ?? []).filter((n) => n.status === "available");

  const assignMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("no_selection");
      return assignPoolNumber(selected, tenantId);
    },
    onSuccess: (number) => {
      setDone(number);
      onAssigned();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? typeof err.payload.error === "string"
            ? err.payload.error
            : "No pudimos asignar el número."
          : "No pudimos asignar el número."
      ),
  });

  const label = (n: PoolNumber) =>
    (n.whatsapp_number && `+${n.whatsapp_number.replace(/^\+/, "")}`) ||
    (n.phone_e164 && `+${n.phone_e164.replace(/^\+/, "")}`) ||
    n.id;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !assignMut.isPending) onClose();
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
          width: "min(520px, 100%)",
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
          <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Asignar número del pool</div>
          <button
            type="button"
            onClick={onClose}
            disabled={assignMut.isPending}
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
                  Número asignado · {label(done)}
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55 }}>
                Quedó conectado a este negocio: el bot ya responde por ese WhatsApp.
              </div>
              <button type="button" onClick={onClose} style={{ ...primaryBtn, marginTop: 14 }}>
                Listo
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 12 }}>
                Elegí un número <strong>disponible</strong> del pool para entregárselo
                a este negocio. Las credenciales de WhatsApp se copian al instante y
                el bot empieza a responder por ese número.
              </div>

              {poolQuery.isLoading && <div style={loadingStyle}>Cargando pool…</div>}

              {error && <div style={errorStyle}>{error}</div>}

              {poolQuery.data && available.length === 0 && (
                <div style={loadingStyle}>
                  No hay números disponibles en el pool. Comprá y conectá uno en la
                  sección «Pool de números».
                </div>
              )}

              {available.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {available.map((item) => {
                    const isSel = selected === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelected(item.id)}
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
                            {label(item)}
                          </div>
                          {item.label && (
                            <div style={{ fontSize: 11, color: "var(--text-3)" }}>{item.label}</div>
                          )}
                        </div>
                        {isSel && <CheckCircle2 size={14} style={{ color: "var(--z-cyan)" }} />}
                      </button>
                    );
                  })}
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
            <button type="button" onClick={onClose} disabled={assignMut.isPending} style={ghostBtn}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => assignMut.mutate()}
              disabled={!selected || assignMut.isPending}
              style={{ ...primaryBtn, opacity: !selected ? 0.5 : 1 }}
            >
              {assignMut.isPending ? (
                <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
              ) : (
                <CheckCircle2 size={13} />
              )}
              Asignar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────── Modales ─────────────────────────────────

function ModalShell({
  title,
  icon: Icon,
  onClose,
  busy,
  children,
}: {
  title: string;
  icon?: typeof Phone;
  onClose: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
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
          width: "min(520px, 100%)",
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
          {Icon && <Icon size={15} style={{ color: "var(--z-cyan)" }} />}
          <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
            style={iconBtn}
          >
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateTenantModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: () => createPlatformTenant(name.trim()),
    onSuccess: () => {
      onCreated();
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos crear el negocio."
      ),
  });

  return (
    <ModalShell title="Crear negocio" icon={UserPlus} onClose={onClose} busy={mut.isPending}>
      <div style={{ padding: 18 }}>
        <Field label="Nombre del negocio">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Estética Bella"
            style={inputStyle}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim().length >= 2) mut.mutate();
            }}
          />
        </Field>
        <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 8, lineHeight: 1.5 }}>
          Se crea con un trial. El resto (servicios, brief, persona) lo
          configurás vos entrando al negocio, o se lo dejás listo y le pasás un
          link de acceso.
        </div>
        {error && (
          <div style={{ ...errorStyle, marginTop: 12, marginBottom: 0 }}>{error}</div>
        )}
      </div>
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
        <button type="button" onClick={onClose} disabled={mut.isPending} style={ghostBtn}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => mut.mutate()}
          disabled={name.trim().length < 2 || mut.isPending}
          style={{ ...primaryBtn, opacity: name.trim().length < 2 ? 0.5 : 1 }}
        >
          {mut.isPending ? (
            <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
          ) : (
            <UserPlus size={13} />
          )}
          Crear
        </button>
      </div>
    </ModalShell>
  );
}

function MagicLinkModal({
  tenantId,
  tenantName,
  onClose,
}: {
  tenantId: string;
  tenantName: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => createMagicLink(tenantId),
    onSuccess: (res) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setUrl(`${origin}/magic/${res.token}`);
      setError(null);
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos generar el link."
      ),
  });

  useEffect(() => {
    mut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard puede fallar sin https; el usuario copia a mano */
    }
  }

  return (
    <ModalShell title={`Link de acceso · ${tenantName}`} icon={Link2} onClose={onClose}>
      <div style={{ padding: 18 }}>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 12 }}>
          Mandale este link al cliente. Entra <strong>una sola vez</strong> y le
          queda la sesión guardada en su navegador (sin contraseña). Si lo
          pierde, generás otro.
        </div>
        {mut.isPending && <div style={loadingStyle}>Generando link…</div>}
        {error && <div style={errorStyle}>{error}</div>}
        {url && (
          <>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                style={{
                  ...inputStyle,
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: 11.5,
                }}
              />
              <button type="button" onClick={copy} style={primaryBtn}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
              style={{ ...miniGhostBtn, marginTop: 10 }}
            >
              Generar uno nuevo
            </button>
          </>
        )}
      </div>
    </ModalShell>
  );
}

// Rubros de WhatsApp Business (enum de Meta) → etiqueta legible en español.
const VERTICAL_LABELS: Record<string, string> = {
  UNDEFINED: "Sin especificar",
  OTHER: "Otro",
  AUTO: "Automotriz",
  BEAUTY: "Belleza / estética",
  APPAREL: "Ropa / moda",
  EDU: "Educación",
  ENTERTAIN: "Entretenimiento",
  EVENT_PLAN: "Eventos",
  FINANCE: "Finanzas",
  GROCERY: "Supermercado",
  GOVT: "Gobierno",
  HOTEL: "Hotelería",
  HEALTH: "Salud",
  NONPROFIT: "Sin fines de lucro",
  PROF_SERVICES: "Servicios profesionales",
  RETAIL: "Comercio / retail",
  TRAVEL: "Viajes",
  RESTAURANT: "Restaurante",
  NOT_A_BIZ: "No es un negocio",
};

const MAX_LOGO_BYTES = 5_000_000;

function BrandModal({
  tenantId,
  tenantName,
  onClose,
}: {
  tenantId: string;
  tenantName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    about: "",
    description: "",
    address: "",
    email: "",
    website: "",
    vertical: "",
  });
  const [logo, setLogo] = useState<{ base64: string; mime: string; preview: string } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Para no pisar lo que el dueño escribe, hidratamos el form solo una vez.
  const [hydratedFrom, setHydratedFrom] = useState<WaProfile | null>(null);

  const profileQuery = useQuery({
    queryKey: ["wa-profile", tenantId],
    queryFn: () => getWaProfile(tenantId),
  });

  // Hidratar el form con el perfil actual (una sola vez, en render — patrón del
  // resto del panel).
  const profile = profileQuery.data?.profile ?? null;
  if (profile && hydratedFrom !== profile) {
    setHydratedFrom(profile);
    setForm({
      about: profile.about ?? "",
      description: profile.description ?? "",
      address: profile.address ?? "",
      email: profile.email ?? "",
      website: profile.websites?.[0] ?? "",
      vertical: profile.vertical ?? "",
    });
  }

  function pickLogo(file: File) {
    setLogoError(null);
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setLogoError("El logo debe ser JPEG o PNG.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("El logo excede 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setLogo({ base64: result, mime: file.type, preview: result });
    };
    reader.onerror = () => setLogoError("No pudimos leer el archivo.");
    reader.readAsDataURL(file);
  }

  const saveMut = useMutation({
    mutationFn: () =>
      updateWaProfile(tenantId, {
        about: form.about.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        email: form.email.trim(),
        websites: form.website.trim() ? [form.website.trim()] : [],
        vertical: form.vertical || undefined,
        logo_base64: logo?.base64,
        logo_mime: logo?.mime,
      }),
    onSuccess: (res) => {
      setSaved(true);
      setLogo(null);
      setSaveError(null);
      setHydratedFrom(res.profile); // re-hidratar con lo guardado
      qc.invalidateQueries({ queryKey: ["wa-profile", tenantId] });
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) =>
      setSaveError(
        err instanceof ApiError
          ? typeof err.payload.error === "string"
            ? err.payload.error
            : "No pudimos guardar la marca."
          : "No pudimos guardar la marca."
      ),
  });

  const connected = profileQuery.data?.connected ?? false;
  const currentLogoUrl = logo?.preview ?? profile?.profile_picture_url ?? null;

  return (
    <ModalShell
      title={`Marca de WhatsApp · ${tenantName}`}
      icon={Palette}
      onClose={onClose}
      busy={saveMut.isPending}
    >
      <div style={{ padding: 18, overflowY: "auto", maxHeight: "70vh" }}>
        {profileQuery.isLoading && <div style={loadingStyle}>Cargando perfil…</div>}

        {profileQuery.isError && (
          <div style={errorStyle}>
            No pudimos leer el perfil de WhatsApp. Reintentá.
          </div>
        )}

        {profileQuery.data && !connected && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid oklch(0.85 0.18 90 / 0.4)",
              background: "oklch(0.85 0.18 90 / 0.08)",
              color: "var(--text-1)",
              fontSize: 12.5,
              lineHeight: 1.5,
            }}
          >
            Este negocio todavía no tiene WhatsApp conectado. Conectá el número a
            Meta primero y después editás su marca (logo + perfil).
          </div>
        )}

        {profileQuery.data && connected && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  border: "1px solid var(--hair)",
                  background: "rgba(255,255,255,0.03)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {currentLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentLogoUrl}
                    alt="Logo"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <ImageIcon size={22} style={{ color: "var(--text-3)" }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ ...ghostBtn, cursor: "pointer", display: "inline-flex" }}>
                  <Upload size={13} /> {logo ? "Cambiar logo" : "Subir logo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) pickLogo(file);
                    }}
                    style={{ display: "none" }}
                  />
                </label>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
                  JPEG o PNG, cuadrado, hasta 5MB. Se publica al guardar.
                </div>
                {logoError && (
                  <div style={{ fontSize: 11.5, color: "var(--z-red)", marginTop: 4 }}>
                    {logoError}
                  </div>
                )}
              </div>
            </div>

            <Field label="Acerca de (lo que aparece bajo el nombre · máx 139)">
              <input
                value={form.about}
                onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
                maxLength={139}
                placeholder="Estética y bienestar en Miami"
                style={inputStyle}
              />
            </Field>

            <Field label="Descripción (máx 512)">
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                maxLength={512}
                rows={3}
                placeholder="Tratamientos faciales, masajes y más. Reservá por aquí."
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  maxLength={128}
                  placeholder="hola@negocio.com"
                  style={inputStyle}
                />
              </Field>
              <Field label="Sitio web">
                <input
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  maxLength={256}
                  placeholder="https://negocio.com"
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="Dirección (máx 256)">
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                maxLength={256}
                placeholder="Av. Siempre Viva 123, Miami, FL"
                style={inputStyle}
              />
            </Field>

            <Field label="Rubro">
              <select
                value={form.vertical}
                onChange={(e) => setForm((f) => ({ ...f, vertical: e.target.value }))}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">Sin especificar</option>
                {(profileQuery.data.verticals ?? []).map((v) => (
                  <option key={v} value={v}>
                    {VERTICAL_LABELS[v] ?? v}
                  </option>
                ))}
              </select>
            </Field>

            <div
              style={{
                fontSize: 11.5,
                color: "var(--text-2)",
                lineHeight: 1.5,
                paddingTop: 4,
                borderTop: "1px solid var(--hair)",
              }}
            >
              El <strong>nombre que ve el cliente</strong> (display name) se
              gestiona aparte en WhatsApp Manager y necesita aprobación de Meta
              (24–48h) + un sitio web. Esto de acá (logo + perfil) se publica al
              instante, sin aprobación.
            </div>

            {saveError && (
              <div style={{ ...errorStyle, marginBottom: 0 }}>{saveError}</div>
            )}
          </div>
        )}
      </div>

      {profileQuery.data && connected && (
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            alignItems: "center",
            padding: "12px 18px",
            borderTop: "1px solid var(--hair)",
            background: "rgba(0,0,0,0.15)",
          }}
        >
          {saved && (
            <span
              style={{
                fontSize: 12,
                color: "var(--z-green)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                marginRight: "auto",
              }}
            >
              <CheckCircle2 size={13} /> Marca publicada
            </span>
          )}
          <button type="button" onClick={onClose} disabled={saveMut.isPending} style={ghostBtn}>
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            style={primaryBtn}
          >
            {saveMut.isPending ? (
              <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
            ) : (
              <Check size={13} />
            )}
            Publicar en WhatsApp
          </button>
        </div>
      )}
    </ModalShell>
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
