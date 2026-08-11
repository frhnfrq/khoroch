import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) redirect("/");

  return <AppShell>{children}</AppShell>;
}
