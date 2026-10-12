import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, withUser } from "@/lib/api";
import { nameRequestInput } from "@/lib/schemas";

/** A user asks to change their full name; it takes effect only after an administrator approves. */
export const POST = withUser(async ({ req, user }) => {
  const { newName, reason } = nameRequestInput.parse(await req.json());
  if (newName === user.fullName) throw badRequest("Yangi ism hozirgisi bilan bir xil");
  try {
    const created = await db.nameChangeRequest.create({
      data: { userId: user.id, oldName: user.fullName, newName, reason },
    });
    return { id: created.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw badRequest("Sizda ko'rib chiqilmagan so'rov bor — avval uni kuting yoki bekor qiling");
    }
    throw err;
  }
});
