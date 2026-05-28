// ---------------------------------------------------------------------------
// Appointment availability calculator
//
// Given a service and a date range, returns all bookable slots minus any
// existing appointments. Handles two service modes:
//
//   1. uses_fixed_slots = false (Bike Fit, Taller, Asesoría)
//      Each service_window is an OPEN range. We generate sub-slots inside
//      each window based on duration_minutes + buffer_minutes.
//
//   2. uses_fixed_slots = true (Indoor Cycling)
//      Each service_window IS one bookable slot. We just deduct existing
//      bookings from capacity_per_slot.
//
// All times are computed in Colombia time (America/Bogota, UTC-5, no DST).
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js"

const TZ_OFFSET_HOURS = -5 // Colombia is UTC-5 year-round

export interface AvailabilitySlot {
  starts_at: string // ISO timestamp in UTC
  ends_at: string
  starts_at_local: string // For display: "2026-05-28T10:00"
  available_capacity: number
}

interface ServiceConfig {
  id: string
  name: string
  duration_minutes: number
  buffer_minutes: number
  uses_fixed_slots: boolean
  capacity_per_slot: number
  is_active: boolean
}

interface ServiceWindow {
  day_of_week: number
  start_time: string // 'HH:MM:SS'
  end_time: string
}

interface ExistingAppointment {
  starts_at: string
  ends_at: string
}

/**
 * Convert a local Bogota date+time to UTC ISO string.
 * Example: makeUtcFromBogota(2026, 5, 28, 10, 0) → "2026-05-28T15:00:00Z"
 */
function makeUtcFromBogota(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number
): Date {
  // Bogota local time + 5h = UTC
  return new Date(Date.UTC(year, month - 1, day, hour - TZ_OFFSET_HOURS, minute))
}

/**
 * Get the Bogota day-of-week for a UTC date.
 * Sunday=0, Monday=1, ..., Saturday=6 (matches Postgres EXTRACT(DOW))
 */
function bogotaDayOfWeek(utcDate: Date): number {
  // Shift to Bogota local before extracting DOW
  const bogotaTime = new Date(utcDate.getTime() + TZ_OFFSET_HOURS * 3600 * 1000)
  return bogotaTime.getUTCDay()
}

/**
 * Parse 'HH:MM:SS' into [hour, minute]
 */
function parseTime(time: string): [number, number] {
  const [h, m] = time.split(":").map(Number)
  return [h, m]
}

export async function getServiceAvailability({
  supabase,
  serviceId,
  fromDate,
  daysAhead = 14,
}: {
  supabase: SupabaseClient
  serviceId: string
  fromDate: Date // Start date (today in Bogota)
  daysAhead?: number
}): Promise<AvailabilitySlot[]> {
  // 1. Load service config
  const { data: service } = await supabase
    .from("crm_appointment_services")
    .select("*")
    .eq("id", serviceId)
    .eq("is_active", true)
    .maybeSingle()

  if (!service) return []

  const svc = service as ServiceConfig

  // 2. Load all active windows for this service
  const { data: windows } = await supabase
    .from("crm_service_windows")
    .select("day_of_week, start_time, end_time")
    .eq("service_id", serviceId)
    .eq("is_active", true)

  if (!windows || windows.length === 0) return []

  // 3. Load existing appointments in the date range
  const rangeStart = new Date(fromDate)
  rangeStart.setUTCHours(0, 0, 0, 0)
  const rangeEnd = new Date(rangeStart.getTime() + daysAhead * 24 * 3600 * 1000)

  const { data: existing } = await supabase
    .from("crm_appointments")
    .select("starts_at, ends_at")
    .eq("service_id", serviceId)
    .in("status", ["scheduled", "confirmed"])
    .gte("starts_at", rangeStart.toISOString())
    .lt("starts_at", rangeEnd.toISOString())

  const bookings = (existing ?? []) as ExistingAppointment[]

  // 4. Generate candidate slots for each day in the range
  const slots: AvailabilitySlot[] = []
  const now = new Date()
  const minStartTime = new Date(now.getTime() + 60 * 60 * 1000) // 1h lead time minimum

  for (let i = 0; i < daysAhead; i++) {
    const currentDay = new Date(rangeStart.getTime() + i * 24 * 3600 * 1000)
    const bogotaDow = bogotaDayOfWeek(currentDay)

    const dayWindows = (windows as ServiceWindow[]).filter(
      (w) => w.day_of_week === bogotaDow
    )

    for (const win of dayWindows) {
      const [startH, startM] = parseTime(win.start_time)
      const [endH, endM] = parseTime(win.end_time)

      // Get the Bogota Y/M/D for this iteration
      const bogotaTime = new Date(
        currentDay.getTime() + TZ_OFFSET_HOURS * 3600 * 1000
      )
      const year = bogotaTime.getUTCFullYear()
      const month = bogotaTime.getUTCMonth() + 1
      const day = bogotaTime.getUTCDate()

      const windowStart = makeUtcFromBogota(year, month, day, startH, startM)
      const windowEnd = makeUtcFromBogota(year, month, day, endH, endM)

      if (svc.uses_fixed_slots) {
        // Each window IS one slot
        if (windowStart < minStartTime) continue

        const overlapping = bookings.filter((b) => {
          const bStart = new Date(b.starts_at)
          return bStart.getTime() === windowStart.getTime()
        })

        const used = overlapping.length
        const remaining = Math.max(0, svc.capacity_per_slot - used)
        if (remaining > 0) {
          slots.push({
            starts_at: windowStart.toISOString(),
            ends_at: windowEnd.toISOString(),
            starts_at_local: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
            available_capacity: remaining,
          })
        }
      } else {
        // Generate sub-slots inside the window
        const slotDuration = (svc.duration_minutes + svc.buffer_minutes) * 60 * 1000
        let cursorMs = windowStart.getTime()
        const windowEndMs = windowEnd.getTime()

        while (cursorMs + svc.duration_minutes * 60 * 1000 <= windowEndMs) {
          const slotStart = new Date(cursorMs)
          const slotEnd = new Date(cursorMs + svc.duration_minutes * 60 * 1000)

          if (slotStart >= minStartTime) {
            // Check if this slot overlaps any booking
            const overlaps = bookings.some((b) => {
              const bStart = new Date(b.starts_at).getTime()
              const bEnd = new Date(b.ends_at).getTime()
              return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart
            })

            if (!overlaps) {
              const slotBogota = new Date(
                slotStart.getTime() + TZ_OFFSET_HOURS * 3600 * 1000
              )
              const sh = slotBogota.getUTCHours()
              const sm = slotBogota.getUTCMinutes()
              slots.push({
                starts_at: slotStart.toISOString(),
                ends_at: slotEnd.toISOString(),
                starts_at_local: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`,
                available_capacity: 1,
              })
            }
          }

          cursorMs += slotDuration
        }
      }
    }
  }

  return slots
}

/**
 * Check if a specific time is available for a given service.
 * Used when creating an appointment to validate the proposed time.
 */
export async function isSlotAvailable({
  supabase,
  serviceId,
  startsAt,
}: {
  supabase: SupabaseClient
  serviceId: string
  startsAt: Date
}): Promise<{ available: boolean; reason?: string; endsAt?: Date }> {
  const { data: service } = await supabase
    .from("crm_appointment_services")
    .select("*")
    .eq("id", serviceId)
    .eq("is_active", true)
    .maybeSingle()

  if (!service) return { available: false, reason: "Service not found or inactive" }

  const svc = service as ServiceConfig
  const endsAt = new Date(startsAt.getTime() + svc.duration_minutes * 60 * 1000)

  // Check window match
  const bogotaDow = bogotaDayOfWeek(startsAt)
  const bogotaTime = new Date(startsAt.getTime() + TZ_OFFSET_HOURS * 3600 * 1000)
  const reqHour = bogotaTime.getUTCHours()
  const reqMinute = bogotaTime.getUTCMinutes()
  const reqTimeStr = `${String(reqHour).padStart(2, "0")}:${String(reqMinute).padStart(2, "0")}:00`

  const { data: windows } = await supabase
    .from("crm_service_windows")
    .select("start_time, end_time")
    .eq("service_id", serviceId)
    .eq("day_of_week", bogotaDow)
    .eq("is_active", true)

  if (!windows || windows.length === 0) {
    return { available: false, reason: "No service hours for this day" }
  }

  const inWindow = (windows as { start_time: string; end_time: string }[]).some(
    (w) => {
      if (svc.uses_fixed_slots) {
        return w.start_time === reqTimeStr
      }
      const [endH, endM] = parseTime(w.end_time)
      const windowEndBogota = new Date(bogotaTime)
      windowEndBogota.setUTCHours(endH, endM, 0, 0)
      const windowStartBogota = new Date(bogotaTime)
      const [startH, startM] = parseTime(w.start_time)
      windowStartBogota.setUTCHours(startH, startM, 0, 0)

      return (
        bogotaTime >= windowStartBogota &&
        new Date(endsAt.getTime() + TZ_OFFSET_HOURS * 3600 * 1000) <=
          windowEndBogota
      )
    }
  )

  if (!inWindow) {
    return { available: false, reason: "Outside of service hours" }
  }

  // Check for conflicts
  const { data: conflicts } = await supabase
    .from("crm_appointments")
    .select("id, starts_at, ends_at")
    .eq("service_id", serviceId)
    .in("status", ["scheduled", "confirmed"])
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString())

  if (svc.uses_fixed_slots) {
    const count = conflicts?.length ?? 0
    if (count >= svc.capacity_per_slot) {
      return { available: false, reason: "Slot is full", endsAt }
    }
  } else if (conflicts && conflicts.length > 0) {
    return { available: false, reason: "Time conflicts with another booking", endsAt }
  }

  return { available: true, endsAt }
}
