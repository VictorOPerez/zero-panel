"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  Trash2,
  Phone,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  X,
  PhoneForwarded,
  ShoppingCart,
  BadgeCheck,
  MessageCircle,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getNumbersAvailability,
  startNumberCheckout,
  listTenantNumbers,
  markNumberConnected,
  releaseTenantNumber,
  searchAvailableNumbers,
  updateNumberForward,
} from "@/lib/api/numbers";
import { ApiError } from "@/lib/api/client";
import { PageShell, cardStyle } from "@/components/panel/page-shell";
import { RequireTenant } from "@/components/panel/require-tenant";
import type {
  AvailableNumber,
  TenantNumber,
  TenantNumberStatus,
} from "@/lib/api/contract";

const COUNTRIES = [
  { code: "US", label: "Estados Unidos (US)" },
] as const;

export function NumbersView() {
  return (
    <RequireTenant>{(tenantId) => <Numbers tenantId={tenantId} />}</RequireTenant>
  );
}

function Numbers({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const query = useQuery({
    queryKey: ["tenant-numbers", tenantId],
    queryFn: () => listTenantNumbers(tenantId),
    // Tras volver del Checkout, el número se aprovisiona por webhook (async):
    // polleamos SOLO hasta que aparezca (no para siempre).
    refetchInterval: (q) =>
      success && (q.state.data?.length ?? 0) === 0 ? 4000 : false,
  });

  // ¿Se pueden vender números ahora? (refleja el candado server-side en la UI)
  const availabilityQuery = useQuery({
    queryKey: ["numbers-availability", tenantId],
    queryFn: () => getNumbersAvailability(tenantId),
    staleTime: 60_000,
  });
  // Default optimista mientras carga: el server igual corta antes de cobrar.
  const sellable = availabilityQuery.data?.sellable !== false;
  const unsellableMessage =
    availabilityQuery.data && !availabilityQuery.data.sellable
      ? availabilityQuery.data.message
      : null;

  // Cuando el número ya apareció, cortamos el banner de "activando…".
  useEffect(() => {
    if (success && (query.data?.length ?? 0) > 0) setSuccess(null);
  }, [success, query.data]);

  // Timeout del polling: si tras el pago el número NO aparece en ~2 min, la
  // compra falló (Telnyx rechazó, etc.) y el cobro se reembolsa solo. Cortamos
  // el banner "activando…" y avisamos, en vez de girar para siempre.
  useEffect(() => {
    if (!success) return;
    const POLL_TIMEOUT_MS = 120_000;
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    const iv = setInterval(() => {
      const count =
        qc.getQueryData<TenantNumber[]>(["tenant-numbers", tenantId])?.length ?? 0;
      if (count > 0) {
        clearInterval(iv);
        return;
      }
      if (Date.now() >= deadline) {
        clearInterval(iv);
        setSuccess(null);
        setError(
          "No pudimos confirmar la compra del número. Si Stripe te cobró, el cargo " +
            "se reembolsa automáticamente. Probá de nuevo en un rato o escribinos."
        );
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [success, qc, tenantId]);

  // Resultado del Stripe Checkout (?purchased=ok|cancel). El número aparece
  // cuando el webhook lo aprovisiona — refrescamos la lista.
  useEffect(() => {
    const purchased = searchParams.get("purchased");
    if (!purchased) return;
    if (purchased === "ok") {
      setSuccess(
        "¡Pago confirmado! Estamos activando tu número, aparece en unos segundos."
      );
      setError(null);
      qc.invalidateQueries({ queryKey: ["tenant-numbers", tenantId] });
    } else if (purchased === "cancel") {
      setError("Cancelaste el pago. No se compró ningún número.");
    }
    router.replace("/numbers", { scroll: false });
  }, [searchParams, router, qc, tenantId]);

  return (
    <PageShell
      title="Números virtuales"
      subtitle="Comprá y administrá los números que usás para WhatsApp Business."
      actions={
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          disabled={!sellable}
          title={!sellable ? unsellableMessage ?? undefined : undefined}
          style={{ ...primaryBtn, opacity: sellable ? 1 : 0.5, cursor: sellable ? "pointer" : "not-allowed" }}
        >
          <Plus size={13} />
          Comprar número
        </button>
      }
    >
      <ProtectedNotice />

      {unsellableMessage && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid oklch(0.80 0.14 75 / 0.4)",
            background: "oklch(0.80 0.14 75 / 0.10)",
            color: "var(--z-amber)",
            fontSize: 12.5,
            marginBottom: 14,
          }}
        >
          <Info size={14} /> {unsellableMessage}
        </div>
      )}

      {error && (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      )}

      {success && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid oklch(0.78 0.15 155 / 0.4)",
            background: "oklch(0.78 0.15 155 / 0.10)",
            color: "var(--z-green)",
            fontSize: 12.5,
            marginBottom: 14,
          }}
        >
          <CheckCircle2 size={14} /> {success}
        </div>
      )}

      {query.isLoading && (
        <div style={loadingStyle}>Cargando números…</div>
      )}

      {!query.isLoading && (query.data?.length ?? 0) === 0 && (
        <PurchaseGuide onBuy={() => setWizardOpen(true)} disabled={!sellable} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {query.data?.map((number) => (
          <NumberRow
            key={number.id}
            number={number}
            tenantId={tenantId}
            onError={setError}
          />
        ))}
      </div>

      {wizardOpen && (
        <BuyWizard
          tenantId={tenantId}
          onClose={() => setWizardOpen(false)}
          onError={setError}
        />
      )}
    </PageShell>
  );
}

// ─────────────────────────── Row (mis números) ────────────────────────────

function NumberRow({
  number,
  tenantId,
  onError,
}: {
  number: TenantNumber;
  tenantId: string;
  onError: (msg: string | null) => void;
}) {
  const qc = useQueryClient();
  const [forward, setForward] = useState(number.forward_to_phone ?? "");
  const [lastServerForward, setLastServerForward] = useState(
    number.forward_to_phone
  );

  // Sync local state cuando el backend devuelve un valor distinto al último
  // que vimos. Patrón "ajustar state durante render" — evita useEffect.
  if (lastServerForward !== number.forward_to_phone) {
    setLastServerForward(number.forward_to_phone);
    setForward(number.forward_to_phone ?? "");
  }

  const forwardMut = useMutation({
    mutationFn: (value: string | null) =>
      updateNumberForward(tenantId, number.id, value),
    onSuccess: (updated) => {
      qc.setQueryData<TenantNumber[] | undefined>(
        ["tenant-numbers", tenantId],
        (prev) => prev?.map((n) => (n.id === updated.id ? updated : n))
      );
      onError(null);
    },
    onError: (err) => {
      onError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos actualizar el reenvío."
      );
      setForward(number.forward_to_phone ?? "");
    },
  });

  const connectMut = useMutation({
    mutationFn: () => markNumberConnected(tenantId, number.id),
    onSuccess: (updated) => {
      qc.setQueryData<TenantNumber[] | undefined>(
        ["tenant-numbers", tenantId],
        (prev) => prev?.map((n) => (n.id === updated.id ? updated : n))
      );
      onError(null);
    },
    onError: (err) => {
      onError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos marcar el número como conectado."
      );
    },
  });

  const releaseMut = useMutation({
    mutationFn: () => releaseTenantNumber(tenantId, number.id),
    onSuccess: () => {
      qc.setQueryData<TenantNumber[] | undefined>(
        ["tenant-numbers", tenantId],
        (prev) => prev?.filter((n) => n.id !== number.id)
      );
      onError(null);
    },
    onError: (err) => {
      onError(
        err instanceof ApiError
          ? err.payload.error
          : "No pudimos liberar el número."
      );
    },
  });

  function commitForward() {
    const trimmed = forward.trim();
    if (trimmed === (number.forward_to_phone ?? "")) return;
    forwardMut.mutate(trimmed === "" ? null : trimmed);
  }

  return (
    <div
      className="glass"
      style={{
        ...cardStyle,
        border: "1px solid var(--hair)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--hair)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Phone size={14} style={{ color: "var(--z-cyan)" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-0)",
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: 0.2,
              }}
            >
              +{number.phone_e164}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-3)",
                display: "flex",
                gap: 8,
                marginTop: 2,
              }}
            >
              <span>{number.country}</span>
              <span>·</span>
              <span style={{ textTransform: "capitalize" }}>
                {number.provider}
              </span>
              <span>·</span>
              <span>
                {formatMoney(number.total_monthly_cents, number.currency)}/mes
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <StatusBadge status={number.status} />
          <button
            type="button"
            onClick={() => {
              const label = `+${number.phone_e164}`;
              if (
                confirm(
                  `¿Liberar ${label}?\n\n` +
                    `• Se cancela el cobro mensual.\n` +
                    `• El número vuelve al pool del provider.\n` +
                    `• Si está conectado a WhatsApp, desconectalo primero en business.facebook.com.\n\n` +
                    `Esta acción no se puede deshacer.`
                )
              ) {
                releaseMut.mutate();
              }
            }}
            disabled={releaseMut.isPending}
            aria-label={`Liberar ${number.phone_e164}`}
            style={iconBtn}
          >
            {releaseMut.isPending ? (
              <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
            ) : (
              <Trash2 size={13} />
            )}
          </button>
        </div>
      </div>

      {number.status !== "released" && (
        <ActivationGuide
          number={number}
          forward={forward}
          setForward={setForward}
          commitForward={commitForward}
          forwardPending={forwardMut.isPending}
          onConnect={() => connectMut.mutate()}
          connectPending={connectMut.isPending}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: TenantNumberStatus }) {
  const map: Record<
    TenantNumberStatus,
    { label: string; color: string; bg: string; border: string }
  > = {
    purchased: {
      label: "Sin conectar",
      color: "oklch(0.85 0.18 90)",
      bg: "oklch(0.85 0.18 90 / 0.10)",
      border: "oklch(0.85 0.18 90 / 0.4)",
    },
    pairing: {
      label: "Conectando",
      color: "oklch(0.80 0.13 200)",
      bg: "oklch(0.80 0.13 200 / 0.10)",
      border: "oklch(0.80 0.13 200 / 0.4)",
    },
    active: {
      label: "Activo",
      color: "oklch(0.78 0.18 145)",
      bg: "oklch(0.78 0.18 145 / 0.12)",
      border: "oklch(0.78 0.18 145 / 0.4)",
    },
    released: {
      label: "Liberado",
      color: "var(--text-3)",
      bg: "rgba(255,255,255,0.04)",
      border: "var(--hair)",
    },
  };
  const cfg = map[status];
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: "var(--font-jetbrains-mono)",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: 4,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {cfg.label}
    </span>
  );
}

// Guía de activación educativa: una vez comprado el número, lleva al cliente
// paso a paso para conectarlo a WhatsApp. Los pasos se marcan completados solos
// (forward cargado, verificación confirmada). Es OPCIONAL — se aclara arriba.
function ActivationGuide({
  number,
  forward,
  setForward,
  commitForward,
  forwardPending,
  onConnect,
  connectPending,
}: {
  number: TenantNumber;
  forward: string;
  setForward: (v: string) => void;
  commitForward: () => void;
  forwardPending: boolean;
  onConnect: () => void;
  connectPending: boolean;
}) {
  const forwardDone = Boolean(number.forward_to_phone);
  const connectedDone =
    number.status === "active" || Boolean(number.paired_waba_id);
  const doneCount = 1 + (forwardDone ? 1 : 0) + (connectedDone ? 1 : 0);

  const forwardInput = (
    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
      <input
        type="tel"
        value={forward}
        onChange={(e) => setForward(e.target.value)}
        onBlur={commitForward}
        placeholder="+54 9 11 5555 1234"
        style={{ ...inputStyle, flex: 1 }}
      />
      {forwardPending ? (
        <Loader2 size={14} style={{ animation: "spin 900ms linear infinite", color: "var(--text-3)" }} />
      ) : forwardDone ? (
        <CheckCircle2 size={15} style={{ color: "var(--z-green)" }} />
      ) : null}
    </div>
  );

  // Estado final: conectado.
  if (connectedDone) {
    return (
      <div
        style={{
          marginTop: 14,
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px solid oklch(0.78 0.15 155 / 0.30)",
          background: "oklch(0.78 0.15 155 / 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Sparkles size={16} style={{ color: "var(--z-green)" }} />
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-0)" }}>
            ¡Conectado a WhatsApp Business! 🎉
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6, lineHeight: 1.5 }}>
          Ya podés usar este número como tu línea de WhatsApp. Mantené tu celular
          de reenvío actualizado por si Meta te pide re-verificar más adelante.
        </div>
        <div style={{ marginTop: 10 }}>
          <Field
            label={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <PhoneForwarded size={11} /> Celular de reenvío
              </span>
            }
          >
            {forwardInput}
          </Field>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 14,
        padding: "14px 16px",
        borderRadius: 10,
        border: "1px solid var(--hair-strong)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      {/* Header educativo */}
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: "oklch(0.72 0.16 155 / 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <MessageCircle size={17} style={{ color: "oklch(0.78 0.15 155)" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-0)" }}>
            Conectá este número a WhatsApp Business
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3, lineHeight: 1.5 }}>
            <strong style={{ color: "var(--text-1)" }}>Es opcional.</strong>{" "}
            Hacelo solo si querés usar este número como tu línea de WhatsApp. Si
            no, dejalo comprado y conectalo cuando quieras.
          </div>
        </div>
        <span
          style={{
            fontSize: 10.5,
            fontFamily: "var(--font-jetbrains-mono)",
            fontWeight: 700,
            color: "var(--text-2)",
            border: "1px solid var(--hair)",
            borderRadius: 20,
            padding: "3px 9px",
            flexShrink: 0,
          }}
        >
          {doneCount}/3
        </span>
      </div>

      {/* Pasos */}
      <div style={{ marginTop: 16 }}>
        <StepItem index={1} done title="Número comprado" icon={ShoppingCart}>
          <span>
            Ya es tuyo:{" "}
            <code style={codeStyle}>+{number.phone_e164}</code>. Se cobra mensual
            hasta que lo liberes.
          </span>
        </StepItem>

        <StepItem
          index={2}
          done={forwardDone}
          active={!forwardDone}
          title="Indicá tu celular para recibir el código"
          icon={PhoneForwarded}
        >
          <span>
            Cuando Meta llame al número virtual para darte el código, reenviamos
            esa llamada a tu celular.
          </span>
          {forwardInput}
        </StepItem>

        <StepItem
          index={3}
          done={connectedDone}
          active={forwardDone}
          title="Verificá en WhatsApp Manager (por voz)"
          icon={ShieldCheck}
          isLast
        >
          {!forwardDone ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "var(--text-3)",
              }}
            >
              <AlertTriangle size={12} /> Completá primero el paso 2 (tu celular)
              para poder recibir el código.
            </span>
          ) : (
            <>
              <ol
                style={{
                  margin: "2px 0 0",
                  paddingLeft: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  lineHeight: 1.5,
                }}
              >
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
                  y tocá <strong>Add phone number</strong>.
                </li>
                <li>
                  Ingresá <code style={codeStyle}>+{number.phone_e164}</code> y
                  elegí verificación por <strong>llamada (voz)</strong> — los SMS
                  a números virtuales no llegan.
                </li>
                <li>
                  Meta llama al número → la reenviamos a{" "}
                  <strong>+{forward.replace(/^\+/, "")}</strong> → atendé y anotá
                  el código.
                </li>
                <li>Ingresá el código en Meta y completá el perfil.</li>
              </ol>
              <button
                type="button"
                onClick={onConnect}
                disabled={connectPending}
                style={{ ...primaryBtn, marginTop: 10 }}
              >
                {connectPending ? (
                  <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
                ) : (
                  <BadgeCheck size={13} />
                )}
                Ya lo conecté
              </button>
            </>
          )}
        </StepItem>
      </div>
    </div>
  );
}

// Guía cuando el tenant TODAVÍA no compró número: misma estética, pero el
// paso 1 es "Comprá tu número" (accionable) y los pasos 2-3 quedan pendientes.
function PurchaseGuide({ onBuy, disabled }: { onBuy: () => void; disabled?: boolean }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 12,
        border: "1px solid var(--hair-strong)",
        background: "rgba(255,255,255,0.02)",
        marginBottom: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: "oklch(0.72 0.16 155 / 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <MessageCircle size={17} style={{ color: "oklch(0.78 0.15 155)" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}>
            Conectá WhatsApp Business a tu agente virtual
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3, lineHeight: 1.5 }}>
            En 3 pasos tu número virtual queda atendiendo solo con el bot.{" "}
            <strong style={{ color: "var(--text-1)" }}>Es opcional</strong> — solo
            si querés una línea de WhatsApp dedicada para el agente.
          </div>
        </div>
        <span
          style={{
            fontSize: 10.5,
            fontFamily: "var(--font-jetbrains-mono)",
            fontWeight: 700,
            color: "var(--text-2)",
            border: "1px solid var(--hair)",
            borderRadius: 20,
            padding: "3px 9px",
            flexShrink: 0,
          }}
        >
          0/3
        </span>
      </div>

      {/* Pasos */}
      <div style={{ marginTop: 16 }}>
        <StepItem index={1} active title="Comprá tu número virtual" icon={ShoppingCart}>
          <span>
            Elegí un número (US por ahora) y pagalo con tarjeta. Es una
            suscripción mensual que podés cancelar cuando quieras.
          </span>
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={onBuy}
              disabled={disabled}
              style={{ ...primaryBtn, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
            >
              <Plus size={13} /> Comprar número
            </button>
          </div>
        </StepItem>

        <StepItem index={2} title="Indicá tu celular para el código" icon={PhoneForwarded}>
          <span>
            Reenviamos la llamada de verificación de Meta a tu celular para que
            recibas el código por voz.
          </span>
        </StepItem>

        <StepItem index={3} title="Verificá en WhatsApp Manager (por voz)" icon={ShieldCheck} isLast>
          <span>
            Agregás el número en WhatsApp Business y verificás por llamada. Listo:
            tu agente queda atendiendo en ese número.
          </span>
        </StepItem>
      </div>
    </div>
  );
}

// Un paso de la guía: riel a la izquierda (check verde si done, número si no) +
// contenido a la derecha. isLast oculta la línea conectora.
function StepItem({
  index,
  title,
  done = false,
  active = false,
  icon: Icon,
  isLast = false,
  children,
}: {
  index: number;
  title: string;
  done?: boolean;
  active?: boolean;
  icon: typeof ShoppingCart;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  const accent = done
    ? "var(--z-green)"
    : active
    ? "var(--z-cyan)"
    : "var(--text-3)";
  return (
    <div style={{ display: "flex", gap: 12 }}>
      {/* Riel */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1.5px solid ${done ? "oklch(0.78 0.15 155 / 0.5)" : active ? "var(--z-cyan)" : "var(--hair-strong)"}`,
            background: done ? "oklch(0.78 0.15 155 / 0.12)" : "transparent",
            color: accent,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "var(--font-jetbrains-mono)",
          }}
        >
          {done ? <CheckCircle2 size={15} /> : index}
        </div>
        {!isLast && (
          <div style={{ flex: 1, width: 2, background: "var(--hair)", minHeight: 16, marginTop: 2 }} />
        )}
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon size={13} style={{ color: accent, flexShrink: 0 }} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: done ? "var(--text-2)" : "var(--text-0)",
            }}
          >
            {title}
          </span>
          {done && (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--z-green)",
                border: "1px solid oklch(0.78 0.15 155 / 0.4)",
                borderRadius: 4,
                padding: "1px 6px",
              }}
            >
              Listo
            </span>
          )}
        </div>
        <div style={{ marginTop: 5, fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Buy wizard (modal) ───────────────────────────

function BuyWizard({
  tenantId,
  onClose,
  onError,
}: {
  tenantId: string;
  onClose: () => void;
  onError: (msg: string | null) => void;
}) {
  const [country, setCountry] = useState<string>(COUNTRIES[0].code);
  const [areaCode, setAreaCode] = useState<string>("");
  const [results, setResults] = useState<AvailableNumber[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AvailableNumber | null>(null);
  const [forwardToPhone, setForwardToPhone] = useState<string>("");
  const searchMut = useMutation({
    mutationFn: () =>
      searchAvailableNumbers(tenantId, {
        country,
        areaCode: areaCode.trim() || undefined,
        limit: 20,
    }),
    onSuccess: (items) => {
      setResults(items);
      setSelected((current) => {
        if (current && items.some((item) => item.phone_e164 === current.phone_e164)) {
          return current;
        }
        return items[0] ?? null;
      });
      setSearchError(null);
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.payload.error : null;
      if (code === "provider_missing_key") {
        setSearchError(
          "La plataforma todavía no habilitó la compra de números. Avisale al admin que cargue TELNYX_API_KEY."
        );
      } else if (err instanceof ApiError && err.status === 400) {
        setSearchError(err.payload.error || "No pudimos buscar números.");
      } else {
        setSearchError(
          err instanceof ApiError
            ? err.payload.error
            : "Error de red buscando números."
        );
      }
      setResults(null);
      setSelected(null);
    },
  });

  useEffect(() => {
    searchMut.mutate();
    // Auto-search once when the modal opens; manual searches handle filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buyMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("no_selection");
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      return startNumberCheckout(tenantId, {
        phone_e164: selected.phone_e164,
        country: selected.country,
        forward_to_phone: forwardToPhone.trim() || undefined,
        success_url: `${origin}/numbers?purchased=ok`,
        cancel_url: `${origin}/numbers?purchased=cancel`,
      });
    },
    onSuccess: ({ checkout_url }) => {
      // Redirige a la página de pago de Stripe. El número se aprovisiona por
      // webhook cuando el pago se confirma, y al volver (?purchased=ok) la
      // lista lo muestra.
      if (checkout_url) window.location.assign(checkout_url);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const map: Record<string, string> = {
          stripe_price_not_configured:
            "La plataforma todavía no terminó de configurar el cobro por números. Avisale al admin.",
          invalid_input: "El número o país seleccionado no es válido.",
          stripe_error:
            "No pudimos iniciar el pago. Reintentá en un momento.",
        };
        onError(map[err.payload.error] || err.payload.error || "No pudimos iniciar la compra.");
      } else {
        onError("Error de red iniciando la compra.");
      }
    },
  });

  const totalLine = useMemo(() => {
    if (!selected) return null;
    // Mostramos solo el precio final al cliente (no el desglose de costo/margen).
    return `${formatMoney(selected.total_monthly_cents, selected.currency)} / mes`;
  }, [selected]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !buyMut.isPending) onClose();
      }}
    >
      <div
        className="glass"
        style={{
          width: "min(640px, 100%)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 12,
          border: "1px solid var(--hair-strong)",
          background: "var(--surface-1, rgba(15,15,20,0.95))",
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
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-0)",
              flex: 1,
            }}
          >
            Comprar número virtual
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={buyMut.isPending}
            aria-label="Cerrar"
            style={{ ...iconBtn, border: "none" }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
          {/* Step 1: filtros */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 140px auto",
              gap: 10,
              alignItems: "end",
              marginBottom: 14,
            }}
          >
            <Field label="País">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={inputStyle}
                disabled={searchMut.isPending}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Area code (opcional)">
              <input
                value={areaCode}
                onChange={(e) =>
                  setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
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
                <Loader2
                  size={13}
                  style={{ animation: "spin 900ms linear infinite" }}
                />
              ) : (
                <Search size={13} />
              )}
              Buscar
            </button>
          </div>

          {searchMut.isPending && !results && (
            <div style={loadingStyle}>Buscando numeros disponibles...</div>
          )}

          {searchError && (
            <ErrorBanner
              message={searchError}
              onDismiss={() => setSearchError(null)}
            />
          )}

          {/* Step 2: resultados */}
          {!searchError && results && results.length === 0 && (
            <div style={loadingStyle}>
              Sin resultados para esos filtros. Probá otro area code.
            </div>
          )}

          {results && results.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "var(--text-3)",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Elige un numero ({results.length})
              </div>
              {results.map((item) => {
                const isSelected = selected?.phone_e164 === item.phone_e164;
                return (
                  <button
                    key={item.phone_e164}
                    type="button"
                    onClick={() => setSelected(item)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: isSelected
                        ? "1px solid var(--z-cyan)"
                        : "1px solid var(--hair)",
                      background: isSelected
                        ? "oklch(0.80 0.13 200 / 0.08)"
                        : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      color: "var(--text-0)",
                    }}
                  >
                    <Phone
                      size={13}
                      style={{
                        color: isSelected ? "var(--z-cyan)" : "var(--text-3)",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          fontFamily: "var(--font-jetbrains-mono)",
                          letterSpacing: 0.2,
                        }}
                      >
                        +{item.phone_e164}
                      </div>
                      <div
                        style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}
                      >
                        {item.region || item.country}
                        {item.capabilities.length > 0 &&
                          ` · ${item.capabilities.join(", ")}`}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-0)",
                      }}
                    >
                      {formatMoney(item.total_monthly_cents, item.currency)}/mes
                    </div>
                    {isSelected && (
                      <CheckCircle2 size={14} style={{ color: "var(--z-cyan)" }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {selected && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 8,
                border: "1px solid var(--hair-strong)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "var(--text-3)",
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Confirmar compra
              </div>
              <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.6 }}>
                <strong style={{ color: "var(--text-0)" }}>
                  +{selected.phone_e164}
                </strong>{" "}
                · {totalLine}
              </div>
              <div style={{ marginTop: 12 }}>
                <Field label="Tu celular (para recibir el código por voz)">
                  <input
                    type="tel"
                    value={forwardToPhone}
                    onChange={(e) => setForwardToPhone(e.target.value)}
                    placeholder="+5491155551234"
                    style={inputStyle}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-3)",
                      marginTop: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    Opcional ahora — podés cargarlo después. Sin este número no
                    vas a recibir el código de verificación de Meta.
                  </span>
                </Field>
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--text-2)",
                  marginTop: 10,
                  lineHeight: 1.55,
                }}
              >
                Te llevamos a una página de pago segura (Stripe) para confirmar.
                El número se activa apenas se acredita el pago. Podés liberarlo
                cuando quieras.
              </div>
            </div>
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
          <button
            type="button"
            onClick={onClose}
            disabled={buyMut.isPending}
            style={ghostBtn}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => buyMut.mutate()}
            disabled={!selected || buyMut.isPending}
            style={{ ...primaryBtn, opacity: !selected ? 0.5 : 1 }}
          >
            {buyMut.isPending ? (
              <Loader2 size={13} style={{ animation: "spin 900ms linear infinite" }} />
            ) : (
              <CheckCircle2 size={13} />
            )}
            {selected ? `Ir a pagar +${selected.phone_e164}` : "Comprar numero"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────── Helpers ──────────────────────────────────

function ProtectedNotice() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid oklch(0.80 0.13 200 / 0.25)",
        background: "oklch(0.80 0.13 200 / 0.06)",
        marginBottom: 14,
      }}
    >
      <ShieldCheck
        size={16}
        style={{ color: "var(--z-cyan)", flexShrink: 0, marginTop: 1 }}
      />
      <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.5 }}>
        <strong style={{ color: "var(--text-0)" }}>
          Comprás un número y lo usás en tu WhatsApp Business.
        </strong>
        <div style={{ marginTop: 3, color: "var(--text-2)" }}>
          El número es una suscripción mensual aparte que pagás con tarjeta. La
          activación final en WhatsApp (verificación por voz) la hacés desde
          business.facebook.com — te guiamos paso a paso después de la compra.
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid oklch(0.68 0.21 25 / 0.4)",
        background: "oklch(0.68 0.21 25 / 0.08)",
        color: "var(--z-red)",
        fontSize: 12.5,
        marginBottom: 14,
        lineHeight: 1.4,
      }}
    >
      <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar aviso"
        style={{
          border: "none",
          background: "transparent",
          color: "var(--z-red)",
          cursor: "pointer",
          padding: 0,
          opacity: 0.7,
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 0,
      }}
    >
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

function formatMoney(cents: number, currency: string): string {
  const amount = (cents / 100).toFixed(2);
  return `${currency} ${amount}`;
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

const linkStyle: React.CSSProperties = {
  color: "var(--z-cyan)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

const codeStyle: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 11.5,
  padding: "1px 5px",
  borderRadius: 3,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid var(--hair)",
};
