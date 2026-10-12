# Investitsiya safarlari tizimi — UML diagrammalar

## 1. Use Case (rollar va huquqlar)

```mermaid
flowchart LR
    subgraph VIL["Viloyat hokimiyati"]
        VH(["Viloyat hokimi"])
        VB(["Hokim o'rinbosari /<br/>Investitsiya bo'lim boshlig'i"])
        VY(["Bo'lim boshlig'i yordamchisi"])
    end
    subgraph TUM["Tuman / Shahar hokimiyati"]
        TH(["Tuman/Shahar hokimi"])
        TB(["Hokim o'rinbosari /<br/>Investitsiya bo'lim boshlig'i"])
        TY(["Bo'lim boshlig'i yordamchisi"])
    end
    AI(["AI xizmati"])

    UC1["Reja yaratish<br/>(nomi, maqsadi, muddati, roadmap)"]
    UC2["Rejani tahrirlash<br/>(yangi versiya, initial saqlanadi)"]
    UC3["Rejani tasdiqlashga yuborish"]
    UC4["O'z hokimiyati rejasini tasdiqlash / rad etish"]
    UC5["Quyi tuman/shahar rejasini tasdiqlash"]
    UC6["Safar natijasini kiritish<br/>(erishildi / erishilmadi + sabab)"]
    UC7["Kelishuv (yutuq) kiritish<br/>shartnoma + kutilgan muddat"]
    UC8["Faqat o'z hokimiyati rejalarini ko'rish"]
    UC9["O'z + barcha quyi tuman/shahar<br/>rejalarini ko'rish"]
    UC10["Reja vs bajarilgan ish<br/>moslik foizini hisoblash"]

    VB --- UC1 & UC2 & UC3 & UC6 & UC7
    VY --- UC1 & UC2 & UC3 & UC6 & UC7
    TB --- UC1 & UC2 & UC3 & UC6 & UC7
    TY --- UC1 & UC2 & UC3 & UC6 & UC7

    VH --- UC4 & UC5 & UC9
    TH --- UC4 & UC8

    UC6 -.->|"<<include>>"| UC10
    UC10 --- AI
```

Qoidalar:
- Reja yaratadi: bo'lim boshlig'i (= hokim o'rinbosari) va uning yordamchisi.
- Tasdiqlaydi: hokim. Viloyat hokimi — viloyat + uning barcha tuman/shahar rejalarini. Tuman/shahar hokimi — faqat o'z hokimiyati rejalarini.
- Tuman hokimi viloyat rejasini ko'rmaydi va tasdiqlay olmaydi.
- Rejani faqat yaratuvchi tahrirlaydi; birinchi versiya (initial) o'zgarmas holda saqlanadi.

## 2. Class diagram (ma'lumotlar modeli)

```mermaid
classDiagram
    direction LR

    class Hokimiyat {
        +id
        +nomi
        +daraja : HokimiyatDarajasi
        +parent_id : Hokimiyat?
    }
    class HokimiyatDarajasi {
        <<enumeration>>
        VILOYAT
        TUMAN
        SHAHAR
    }
    class Foydalanuvchi {
        +id
        +fio
        +rol : Rol
        +hokimiyat_id
        +rejaYarataOladimi() bool
        +tasdiqlayOladimi(reja) bool
        +koraOladimi(reja) bool
    }
    class Rol {
        <<enumeration>>
        HOKIM
        BOLIM_BOSHLIGI  // hokim o'rinbosari
        YORDAMCHI
    }
    class Reja {
        +id
        +hokimiyat_id
        +yaratuvchi_id
        +status : RejaStatus
        +joriy_versiya_id
        +tasdiqlovchi_id?
        +tasdiqlangan_sana?
    }
    class RejaVersiya {
        +id
        +reja_id
        +versiya_raqami
        +is_initial : bool
        +nomi
        +maqsadi
        +boshlanish_sana
        +tugash_sana
        +ozgartirish_sababi?
        +yaratilgan_sana
        +muallif_id
    }
    class RoadmapBand {
        +id
        +versiya_id
        +tartib
        +tavsif
        +kutilgan_natija
        +muddat
    }
    class RejaStatus {
        <<enumeration>>
        QORALAMA
        TASDIQLASHDA
        TASDIQLANDI
        RAD_ETILDI
        BAJARILMOQDA
        HISOBOT_KIRITILDI
        YAKUNLANDI
    }
    class BandNatijasi {
        +id
        +roadmap_band_id
        +holat : NatijaHolati
        +izoh
        +sabab?   // erishilmagan bo'lsa
    }
    class NatijaHolati {
        <<enumeration>>
        ERISHILDI
        ERISHILMADI
        QISMAN
    }
    class Kelishuv {
        +id
        +reja_id
        +roadmap_band_id?   // null = rejadan tashqari yutuq
        +nomi
        +hamkor
        +shartnoma_raqami
        +shartnoma_sana
        +summa?
        +kutilgan_muddat   // masalan 1 oydan keyin
        +holat : KelishuvHolati
        +fayllar[]
    }
    class KelishuvHolati {
        <<enumeration>>
        KUTILMOQDA
        AMALGA_OSHDI
        KECHIKDI
        BEKOR_QILINDI
    }
    class AIMoslikTahlili {
        +id
        +reja_id
        +versiya_id
        +moslik_foizi : 0..100
        +band_boyicha_ballar : json
        +xulosa
        +model
        +yaratilgan_sana
    }
    class TasdiqlashTarixi {
        +id
        +reja_id
        +versiya_id
        +foydalanuvchi_id
        +harakat : TASDIQ|RAD
        +izoh
        +sana
    }

    Hokimiyat "1" --> "0..*" Hokimiyat : quyi (tuman/shahar)
    Hokimiyat "1" --> "0..*" Foydalanuvchi
    Hokimiyat "1" --> "0..*" Reja
    Foydalanuvchi "1" --> "0..*" Reja : yaratadi
    Reja "1" *-- "1..*" RejaVersiya : tarix (initial + o'zgarishlar)
    RejaVersiya "1" *-- "1..*" RoadmapBand
    RoadmapBand "1" --> "0..1" BandNatijasi
    Reja "1" --> "0..*" Kelishuv : yutuqlar
    RoadmapBand "0..1" --> "0..*" Kelishuv
    Reja "1" --> "0..*" AIMoslikTahlili
    Reja "1" --> "0..*" TasdiqlashTarixi
```

## 3. Reja holatlari (State diagram)

```mermaid
stateDiagram-v2
    [*] --> QORALAMA : bo'lim boshlig'i / yordamchi yaratdi (v1 = initial)
    QORALAMA --> QORALAMA : tahrirlash (yangi versiya)
    QORALAMA --> TASDIQLASHDA : tasdiqlashga yuborish
    TASDIQLASHDA --> TASDIQLANDI : hokim tasdiqladi
    TASDIQLASHDA --> RAD_ETILDI : hokim rad etdi (izoh)
    RAD_ETILDI --> QORALAMA : yaratuvchi tuzatadi (yangi versiya)
    TASDIQLANDI --> BAJARILMOQDA : safar boshlandi
    TASDIQLANDI --> TASDIQLASHDA : o'zgartirish kiritildi (qayta tasdiq)
    BAJARILMOQDA --> HISOBOT_KIRITILDI : natijalar + kelishuvlar kiritildi
    HISOBOT_KIRITILDI --> HISOBOT_KIRITILDI : AI moslik tahlili
    HISOBOT_KIRITILDI --> YAKUNLANDI : barcha kelishuvlar yopildi
    YAKUNLANDI --> [*]
```

## 4. Asosiy jarayon (Sequence diagram)

```mermaid
sequenceDiagram
    actor Y as Bo'lim boshlig'i / Yordamchi
    participant S as Tizim
    actor H as Hokim (o'z yoki viloyat)
    participant AI as AI xizmati

    Y->>S: Reja yaratish (nomi, maqsadi, muddati, roadmap: 10 band)
    S->>S: Reja + RejaVersiya v1 (is_initial=true)
    opt O'zgartirish
        Y->>S: Rejani tahrirlash
        S->>S: RejaVersiya v2 (v1 o'zgarmaydi)
    end
    Y->>S: Tasdiqlashga yuborish
    S->>H: Bildirishnoma
    Note over S,H: Tuman rejasi -> tuman hokimi yoki viloyat hokimi<br/>Viloyat rejasi -> faqat viloyat hokimi
    H->>S: Tasdiqlash / rad etish (izoh)
    S->>S: TasdiqlashTarixi yozuvi

    Note over Y: Safar
    Y->>S: Har band natijasi: 8 ta ERISHILDI, 2 ta ERISHILMADI (+sabab)
    Y->>S: Kelishuv/shartnoma kiritish (kutilgan muddat: +1 oy)
    Note right of S: Rejadan tashqari kelishuv ham yutuq sifatida qo'shiladi

    S->>AI: Roadmap bandlari + natijalar + kelishuvlar
    AI-->>S: Moslik foizi (masalan 82%), band bo'yicha ball, xulosa
    S-->>Y: Natija ko'rsatish
    S-->>H: Natija ko'rsatish

    loop Kelishuv muddati kelganda
        S->>Y: Eslatma: kelishuv holatini yangilang
        Y->>S: AMALGA_OSHDI / KECHIKDI / BEKOR_QILINDI
    end
```

## 5. Ko'rish va tasdiqlash huquqi (Activity)

```mermaid
flowchart TD
    A["Foydalanuvchi rejani ochmoqchi / tasdiqlamoqchi"] --> B{"Reja hokimiyati =<br/>foydalanuvchi hokimiyati?"}
    B -- Ha --> C["Ko'rish: ruxsat"]
    B -- Yo'q --> D{"Foydalanuvchi VILOYAT darajasida va<br/>reja hokimiyati uning quyi tuman/shahri?"}
    D -- Ha --> C
    D -- Yo'q --> X["Ruxsat yo'q"]
    C --> E{"Rol = HOKIM?"}
    E -- Ha --> F["Tasdiqlash / rad etish mumkin"]
    E -- Yo'q --> G{"Foydalanuvchi = yaratuvchi?"}
    G -- Ha --> H["Tahrirlash mumkin (yangi versiya)"]
    G -- Yo'q --> I["Faqat ko'rish"]
```

## 6. AI moslik foizi — hisoblash g'oyasi

- Kirish: tasdiqlangan versiyadagi har bir `RoadmapBand` (kutilgan natija) va unga bog'langan `BandNatijasi` + `Kelishuv`.
- AI har band uchun semantik moslik balli beradi (0–100), sababini izohlaydi.
- Umumiy foiz = bandlar ballining o'rtachasi (ixtiyoriy vaznlar bilan).
- Rejadan tashqari kelishuvlar foizga kirmaydi, "qo'shimcha yutuq" sifatida alohida ko'rsatiladi.
- Natija `AIMoslikTahlili` jadvalida tarix bilan saqlanadi.
