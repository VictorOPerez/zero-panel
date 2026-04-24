interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
}

export function UserAvatar({ name, size = 32, className }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = (name.charCodeAt(0) * 23) % 360;

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
