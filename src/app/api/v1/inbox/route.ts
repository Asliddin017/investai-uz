import { withUser } from "@/lib/api";
import { loadInbox } from "@/lib/inbox";

export const GET = withUser(async ({ user }) => loadInbox(user));
