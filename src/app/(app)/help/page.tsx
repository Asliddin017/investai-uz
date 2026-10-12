"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useSession } from "@/components/providers";
import { Card, CardHeader, MSIcon, PageHeader } from "@/components/ui";

type Guide = { key: string; title: string; icon: string; who: string; steps: ReactNode[]; show: (can: (p: string) => boolean) => boolean };

const GUIDES: Guide[] = [
  {
    key: "author",
    title: "Safar tashkilotchisi uchun",
    icon: "flight_takeoff",
    who: "Viloyat apparati o'rinbosarlari, boshqarma boshliqlari, tuman/shahar hokimlari",
    show: (can) => can("plan:create"),
    steps: [
      <>
        <b>Safar yarating.</b> Safarlar → «Yangi safar»: nomi, maqsadi, muddati va safardagi rejalar (har bir reja
        kutilgan natijasi bilan). «Saqlash va tasdiqqa yuborish»ni bosing.
      </>,
      <>
        <b>Javobni kuting.</b> Tasdiqlansa — safarga boring. Rad etilsa — sababni o&apos;qing, «Tahrirlash»ni bosib tuzating
        va qayta yuboring.
      </>,
      <>
        <b>Safardan keyin natijani kiriting.</b> Safar sahifasida har bir reja yonidagi «Natija»: erishildi yoki erishilmadi
        (sababi bilan). Shartnoma imzolangan bo&apos;lsa — o&apos;sha reja yonidagi «Kelishuv» orqali uni amalga oshish muddati va hujjati bilan qo&apos;shing.
      </>,
      <>
        <b>«Hisobotni yakunlash»ni bosing.</b> AI xulosa avtomatik tayyor bo&apos;ladi. Keyin kelishuvlar muddati tugaguncha
        «Kelishuvlar» bo&apos;limida bajarilgan ishlarni yozib boring.
      </>,
    ],
  },
  {
    key: "approver",
    title: "Kotibiyat mudiri uchun",
    icon: "verified",
    who: "Safarlarni tasdiqlovchi",
    show: (can) => can("plan:approve"),
    steps: [
      <>
        <b>Dashboard → «Mening vazifalarim».</b> Tasdiq kutayotgan safarlar shu yerda.
      </>,
      <>
        <b>Safarni oching</b> va «Tasdiqlash» yoki «Rad etish»ni bosing. Rad etsangiz, nimani tuzatish kerakligini aniq yozing —
        safar muallifga qaytadi.
      </>,
      <>
        <b>Safardan keyin</b> xodim natijani kiritmasa, safar sahifasidagi «Hisobotni so&apos;rash» bilan eslating.
      </>,
      <>
        <b>Natijani ko&apos;ring:</b> safar sahifasidagi «AI tahlil» — rejalar qanchalik bajarilgani foizda; dashboardda barcha
        tashkilotlar kesimida.
      </>,
    ],
  },
  {
    key: "observer",
    title: "Kuzatuvchi uchun",
    icon: "visibility",
    who: "Rahbariyat",
    show: (can) => can("plan:view_all") && !can("plan:approve") && !can("plan:create"),
    steps: [
      <>
        <b>Dashboard</b> — umumiy holat: nechta safar, qanchasi natijali, o&apos;rtacha AI moslik, muddati o&apos;tgan kelishuvlar.
      </>,
      <>
        <b>Safarlar</b> ro&apos;yxatida «AI moslik» ustuni bo&apos;yicha past natijali safarlarni toping va oching.
      </>,
    ],
  },
  {
    key: "admin",
    title: "Administrator uchun",
    icon: "admin_panel_settings",
    who: "Foydalanuvchilar va ruxsatlarni boshqaruvchi",
    show: (can) => can("admin:users") || can("admin:permissions"),
    steps: [
      <>
        <b>Foydalanuvchilar:</b> xodim qo&apos;shish, tahrirlash, ism so&apos;rovlarini tasdiqlash. Parolini unutgan xodimga
        «Parolni tiklash» — vaqtinchalik parol beriladi, xodim kirgach o&apos;z parolini qo&apos;yadi.
      </>,
      <>
        <b>Ruxsatlar:</b> odatda rol bo&apos;yicha sozlash yetarli. Tashkilot yoki alohida xodim uchun istisno kerak bo&apos;lsa —
        tegishli tabda «Ruxsat» yoki «Inkor».
      </>,
      <>
        <b>Amallar jurnali:</b> kim, qachon, nima qilgani — kirishlar, tasdiqlar, parol va ruxsat o&apos;zgarishlari.
      </>,
    ],
  },
];

export default function HelpPage() {
  const { can } = useSession();
  const mine = GUIDES.filter((g) => g.show(can));
  const others = GUIDES.filter((g) => !g.show(can));

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Yordam" description="Tizimda nima qilish kerak — qisqa va qadam-baqadam" />
      <Card className="flex items-start gap-3 p-5 text-sm">
        <MSIcon name="lightbulb" className="text-primary" />
        <div>
          Eng oddiy yo&apos;l: <Link href="/dashboard" className="font-medium text-primary hover:underline">Dashboard</Link>dagi
          «Mening vazifalarim» ro&apos;yxatiga qarang — sizdan hozir nima kutilayotgani shu yerda. Har bir safar sahifasining
          tepasida esa «Keyingi qadam» bloki aynan qaysi tugmani bosishni aytadi.
        </div>
      </Card>
      {[...mine, ...others].map((g, gi) => (
        <Card key={g.key} className={gi >= mine.length ? "opacity-70" : undefined}>
          <CardHeader title={g.title} icon={g.icon} description={g.who} />
          <ol className="space-y-3 p-5 text-sm">
            {g.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </Card>
      ))}
    </div>
  );
}
