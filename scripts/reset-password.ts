// Emergency password reset when no administrator can sign in (e.g. the only admin forgot the password).
// Run on a machine with database access:
//   npm run user:reset-password -- admin
// Uses DATABASE_URL from .env; for production run it with the production DATABASE_URL in the environment.
import { PrismaClient } from "@prisma/client";
import { generateTempPassword, hashPassword } from "../src/lib/auth";

const db = new PrismaClient();

async function main() {
  const username = process.argv[2]?.trim().toLowerCase();
  if (!username) {
    console.error("Foydalanish: npm run user:reset-password -- <login>");
    process.exit(1);
  }
  const user = await db.user.findUnique({ where: { username } });
  if (!user) {
    console.error(`@${username} topilmadi`);
    process.exit(1);
  }
  const password = generateTempPassword();
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
      isActive: true,
    },
  });
  await db.auditLog.create({
    data: {
      actorLabel: "server buyrug'i (CLI)",
      action: "user.password_reset",
      entityType: "user",
      entityId: user.id,
      summary: `Vaqtinchalik parol berildi (CLI): ${user.fullName} (@${user.username})`,
    },
  });
  console.log(`@${username} uchun vaqtinchalik parol: ${password}`);
  console.log("Kirgandan keyin tizim yangi parol qo'yishni talab qiladi.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
