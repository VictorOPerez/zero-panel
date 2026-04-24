"use client";

import dynamic from "next/dynamic";

const LoginFormImpl = dynamic(
  () => import("./login-form").then((m) => m.LoginForm),
  { ssr: false }
);

export function LoginFormClient() {
  return <LoginFormImpl />;
}
