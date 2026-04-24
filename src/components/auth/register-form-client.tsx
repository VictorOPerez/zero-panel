"use client";

import dynamic from "next/dynamic";

const RegisterFormImpl = dynamic(
  () => import("./register-form").then((m) => m.RegisterForm),
  { ssr: false }
);

export function RegisterFormClient() {
  return <RegisterFormImpl />;
}
