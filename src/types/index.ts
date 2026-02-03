import { Prisma } from "@prisma/client"

export type UserWithStaff = Prisma.UserGetPayload<{
  include: { staff: true }
}>

export type StaffWithUser = Prisma.StaffGetPayload<{
  include: { user: true; workingHours: true }
}>

export type ServiceWithCategory = Prisma.ServiceGetPayload<{
  include: { category: true }
}>

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: {
    customer: true
    staff: { include: { user: true } }
    service: true
  }
}>

export interface TimeSlot {
  startTime: Date
  endTime: Date
  available: boolean
}

export interface DashboardStats {
  todayAppointments: number
  pendingAppointments: number
  completedToday: number
  totalCustomers: number
}
