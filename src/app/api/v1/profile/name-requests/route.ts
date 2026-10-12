import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, withUser } from "@/lib/api";
import { nameRequestInput } from "@/lib/schemas";
import { assertNameNotTaken } from "@/lib/name-requests";
import { audit } from "@/lib/audit";

/** A user asks to change their full name; it takes effect only after an administrator approves. */
export const POST = withUser(async ({ req, user }) => {
  const { newName, reason } = nameRequestInput.parse(await req.json());
  if (newName === user.fullName) throw badRequest("Yangi ism hozirgisi bilan bir xil");
  await assertNameNotTaken(db, user.id, newName);
  try {
    const created = await db.nameChangeRequest.create({
      data: { userId: user.id, oldName: user.fullName, newName, reason },
    });
    await audit(user, { action: "name_request.create", entityType: "user", entityId: user.id, summary: `Ism so'rovi: ${user.fullName} → ${newName}` }, req);
    return { id: created.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw badRequest("Sizda ko'rib chiqilmagan so'rov bor — avval uni kuting yoki bekor qiling");
    }
    throw err;
  }
});
