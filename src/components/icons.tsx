/**
 * Channel-specific icons that aren't in lucide-react.
 * Matches the design prototype's SVG paths exactly.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number; active?: boolean };

export function IconWhatsApp({ size = 16, active, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" {...props}>
      <path
        d="M8 1.5a6.5 6.5 0 0 0-5.54 9.9L1.5 14.5l3.2-.93A6.5 6.5 0 1 0 8 1.5z"
        stroke={active ? "#25D366" : "currentColor"}
        strokeWidth="1.3"
      />
      <path
        d="M5.6 5.2c.1-.3.3-.3.5-.3h.3c.1 0 .2 0 .3.3.1.3.4 1 .4 1.1 0 .1 0 .2-.1.3l-.3.3c-.1.1-.1.2 0 .3.2.3.5.6.8.9.3.2.6.4.9.5.1 0 .2 0 .3-.1l.4-.4c.1-.1.2-.1.3 0l1 .5c.1.1.2.1.2.2 0 .2-.1.6-.3.8-.2.2-.7.4-1 .4-.5 0-1.2-.2-2.2-1-1.2-1-2-2.3-2.1-2.4-.1-.1-.5-.7-.5-1.3 0-.6.3-.9.5-1z"
        fill={active ? "#25D366" : "currentColor"}
      />
    </svg>
  );
}

export function IconInstagram({ size = 16, active, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" {...props}>
      <defs>
        <linearGradient id="ig-grad" x1="0" y1="0" x2="16" y2="16">
          <stop offset="0" stopColor="#F58529" />
          <stop offset="0.5" stopColor="#DD2A7B" />
          <stop offset="1" stopColor="#515BD4" />
        </linearGradient>
      </defs>
      <rect
        x="2" y="2" width="12" height="12" rx="3.5"
        stroke={active ? "url(#ig-grad)" : "currentColor"}
        strokeWidth="1.3"
      />
      <circle
        cx="8" cy="8" r="2.5"
        stroke={active ? "url(#ig-grad)" : "currentColor"}
        strokeWidth="1.3"
      />
      <circle cx="11.5" cy="4.5" r="0.6" fill={active ? "#E1306C" : "currentColor"} />
    </svg>
  );
}

export function IconTelegram({ size = 16, active, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      stroke={active ? "#3AA5EA" : "currentColor"} strokeWidth="1.3" strokeLinejoin="round" {...props}>
      <path d="M2 7.5l12-4.5-2 11-4-2-2 2-.5-4L12 4 5.5 10" />
    </svg>
  );
}

export function IconDot({ size = 8, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" aria-hidden>
      <circle cx="4" cy="4" r="3" fill={color} />
    </svg>
  );
}

export function IconSparkle({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 2l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5L8 2z" />
    </svg>
  );
}

export function IconQR({ size = 160 }: { size?: number }) {
  const s = 21;
  const cells: Array<{ x: number; y: number; on: boolean }> = [];
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const n = (x * 73 + y * 131 + x * y) % 7;
      cells.push({ x, y, on: n < 3 || (x < 7 && y < 7) || (x > s - 8 && y < 7) || (x < 7 && y > s - 8) });
    }
  }
  return (
    <svg viewBox={`0 0 ${s} ${s}`} width={size} height={size} style={{ borderRadius: 4 }}>
      <rect width={s} height={s} fill="white" />
      {cells.map((c, i) =>
        c.on ? <rect key={i} x={c.x} y={c.y} width="1" height="1" fill="#0a0a0f" /> : null
      )}
      {([[0, 0], [s - 7, 0], [0, s - 7]] as [number, number][]).map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="7" height="7" fill="#0a0a0f" />
          <rect x={x + 1} y={y + 1} width="5" height="5" fill="white" />
          <rect x={x + 2} y={y + 2} width="3" height="3" fill="#0a0a0f" />
        </g>
      ))}
      <rect x={s / 2 - 2.5} y={s / 2 - 2.5} width="5" height="5" fill="white" />
      <defs>
        <linearGradient id="qr-aurora" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#a855f7" /><stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <circle cx={s / 2} cy={s / 2} r="1.6" fill="url(#qr-aurora)" />
    </svg>
  );
}
