interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
}

// Hash estable de TODO el string → 0..359. WhatsApp Cloud no expone la foto de
// perfil del cliente, así que cada contacto recibe un color propio y constante
// (antes el hue salía solo de la 1ra letra → todos los "M…" iguales). Mismo
// nombre/teléfono ⇒ mismo color siempre, en la lista y en el chat.
function hueFromString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export function UserAvatar({ name, size = 32, className }: AvatarProps) {
  const letters = name.replace(/[^\p{L}]/gu, " ").trim();
  const initials = (letters || name)
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = hueFromString(name);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        background: `linear-gradient(135deg, oklch(0.55 0.15 ${hue}), oklch(0.45 0.17 ${(hue + 40) % 360}))`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: 600,
        fontSize: size * 0.38,
        border: "1px solid rgba(255,255,255,0.1)",
        userSelect: "none",
      }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
