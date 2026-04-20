import { prisma } from "./prisma"

// ── Yetki Tanımları ──────────────────────────────────────────────────────────
export const STAFF_POSITIONS = ["Admin", "Operasyon", "Müdür", "Resepsiyon", "Infocu"] as const
export type StaffPosition = (typeof STAFF_POSITIONS)[number]

export const PERMISSIONS = [
  // Özel (kırmızı) yetkiler
  { key: "operasyon_duzenleme", label: "Operasyon Düzenleme", description: "Randevu ve operasyon ekleme/düzenleme/silme", isSpecial: true },
  { key: "kasa_yonetimi", label: "Kasa Yönetimi", description: "Kasa girişlerini düzenleme ve silme", isSpecial: true },
  // Görüntüleme yetkileri
  { key: "dashboard_view", label: "Dashboard", description: "Ana sayfa görüntüleme", isSpecial: false },
  { key: "randevu_view", label: "Randevular", description: "Randevular sayfası görüntüleme", isSpecial: false },
  { key: "operasyon_view", label: "Operasyon", description: "Operasyon sayfası görüntüleme", isSpecial: false },
  { key: "soforer_view", label: "Şoförler", description: "Şoförler sayfası görüntüleme", isSpecial: false },
  { key: "kasa_view", label: "Günlük Kasa", description: "Kasa sayfası görüntüleme (salt okunur)", isSpecial: false },
  { key: "muhasebe_view", label: "Muhasebe", description: "Muhasebe sayfası görüntüleme", isSpecial: false },
  { key: "istatistik_view", label: "İstatistikler", description: "İstatistikler sayfası görüntüleme", isSpecial: false },
  { key: "personel_view", label: "Personel", description: "Personel sayfası görüntüleme", isSpecial: false },
  { key: "hizmetler_view", label: "Hizmetler", description: "Hizmetler sayfası görüntüleme", isSpecial: false },
  { key: "oteller_view", label: "Oteller", description: "Oteller sayfası görüntüleme", isSpecial: false },
  { key: "acentalar_view", label: "Acentalar", description: "Acentalar sayfası görüntüleme", isSpecial: false },
  { key: "terapistler_view", label: "Terapistler", description: "Terapistler sayfası görüntüleme", isSpecial: false },
  { key: "terapistler_yonetim", label: "Terapist Yönetimi", description: "Terapist ekleme, giriş silme ve düzenleme", isSpecial: true },
] as const

export type PermissionKey = (typeof PERMISSIONS)[number]["key"]

// ── Varsayılan Yetkiler ──────────────────────────────────────────────────────
export const DEFAULT_STAFF_PERMISSIONS: Record<string, PermissionKey[]> = {
  Admin: [
    "dashboard_view", "randevu_view", "operasyon_view", "kasa_view",
    "muhasebe_view", "istatistik_view", "personel_view", "hizmetler_view",
    "oteller_view", "acentalar_view", "operasyon_duzenleme", "kasa_yonetimi",
    "terapistler_view", "terapistler_yonetim",
  ],
  Operasyon: [
    "dashboard_view", "randevu_view", "operasyon_view", "soforer_view", "istatistik_view",
    "operasyon_duzenleme", "kasa_view", "kasa_yonetimi", "oteller_view",
    "terapistler_view", "terapistler_yonetim",
  ],
  "Müdür": [
    "dashboard_view", "randevu_view", "operasyon_view", "kasa_view",
    "muhasebe_view", "istatistik_view", "personel_view", "hizmetler_view",
    "oteller_view", "acentalar_view", "terapistler_view",
  ],
  Resepsiyon: [
    "dashboard_view", "randevu_view", "kasa_view",
  ],
  "Infocu": [
    "dashboard_view", "randevu_view",
  ],
}

// ── Sidebar Route → Permission Eşlemesi ──────────────────────────────────────
export const ROUTE_PERMISSION_MAP: Record<string, PermissionKey> = {
  "/dashboard": "dashboard_view",
  "/dashboard/appointments": "randevu_view",
  "/dashboard/operations": "operasyon_view",
  "/dashboard/operations/drivers": "soforer_view",
  "/dashboard/kasa": "kasa_view",
  "/dashboard/muhasebe": "muhasebe_view",
  "/dashboard/statistics": "istatistik_view",
  "/dashboard/staff": "personel_view",
  "/dashboard/services": "hizmetler_view",
  "/dashboard/hotels": "oteller_view",
  "/dashboard/session-times": "oteller_view",
  "/dashboard/agencies": "acentalar_view",
  "/dashboard/terapistler": "terapistler_view",
}

// ── Server-side Yetki Çözümle ────────────────────────────────────────────────
export async function getEffectivePermissions(
  role: string,
  position: string | null
): Promise<PermissionKey[]> {
  // ADMIN her zaman tam erişim
  if (role === "ADMIN") return PERMISSIONS.map(p => p.key)
  // STAFF dışındaki roller yetki sisteminden etkilenmez
  if (role !== "STAFF" || !position) return []

  const setting = await prisma.systemSetting.findUnique({
    where: { key: "staff_permissions" },
  })
  const permMap: Record<string, PermissionKey[]> = setting
    ? JSON.parse(setting.value)
    : DEFAULT_STAFF_PERMISSIONS

  return permMap[position] || []
}

// ── API Route Helper ─────────────────────────────────────────────────────────
export async function checkPermission(
  userRole: string,
  userId: string,
  requiredPermission: PermissionKey
): Promise<boolean> {
  if (userRole === "ADMIN") return true
  if (userRole !== "STAFF") return false

  const staff = await prisma.staff.findUnique({
    where: { userId },
    select: { position: true },
  })
  if (!staff?.position) return false

  const perms = await getEffectivePermissions("STAFF", staff.position)
  return perms.includes(requiredPermission)
}
