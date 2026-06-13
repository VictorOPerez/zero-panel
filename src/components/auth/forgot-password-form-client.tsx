"use client";

import dynamic from "next/dynamic";

const Impl = dynamic(() => import("./forgot-password-form").then((m) => m.ForgotPasswordForm), {
  ssr: false,
});

export function ForgotPasswordFormClient() {
  return <Impl />;
}
