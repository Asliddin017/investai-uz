import { db } from "@/lib/db";
import { withUser } from "@/lib/api";

/** Lightweight list for pickers and filters. */
export const GET = withUser(async () =>
  db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, type: true } }),
);
