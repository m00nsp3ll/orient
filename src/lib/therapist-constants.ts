export const THERAPIST_SERVICE_TYPES = [
  { code: "20DK",        label: "20 dk",       primEur: 0.5 },
  { code: "30DK",        label: "30 dk",       primEur: 0.75 },
  { code: "45DK",        label: "45 dk",       primEur: 1 },
  { code: "60DK",        label: "60 dk",       primEur: 1.5 },
  { code: "75DK",        label: "75 dk",       primEur: 2 },
  { code: "90DK",        label: "90 dk",       primEur: 2.5 },
  { code: "60DK_PAKET",  label: "60 dk Paket", primEur: 3 },
  { code: "90DK_PAKET",  label: "90 dk Paket", primEur: 5 },
  { code: "CILT_BAKIMI", label: "Cilt Bakımı", primEur: 2 },
  { code: "KESE_KOPUK", label: "Kese Köpük", primEur: 0.5 },
] as const

export type TherapistServiceCode = typeof THERAPIST_SERVICE_TYPES[number]["code"]

export function getServicePrim(code: string): number {
  return THERAPIST_SERVICE_TYPES.find(s => s.code === code)?.primEur ?? 0
}

export function getServiceLabel(code: string): string {
  return THERAPIST_SERVICE_TYPES.find(s => s.code === code)?.label ?? code
}

export function therapistAccountCode(therapistId: string): string {
  return `CARI_TERAPIST_${therapistId}`
}
