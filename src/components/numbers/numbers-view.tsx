"use client";

import { useMemo, useState } from "react";
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
  ChevronRight,
  PhoneForwarded,
} from "lucide-react";
import {
  buyTenantNumber,
  listTenantNumbers,
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
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const query = useQuery({
    queryKey: ["tenant-numbers", tenantId],
    queryFn: () => listTenantNumbers(tenantId),
  });

  return (
    <PageShell
      title="Números virtuales"
      subtitle="Comprá y administrá los números que usás para WhatsApp Business."
      actions={
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          style={primaryBtn}
        >
          <Plus size={13} />
          Comprar número
        </button>
      }
    >
      <ProtectedNotice />

      {error && (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      )}

      {query.isLoading && (
        <div style={loadingStyle}>Cargando números…</div>
      )}

      {!query.isLoading && (query.data?.length ?? 0) === 0 && (
        <EmptyState onAdd={() => setWizardOpen(true)} />
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
          onPurchased={(purchased) => {
            qc.setQueryData<TenantNumber[] | undefined>(
              ["tenant-numbers", tenantId],
              (prev) => [purchased, ...(prev ?? [])]
            );
            setWizardOpen(false);
            setError(null);
          }}
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
  const [showInstructions, setShowInstructions] = useState(
    number.status === "purchased"
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

      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid var(--hair)",
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 10,
        }}
      >
        <Field
          label={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <PhoneForwarded size={11} />
              Reenvío de llamadas (verificación de WhatsApp)
            </span>
          }
        >
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="tel"
              value={forward}
              onChange={(e) => setForward(e.target.value)}
              onBlur={commitForward}
              placeholder="+54911..."
              style={{ ...inputStyle, flex: 1 }}
            />
            {forwardMut.isPending && (
              <Loader2
                size={13}
                style={{
                  animation: "spin 900ms linear infinite",
                  color: "var(--text-3)",
                }}
              />
            )}
          </div>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              marginTop: 3,
              lineHeight: 1.4,
            }}
          >
            Cuando Meta llame al número para enviarte el código de verificación,
            re-enrutamos la llamada a tu celular. Si lo dejás vacío no podrás
            recibir el código por voz.
          </span>
        </Field>
      </div>

      {number.status === "purchased" && (
        <ActivationInstructions
          phone={number.phone_e164}
          forward={forward}
          open={showInstructions}
          onToggle={() => setShowInstructions((v) => !v)}
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

function ActivationInstructions({
  phone,
  forward,
  open,
  onToggle,
}: {
  phone: string;
  forward: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: "12px 14px",
        borderRadius: 8,
        border: "1px solid oklch(0.85 0.18 90 / 0.3)",
        background: "oklch(0.85 0.18 90 / 0.06)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          color: "var(--text-0)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: 0,
          textAlign: "left",
        }}
      >
        <AlertTriangle size={14} style={{ color: "oklch(0.85 0.18 90)" }} />
        <span>Conectalo a WhatsApp Business (4 pasos)</span>
        <ChevronRight
          size={13}
          style={{
            marginLeft: "auto",
            color: "var(--text-3)",
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 120ms",
          }}
        />
      </button>

      {open && (
        <ol
          style={{
            margin: "10px 0 0",
            paddingLeft: 18,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 12.5,
            color: "var(--text-1)",
            lineHeight: 1.55,
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
              business.facebook.com → WhatsApp Manager → Phone Numbers
            </a>{" "}
            y tocá <strong>Add phone number</strong>.
          </li>
          <li>
            Ingresá <code style={codeStyle}>+{phone}</code> con el nombre del
            negocio. Pedí verificación por <strong>llamada (voice)</strong> —
            los SMS hacia VoIP suelen no llegar.
          </li>
          <li>
            Meta va a llamar a tu número virtual. La llamada se reenvía
            automáticamente a{" "}
            <strong>
              {forward ? `+${forward.replace(/^\+/, "")}` : "tu celular configurado arriba"}
            </strong>
            . Atendé y anotá el código de 6 dígitos.
          </li>
          <li>
            Volvé al Manager, ingresá el código y completá la configuración del
            perfil. Una vez verificado, en este panel pasará a{" "}
            <strong>Activo</strong>.
          </li>
        </ol>
      )}
    </div>
  );
}

// ─────────────────────────── Buy wizard (modal) ───────────────────────────

function BuyWizard({
  tenantId,
  onClose,
  onPurchased,
  onError,
}: {
  tenantId: string;
  onClose: () => void;
  onPurchased: (number: TenantNumber) => void;
  onError: (msg: string | null) => void;
}) {
  const [country, setCountry] = useState<string>(COUNTRIES[0].code);
  const [areaCode, setAreaCode] = useState<string>("");
  const [results, setResults] = useState<AvailableNumber[] | null>(null);
  const [lastResultsRef, setLastResultsRef] =
    useState<AvailableNumber[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AvailableNumber | null>(null);
  const [forwardToPhone, setForwardToPhone] = useState<string>("");

  // Cuando llega un nuevo set de resultados, deseleccionamos cualquier item
  // previamente elegido. Patrón "ajustar state durante render".
  if (lastResultsRef !== results) {
    setLastResultsRef(results);
    setSelected(null);
  }

  const searchMut = useMutation({
    mutationFn: () =>
      searchAvailableNumbers(tenantId, {
        country,
        areaCode: areaCode.trim() || undefined,
        limit: 20,
      }),
    onSuccess: (items) => {
      setResults(items);
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
    },
  });

  const buyMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("no_selection");
      return buyTenantNumber(tenantId, {
        phone_e164: selected.phone_e164,
        country: selected.country,
        forward_to_phone: forwardToPhone.trim() || undefined,
      });
    },
    onSuccess: (purchased) => {
      onPurchased(purchased);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const map: Record<string, string> = {
          no_active_subscription:
            "Necesitás una suscripción activa de Zero para comprar números. Andá a Suscripción y activá tu plan.",
          stripe_price_not_configured:
            "La plataforma todavía no terminó de configurar el cobro por números. Avisale al admin.",
          provider_missing_key:
            "La plataforma todavía no habilitó la compra. Avisale al admin que cargue TELNYX_API_KEY.",
          duplicate_number:
            "Ese número ya está activo en otro tenant. Elegí otro.",
        };
        onError(map[err.payload.error] || err.payload.error || "No pudimos comprar.");
      } else {
        onError("Error de red comprando el número.");
      }
    },
  });

  const totalLine = useMemo(() => {
    if (!selected) return null;
    return `${formatMoney(
      selected.total_monthly_cents,
      selected.currency
    )} / mes (provider ${formatMoney(
      selected.provider_cost_cents,
      selected.currency
    )} + servicio ${formatMoney(selected.markup_cents, selected.currency)})`;
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
              onClick={() => searchMut.mutate()}
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
                Disponibles ({results.length})
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
                Se va a agregar a tu suscripción actual de Zero y se cobra junto
                con el plan. Podés liberarlo cuando quieras.
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
            Confirmar compra
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
          El cobro se agrega a tu suscripción de Zero. La activación final en
          WhatsApp (verificación por voz) la hacés desde business.facebook.com —
          te guiamos paso a paso después de la compra.
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        padding: "40px 24px",
        borderRadius: 10,
        border: "1px dashed var(--hair-strong)",
        background: "rgba(255,255,255,0.015)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        textAlign: "center",
      }}
    >
      <Phone size={20} style={{ color: "var(--text-3)" }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}>
        Todavía no compraste ningún número
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-2)",
          maxWidth: 460,
          lineHeight: 1.55,
        }}
      >
        Comprá un número virtual y lo usás como tu línea de WhatsApp Business.
        Hoy soportamos US (más países en camino).
      </div>
      <button type="button" onClick={onAdd} style={primaryBtn}>
        <Plus size={13} />
        Comprar primer número
      </button>
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
