import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.permissions.has("nav:dashboard")) redirect("/dashboard");
  if (user.permissions.has("nav:plans")) redirect("/plans");
  if (user.permissions.has("admin:permissions")) redirect("/admin/permissions");
  redirect("/agreements");
}
