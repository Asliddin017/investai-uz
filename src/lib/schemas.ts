import { z } from "zod";
import { isValidName, normalizeName } from "./names";

const dateString = z
  .string()
  .min(1, "Sana kiritilmagan")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Sana noto'g'ri");

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Sana noto'g'ri");

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

const personName = z
  .string()
  .transform(normalizeName)
  .pipe(
    z
      .string()
      .min(3, "F.I.Sh. kiritilmagan")
      .max(120)
      .refine(isValidName, "F.I.Sh. faqat lotin yoki faqat kirill harflari, probel, apostrof va chiziqchadan iborat bo'lsin"),
  );

export const planItemInput = z.object({
  title: z.string().trim().min(3, "Reja nomi juda qisqa"),
  expectedResult: z.string().trim().min(3, "Kutilgan natija kiritilmagan"),
  dueDate: optionalDate,
});

export const planInput = z
  .object({
    title: z.string().trim().min(3, "Safar nomi juda qisqa"),
    goal: z.string().trim().min(10, "Maqsad kamida 10 belgi bo'lsin"),
    country: z.string().trim().min(2, "Davlat kiritilmagan"),
    city: optionalText,
    startDate: dateString,
    endDate: dateString,
    items: z.array(planItemInput).min(1, "Safarda kamida bitta reja bo'lsin").max(50),
  })
  .refine((v) => Date.parse(v.endDate) >= Date.parse(v.startDate), {
    message: "Tugash sanasi boshlanish sanasidan oldin bo'lmasin",
    path: ["endDate"],
  });

export const rejectInput = z.object({ comment: z.string().trim().min(5, "Rad etish sababini yozing") });

export const itemResultInput = z
  .object({
    result: z.enum(["PENDING", "ACHIEVED", "NOT_ACHIEVED"]),
    resultNote: optionalText,
    failureReason: optionalText,
  })
  .refine((v) => v.result !== "NOT_ACHIEVED" || (v.failureReason?.length ?? 0) >= 3, {
    message: "Erishilmagan reja uchun sababini yozing",
    path: ["failureReason"],
  });

export const agreementInput = z.object({
  planItemId: optionalText,
  title: z.string().trim().min(3, "Kelishuv nomi juda qisqa"),
  partner: z.string().trim().min(2, "Hamkor kiritilmagan"),
  partnerCountry: optionalText,
  documentType: z.enum(["SHARTNOMA", "MEMORANDUM", "BITIM", "BOSHQA"]),
  documentNumber: optionalText,
  signedDate: optionalDate,
  amount: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Summa noto'g'ri"),
  currency: optionalText,
  deadline: dateString,
  description: optionalText,
});

export const agreementUpdateInput = z.object({
  note: z.string().trim().min(3, "Izoh kiritilmagan"),
  progress: z.number().int().min(0).max(100),
});

export const agreementStatusInput = z.object({
  status: z.enum(["COMPLETED", "CANCELLED"]),
  note: optionalText,
});

export const ROLE_VALUES = [
  "SUPER_ADMIN",
  "TASDIQLOVCHI",
  "ORINBOSAR",
  "BOSHQARMA_BOSHLIGI",
  "TUMAN_HOKIMI",
  "KUZATUVCHI",
] as const;

export const userInput = z.object({
  fullName: personName,
  username: z
    .string()
    .trim()
    .min(3, "Login kamida 3 belgi")
    .regex(/^[a-z0-9._-]+$/, "Login faqat kichik lotin harflari, raqam va . _ - belgilaridan iborat bo'lsin"),
  password: z.string().optional().nullable(),
  role: z.enum(ROLE_VALUES),
  position: optionalText,
  departmentId: optionalText,
  isActive: z.boolean().default(true),
});

export const departmentInput = z.object({
  name: z.string().trim().min(3, "Nomi juda qisqa"),
  type: z.enum(["APPARAT", "INVESTITSIYA_BOLIMI", "BOSHQARMA", "TUMAN_HOKIMLIGI", "SHAHAR_HOKIMLIGI"]),
});

export const overridesInput = z.object({
  overrides: z.array(
    z.object({
      permission: z.string(),
      state: z.enum(["GRANT", "DENY"]),
      reason: optionalText,
    }),
  ),
});

export const rolesMatrixInput = z.object({
  roles: z.record(z.string(), z.array(z.string())),
});

export const profileInput = z.object({
  /** Applied only for users who manage accounts (admin:users); everyone else sends a request. */
  fullName: personName.optional(),
  position: optionalText,
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"]),
});

export const passwordChangeInput = z.object({
  newPassword: z.string().min(8, "Yangi parol kamida 8 belgi bo'lsin").max(128),
});

export const nameRequestInput = z.object({
  newName: personName,
  reason: optionalText,
});

export const reviewInput = z.object({ comment: optionalText });
