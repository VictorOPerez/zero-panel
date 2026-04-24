import { redirect } from "next/navigation";

// WhatsApp connect is a modal on the integrations page — redirect there.
export default function WhatsAppPage() {
  redirect("/integrations");
}
