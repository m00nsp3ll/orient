import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { syncAccountingEntries } from "@/lib/accounting-sync"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await request.json().catch(() => ({}))
    const baseDate = body.date ? new Date(body.date) : new Date()
    baseDate.setHours(0, 0, 0, 0)

    const yesterday = new Date(baseDate); yesterday.setDate(baseDate.getDate() - 1)
    const today     = new Date(baseDate)
    const tomorrow  = new Date(baseDate); tomorrow.setDate(baseDate.getDate() + 1)
    const rangeEnd  = new Date(baseDate); rangeEnd.setDate(baseDate.getDate() + 2)
    const rangeStart = new Date(baseDate); rangeStart.setDate(baseDate.getDate() - 1)

    // ── 1. TEMİZLİK ──────────────────────────────────────────────────────────
    // Transfer → AppointmentService → Appointment (3 günlük)
    await prisma.transfer.deleteMany({
      where: { appointment: { startTime: { gte: rangeStart, lt: rangeEnd } } },
    })
    const oldApts = await prisma.appointment.findMany({
      where: { startTime: { gte: rangeStart, lt: rangeEnd } },
      select: { id: true },
    })
    if (oldApts.length > 0) {
      await prisma.appointmentService.deleteMany({
        where: { appointmentId: { in: oldApts.map(a => a.id) } },
      })
    }
    await prisma.appointment.deleteMany({
      where: { startTime: { gte: rangeStart, lt: rangeEnd } },
    })
    // [DEMO] etiketli kasa + muhasebe (cascade ile silinir)
    await prisma.cashEntry.deleteMany({
      where: { description: { contains: "[DEMO]" } },
    })

    // ── 2. VERİTABANI VERİLERİ ───────────────────────────────────────────────
    const services = await prisma.service.findMany({ orderBy: { name: "asc" } })
    if (services.length === 0) {
      return NextResponse.json({ error: "Hizmet bulunamadı" }, { status: 400 })
    }

    const agencies = await prisma.agency.findMany({ where: { isActive: true } })
    if (agencies.length === 0) {
      return NextResponse.json({ error: "Acenta bulunamadı" }, { status: 400 })
    }

    const staffList = await prisma.staff.findMany({
      where: { isActive: true },
      include: { user: true },
    })

    const drivers = await prisma.driver.findMany({ where: { isActive: true } })

    // Oteller — her aktif bölgeden en fazla 4
    const activeRegions = await prisma.region.findMany({ where: { isActive: true } })
    const hotels: any[] = []
    for (const region of activeRegions) {
      const rh = await prisma.hotel.findMany({
        where: { isActive: true, regionId: region.id },
        include: { region: true },
        take: 4,
      })
      hotels.push(...rh)
    }
    if (hotels.length === 0) {
      return NextResponse.json({ error: "Otel bulunamadı" }, { status: 400 })
    }

    // Alınış saatleri
    const sessionTimeRows = await prisma.regionSessionTime.findMany({
      where: { isActive: true },
      select: { time: true },
    })
    const timeSlots = [...new Set(sessionTimeRows.map(r => r.time))].sort()
    // Fallback
    const slots = timeSlots.length > 0
      ? timeSlots
      : ["08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","13:00","14:00","15:00","16:00"]

    // ── 3. MÜŞTERİ HAVUZU ────────────────────────────────────────────────────
    const customerNames = [
      "Hans Müller","Anna Schmidt","Peter Weber","Maria Fischer","Thomas Braun",
      "Elena Petrov","Alexander Ivanov","Olga Smirnova","Dmitry Volkov","Natasha Kozlova",
      "John Smith","Emma Wilson","Michael Brown","Sophie Johnson","David Taylor",
      "Ahmet Yılmaz","Fatma Kaya","Mehmet Demir","Ayşe Çelik","Mustafa Öztürk",
      "Pierre Dubois","Marie Laurent","Jean Bernard","Isabelle Martin","François Petit",
      "Lars Johansson","Ingrid Andersson","Erik Lindgren","Astrid Eriksson","Olaf Svensson",
      "Giuseppe Rossi","Chiara Bianchi","Luca Ferrari","Sakura Tanaka","Yuki Nakamura",
      "Carlos Garcia","Isabella Martinez","Roberto Silva","Chen Wei","Li Mei",
    ]
    const notePool = [
      "VIP müşteri","Bebek arabası var","Çocuklar 3 ve 5 yaşında","Bebek koltuğu gerekli",
      "Grubun 1 üyesi engelli","Yaşlı misafir var","Alerjisi var","Geç alınış isteniyor",
      null,null,null,null,null,
    ]
    const voucherPrefixes = ["SWT","BST","GLT","PRH","VIP","RES"]

    // ── 4. RANDEVU + TRANSFER OLUŞTUR (3 gün) ───────────────────────────────
    const days = [
      { date: yesterday, label: "dün" },
      { date: today,     label: "bugün" },
      { date: tomorrow,  label: "yarın" },
    ]

    const now = new Date()
    const nowHour = now.getHours()
    let aptCount = 0
    let nameIdx  = 0

    for (const day of days) {
      for (const slot of slots) {
        // Her saat diliminde 2-4 randevu (yoğun senaryo)
        const aptPerSlot = Math.floor(Math.random() * 3) + 2

        for (let i = 0; i < aptPerSlot; i++) {
          const [h, m] = slot.split(":").map(Number)
          const startTime = new Date(day.date)
          startTime.setHours(h, m, 0, 0)
          const endTime = new Date(startTime)
          endTime.setMinutes(endTime.getMinutes() + 60)

          const hotel    = hotels[aptCount % hotels.length]
          const agency   = agencies[Math.floor(Math.random() * agencies.length)]
          const svcIdx   = Math.floor(Math.random() * services.length)
          const svc      = services[svcIdx]
          // %30 ihtimalle 2. hizmet
          const extraSvc = Math.random() < 0.3 && services.length > 1
            ? services[(svcIdx + 1) % services.length]
            : null
          const selServices = extraSvc ? [svc, extraSvc] : [svc]

          const pax       = Math.random() < 0.15 ? 1 : Math.random() < 0.35 ? 2 : Math.floor(Math.random() * 3) + 3
          const childCount = Math.random() < 0.35 ? Math.floor(Math.random() * 3) + 1 : 0
          const cancelled  = Math.random() < 0.12
          const isRest     = !cancelled && Math.random() < 0.2
          const restCur    = isRest ? ["TRY","EUR","USD","GBP"][Math.floor(Math.random() * 4)] : null
          const restAmt    = isRest
            ? (restCur === "TRY" ? Math.floor(Math.random() * 2000) + 300 : Math.floor(Math.random() * 120) + 20)
            : null

          const prefix    = voucherPrefixes[Math.floor(Math.random() * voucherPrefixes.length)]
          const voucherNo = `${prefix}-${String(1000 + aptCount).padStart(4, "0")}`
          const note      = notePool[Math.floor(Math.random() * notePool.length)]
          const custName  = customerNames[nameIdx % customerNames.length]
          nameIdx++
          aptCount++

          const apt = await prisma.appointment.create({
            data: {
              customerName:   custName,
              roomNumber:     `${Math.floor(Math.random() * 400) + 100}`,
              serviceId:      svc.id,
              hotelId:        hotel.id,
              agencyId:       agency.id,
              startTime,
              endTime,
              pax,
              childCount,
              status:         cancelled ? "CANCELLED" : "CONFIRMED",
              approvalStatus: "APPROVED",
              notes:          note,
              restAmount:     restAmt,
              restCurrency:   restCur,
              voucherNo,
            },
          })

          // AppointmentService kayıtları
          for (const s of selServices) {
            await prisma.appointmentService.create({
              data: { appointmentId: apt.id, serviceId: s.id, price: s.price },
            })
          }

          // Transfer (iptal olmayanlar)
          if (!cancelled) {
            let status: string
            let driverId: string | null = null
            let dropoffTime: Date | null = null

            if (day.label === "dün") {
              status = "COMPLETED"
              dropoffTime = new Date(startTime)
              dropoffTime.setMinutes(dropoffTime.getMinutes() + 90)
              if (drivers.length > 0) driverId = drivers[Math.floor(Math.random() * drivers.length)].id
            } else if (day.label === "yarın") {
              status = "PENDING"
            } else {
              // Bugün — saate göre gerçekçi durum
              if (h < nowHour - 2) {
                status = "COMPLETED"
                dropoffTime = new Date(startTime)
                dropoffTime.setMinutes(dropoffTime.getMinutes() + 90)
                if (drivers.length > 0) driverId = drivers[Math.floor(Math.random() * drivers.length)].id
              } else if (h < nowHour - 1) {
                status = "DROPPING_OFF"
                if (drivers.length > 0) driverId = drivers[Math.floor(Math.random() * drivers.length)].id
              } else if (h < nowHour) {
                status = "IN_SERVICE"
                if (drivers.length > 0) driverId = drivers[Math.floor(Math.random() * drivers.length)].id
              } else if (h === nowHour) {
                status = "PICKING_UP"
                if (drivers.length > 0) driverId = drivers[Math.floor(Math.random() * drivers.length)].id
              } else {
                status = "PENDING"
              }
            }

            await prisma.transfer.create({
              data: { appointmentId: apt.id, status: status as any, driverId, dropoffTime },
            })
          }
        }
      }

      // Onay bekleyenler (bugün ve yarın için 3-5 adet)
      if (day.label !== "dün") {
        const pendingSlots = slots.filter((_, i) => i % 4 === 0).slice(0, 4)
        const pendingNames = ["Emre Kılıç","Derya Aydın","Gökhan Şen","Hülya Koç"]
        const sunway = agencies.find(a => a.name.includes("Sunway")) ?? agencies[0]

        for (let pi = 0; pi < pendingSlots.length; pi++) {
          const [h, m] = pendingSlots[pi].split(":").map(Number)
          const startTime = new Date(day.date)
          startTime.setHours(h, m, 0, 0)
          const endTime = new Date(startTime)
          endTime.setMinutes(endTime.getMinutes() + 60)
          const svc = services[pi % services.length]
          aptCount++

          await prisma.appointment.create({
            data: {
              customerName:   pendingNames[pi],
              roomNumber:     `${Math.floor(Math.random() * 400) + 100}`,
              serviceId:      svc.id,
              hotelId:        hotels[pi % hotels.length].id,
              agencyId:       sunway.id,
              startTime, endTime,
              pax:            Math.floor(Math.random() * 3) + 2,
              childCount:     pi % 2 === 0 ? 1 : 0,
              status:         "CONFIRMED",
              approvalStatus: "PENDING_APPROVAL",
              voucherNo:      `SWT-P${String(2000 + pi + (day.label === "yarın" ? 100 : 0))}`,
              notes:          pi === 0 ? "Bebek koltuğu gerekli" : null,
            },
          })
          await prisma.appointmentService.create({
            data: { appointmentId: (await prisma.appointment.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } }))!.id, serviceId: svc.id, price: svc.price },
          })
        }
      }
    }

    // ── 5. KASA + MUHASEBE (son 7 gün) ──────────────────────────────────────
    const expenseItems = [
      { desc: "Elektrik faturası",  cat: "GIDER_ELEKTRIK_SU"       },
      { desc: "Su faturası",        cat: "GIDER_ELEKTRIK_SU"       },
      { desc: "İnternet faturası",  cat: "GIDER_TELEFON_INTERNET"  },
      { desc: "Araç yakıt",         cat: "GIDER_ARAC_YAKIT"        },
      { desc: "Tamir bakım",        cat: "GIDER_ARAC_BAKIM"        },
      { desc: "Temizlik malzemesi", cat: "GIDER_SPA_MALZEME"       },
      { desc: "Havlu yıkama",       cat: "GIDER_SPA_MALZEME"       },
      { desc: "Personel yemek",     cat: "GIDER_MUTFAK"            },
      { desc: "Market alışverişi",  cat: "GIDER_MUTFAK"            },
      { desc: "Kırtasiye",          cat: "GIDER_ISYERI_BAKIM"      },
      { desc: "Ofis gideri",        cat: "GIDER_ISYERI_BAKIM"      },
      { desc: "Kira ödemesi",       cat: "GIDER_KIRA"              },
      { desc: "SSK prim ödemesi",   cat: "GIDER_SSK"               },
      { desc: "Çeşitli gider",      cat: "GIDER_DIGER"             },
    ]
    const receptionItems = [
      { desc: "Cilt bakımı",        sub: "GELIR_CILT_BAKIMI"  },
      { desc: "Masaj satışı",       sub: "GELIR_MASAJ"        },
      { desc: "Extra paket",        sub: "GELIR_EXTRA_PAKET"  },
      { desc: "Market satışı",      sub: "GELIR_MARKET"       },
      { desc: "Walk-in müşteri",    sub: "GELIR_CILT_BAKIMI"  },
      { desc: "Resepsiyon satış",   sub: "GELIR_EXTRA_PAKET"  },
    ]
    const creditDescs = ["Kredi kartı terminali","Pos cihazı ödemesi","Banka kredi taksiti"]
    const serviceNames = services.map(s => s.name)

    let kasaCount = 0

    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const kasaDate = new Date(
        baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - dayOffset
      )
      let vNo = 1

      // Yardımcı: cashEntry oluştur + muhasebe sync
      async function createEntry(data: any) {
        const created = await prisma.cashEntry.create({
          data: { ...data, date: kasaDate, voucherNo: vNo++, createdBy: userId },
          include: { staff: { select: { commissionRate: true } } },
        })
        await prisma.accountingEntry.deleteMany({ where: { cashEntryId: created.id } })
        // syncAccountingEntries inline (transaction olmadan — ayrı çağrılar atomik olmasa da demo için yeterli)
        const toCreate: any[] = []
        const base = { cashEntryId: created.id, date: kasaDate, createdBy: userId }

        if (created.agencyIncomeAmount && created.agencyIncomeCurrency) {
          toCreate.push({ ...base, accountCode: "GELIR_ACENTA", credit: created.agencyIncomeAmount, debit: 0, amount: created.agencyIncomeAmount, currency: created.agencyIncomeCurrency, agencyId: created.agencyId, description: created.description })
          if (created.agencyId) toCreate.push({ ...base, accountCode: `CARI_ACENTA_${created.agencyId}`, debit: created.agencyIncomeAmount, credit: 0, amount: created.agencyIncomeAmount, currency: created.agencyIncomeCurrency, agencyId: created.agencyId, description: created.description })
        }
        if (created.receptionIncomeAmount && created.receptionIncomeCurrency) {
          const code = (created as any).incomeSubCategory ?? "GELIR_RESEPSIYON"
          toCreate.push({ ...base, accountCode: code, credit: created.receptionIncomeAmount, debit: 0, amount: created.receptionIncomeAmount, currency: created.receptionIncomeCurrency, description: created.description })
        }
        if (created.staffIncomeAmount && created.staffIncomeCurrency) {
          toCreate.push({ ...base, accountCode: "GELIR_PERSONEL", credit: created.staffIncomeAmount, debit: 0, amount: created.staffIncomeAmount, currency: created.staffIncomeCurrency, staffId: created.staffId, description: created.description })
          if (created.staffId && created.staff?.commissionRate) {
            const prim = created.staffIncomeAmount * created.staff.commissionRate / 100
            toCreate.push({ ...base, accountCode: `CARI_PERSONEL_${created.staffId}`, debit: prim, credit: 0, amount: prim, currency: created.staffIncomeCurrency, staffId: created.staffId, description: `Prim: %${created.staff.commissionRate}` })
          }
        }
        if (created.creditCardAmount && created.creditCardCurrency) {
          toCreate.push({ ...base, accountCode: "GELIR_KREDI_KARTI", credit: created.creditCardAmount, debit: 0, amount: created.creditCardAmount, currency: created.creditCardCurrency, staffId: created.staffId, description: created.description })
          if (created.staffId && created.staff?.commissionRate) {
            const prim = created.creditCardAmount * created.staff.commissionRate / 100
            toCreate.push({ ...base, accountCode: `CARI_PERSONEL_${created.staffId}`, debit: prim, credit: 0, amount: prim, currency: created.creditCardCurrency, staffId: created.staffId, description: `Prim (KK): %${created.staff.commissionRate}` })
          }
        }
        if (created.expenseAmount && created.expenseCurrency) {
          const code = (created as any).expenseCategory ?? "GIDER_DIGER"
          toCreate.push({ ...base, accountCode: code, debit: created.expenseAmount, credit: 0, amount: created.expenseAmount, currency: created.expenseCurrency, staffId: created.staffId, description: created.description })
          if (code === "GIDER_PERSONEL_PRIM" && created.staffId) {
            toCreate.push({ ...base, accountCode: `CARI_PERSONEL_${created.staffId}`, debit: 0, credit: created.expenseAmount, amount: created.expenseAmount, currency: created.expenseCurrency, staffId: created.staffId, description: created.description })
          }
        }

        if (toCreate.length > 0) {
          await prisma.accountingEntry.createMany({ data: toCreate })
        }
        kasaCount++
      }

      // Acenta gelirleri (3-6/gün)
      for (let i = 0; i < Math.floor(Math.random() * 4) + 3; i++) {
        const ag = agencies[Math.floor(Math.random() * agencies.length)]
        const hotel = hotels[Math.floor(Math.random() * hotels.length)]
        const cur = ag.currency || "EUR"
        const pax = Math.random() < 0.4 ? 1 : Math.random() < 0.7 ? 2 : Math.floor(Math.random() * 3) + 3
        const price = cur === "GBP" ? Math.floor(Math.random() * 100) + 40 : Math.floor(Math.random() * 110) + 45
        await createEntry({
          agencyId: ag.id,
          hotelId: hotel.id,
          roomNumber: `${Math.floor(Math.random() * 400) + 100}`,
          serviceName: serviceNames[Math.floor(Math.random() * serviceNames.length)],
          pax,
          agencyIncomeAmount: price * pax,
          agencyIncomeCurrency: cur,
          description: `[DEMO] ${ag.name} geliri`,
        })
      }

      // Resepsiyon gelirleri (2-4/gün)
      for (let i = 0; i < Math.floor(Math.random() * 3) + 2; i++) {
        const item = receptionItems[Math.floor(Math.random() * receptionItems.length)]
        const cur = ["EUR","TRY","USD","GBP"][Math.floor(Math.random() * 4)]
        const amt = cur === "TRY" ? Math.floor(Math.random() * 1500) + 400 : Math.floor(Math.random() * 90) + 25
        await createEntry({
          receptionIncomeAmount: amt,
          receptionIncomeCurrency: cur,
          incomeSubCategory: item.sub,
          description: `[DEMO] ${item.desc}`,
        })
      }

      // Giderler (3-5/gün)
      for (let i = 0; i < Math.floor(Math.random() * 3) + 3; i++) {
        const item = expenseItems[Math.floor(Math.random() * expenseItems.length)]
        const isEur = Math.random() < 0.15
        const cur = isEur ? "EUR" : "TRY"
        const amt = isEur ? Math.floor(Math.random() * 40) + 10 : Math.floor(Math.random() * 700) + 50
        await createEntry({
          expenseAmount: amt,
          expenseCurrency: cur,
          expenseCategory: item.cat,
          description: `[DEMO] ${item.desc}`,
        })
      }

      // Kredi kartı (1-3/gün) — sadece TRY
      for (let i = 0; i < Math.floor(Math.random() * 3) + 1; i++) {
        const amt = Math.floor(Math.random() * 4000) + 800
        await createEntry({
          creditCardAmount: amt,
          creditCardCurrency: "TRY",
          description: "[DEMO] Kredi kartı ödemesi",
        })
      }

      // Personel satışları (2-3/gün)
      if (staffList.length > 0) {
        for (let i = 0; i < Math.floor(Math.random() * 2) + 2; i++) {
          const st = staffList[Math.floor(Math.random() * staffList.length)]
          const cur = ["EUR","USD","GBP","TRY"][Math.floor(Math.random() * 4)]
          const amt = cur === "TRY" ? Math.floor(Math.random() * 2000) + 500 : Math.floor(Math.random() * 110) + 40
          await createEntry({
            staffId: st.id,
            staffIncomeAmount: amt,
            staffIncomeCurrency: cur,
            description: `[DEMO] ${st.user.name} satışı`,
          })
        }

        // Personel kredi kartı (1-2/gün) — sadece TRY
        for (let i = 0; i < Math.floor(Math.random() * 2) + 1; i++) {
          const st = staffList[Math.floor(Math.random() * staffList.length)]
          const amt = Math.floor(Math.random() * 1500) + 400
          await createEntry({
            staffId: st.id,
            creditCardAmount: amt,
            creditCardCurrency: "TRY",
            description: `[DEMO] ${st.user.name} kredi kartı satışı`,
          })
        }

        // Prim ödemesi (gün 0 ve 3)
        if (dayOffset === 0 || dayOffset === 3) {
          for (const st of staffList.filter(s => s.commissionRate && s.commissionRate > 0)) {
            const amt = Math.floor(Math.random() * 400) + 100
            await createEntry({
              staffId: st.id,
              expenseAmount: amt,
              expenseCurrency: "TRY",
              expenseCategory: "GIDER_PERSONEL_PRIM",
              description: `[DEMO] ${st.user.name} prim ödemesi`,
            })
          }
        }
      }

      // Kasa teslim Barış Bey (gün 1 ve 4)
      if (dayOffset === 1 || dayOffset === 4) {
        const amt = Math.floor(Math.random() * 4000) + 2000
        await createEntry({
          expenseAmount: amt,
          expenseCurrency: "TRY",
          expenseCategory: "GIDER_KASA_TESLIM_BARIS",
          description: "[DEMO] Barış Bey kasa teslimi",
        })
      }

      // Kredi/borç (0-1/gün)
      if (Math.random() < 0.4) {
        const amt = Math.floor(Math.random() * 1200) + 400
        await createEntry({
          creditAmount: amt,
          creditCurrency: "TRY",
          description: `[DEMO] ${creditDescs[Math.floor(Math.random() * creditDescs.length)]}`,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `✓ ${aptCount} randevu + ${kasaCount} kasa girişi oluşturuldu (dün/bugün/yarın + 7 günlük kasa)`,
      aptCount,
      kasaCount,
    })
  } catch (error: any) {
    console.error("[demo/reset-operations] HATA:", error)
    return NextResponse.json(
      { error: "Demo data yüklenemedi", details: String(error?.message ?? error) },
      { status: 500 }
    )
  }
}
