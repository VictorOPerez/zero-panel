"use client";

import dynamic from "next/dynamic";

const Impl = dynamic(() => import("./reset-password-form").then((m) => m.ResetPasswordForm), {
  ssr: false,
});

export function ResetPasswordFormClient() {
  return <Impl />;
}
