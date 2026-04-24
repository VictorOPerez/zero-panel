import { Mail, MessageSquare } from "lucide-react";
import { IconWhatsApp, IconInstagram, IconTelegram } from "@/components/icons";
import type { Channel } from "@/lib/api/types";

interface ChannelIconProps {
  channel: Channel;
  size?: number;
  active?: boolean;
}

export function ChannelIcon({ channel, size = 14, active }: ChannelIconProps) {
  switch (channel) {
    case "wa":
      return <IconWhatsApp size={size} active={active} />;
    case "ig":
      return <IconInstagram size={size} active={active} />;
    case "tg":
      return <IconTelegram size={size} active={active} />;
    case "em":
      return (
        <Mail
          size={size}
          style={{ color: active ? "#5B9EFF" : "currentColor" }}
        />
      );
    case "web":
      return (
        <MessageSquare
          size={size}
          style={{ color: active ? "#A78BFA" : "currentColor" }}
        />
      );
  }
}

export const CHANNEL_LABELS: Record<Channel, string> = {
  wa: "WhatsApp",
  ig: "Instagram",
  em: "Email",
  web: "Web Chat",
  tg: "Telegram",
};
