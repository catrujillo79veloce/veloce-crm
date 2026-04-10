import type { LeadStatus, DealStage, Priority, ContactSource, TaskStatus } from "./types"

export const TIMEZONE = "America/Bogota"
export const DEFAULT_CURRENCY = "COP"
export const DEFAULT_CITY = "Medellín"

export const LEAD_STATUSES: { value: LeadStatus; label: { es: string; en: string }; color: string }[] = [
  { value: "new", label: { es: "Nuevo", en: "New" }, color: "#3b82f6" },
  { value: "contacted", label: { es: "Contactado", en: "Contacted" }, color: "#8b5cf6" },
  { value: "qualified", label: { es: "Calificado", en: "Qualified" }, color: "#f59e0b" },
  { value: "proposal", label: { es: "Propuesta", en: "Proposal" }, color: "#f97316" },
  { value: "negotiation", label: { es: "Negociación", en: "Negotiation" }, color: "#ef4444" },
  { value: "won", label: { es: "Ganado", en: "Won" }, color: "#22c55e" },
  { value: "lost", label: { es: "Perdido", en: "Lost" }, color: "#6b7280" },
]

export const DEAL_STAGES: { value: DealStage; label: { es: string; en: string }; color: string }[] = [
  { value: "qualification", label: { es: "Calificación", en: "Qualification" }, color: "#3b82f6" },
  { value: "proposal", label: { es: "Propuesta", en: "Proposal" }, color: "#f59e0b" },
  { value: "negotiation", label: { es: "Negociación", en: "Negotiation" }, color: "#f97316" },
  { value: "closed_won", label: { es: "Cerrado Ganado", en: "Closed Won" }, color: "#22c55e" },
  { value: "closed_lost", label: { es: "Cerrado Perdido", en: "Closed Lost" }, color: "#6b7280" },
]

export const PRIORITIES: { value: Priority; label: { es: string; en: string }; color: string }[] = [
  { value: "low", label: { es: "Baja", en: "Low" }, color: "#6b7280" },
  { value: "medium", label: { es: "Media", en: "Medium" }, color: "#f59e0b" },
  { value: "high", label: { es: "Alta", en: "High" }, color: "#f97316" },
  { value: "urgent", label: { es: "Urgente", en: "Urgent" }, color: "#ef4444" },
]

export const TASK_STATUSES: { value: TaskStatus; label: { es: string; en: string } }[] = [
  { value: "pending", label: { es: "Pendiente", en: "Pending" } },
  { value: "in_progress", label: { es: "En Progreso", en: "In Progress" } },
  { value: "completed", label: { es: "Completada", en: "Completed" } },
  { value: "cancelled", label: { es: "Cancelada", en: "Cancelled" } },
]

export const CONTACT_SOURCES: { value: ContactSource; label: { es: string; en: string }; icon: string; color: string }[] = [
  { value: "website_form", label: { es: "Sitio Web", en: "Website" }, icon: "Globe", color: "#6b7280" },
  { value: "facebook_lead_ads", label: { es: "Facebook", en: "Facebook" }, icon: "Facebook", color: "#1877f2" },
  { value: "instagram", label: { es: "Instagram", en: "Instagram" }, icon: "Instagram", color: "#e4405f" },
  { value: "whatsapp", label: { es: "WhatsApp", en: "WhatsApp" }, icon: "MessageCircle", color: "#25d366" },
  { value: "walk_in", label: { es: "Tienda", en: "Store" }, icon: "Store", color: "#8b5cf6" },
  { value: "referral", label: { es: "Referido", en: "Referral" }, icon: "Users", color: "#f59e0b" },
  { value: "manual", label: { es: "Manual", en: "Manual" }, icon: "PenLine", color: "#64748b" },
  { value: "cycling_app", label: { es: "App Ciclismo", en: "Cycling App" }, icon: "Bike", color: "#22c55e" },
]

export const PRODUCT_CATEGORIES = [
  { value: "road_bike", label: { es: "Bicicleta de Ruta", en: "Road Bike" } },
  { value: "mtb", label: { es: "MTB", en: "MTB" } },
  { value: "gravel", label: { es: "Gravel", en: "Gravel" } },
  { value: "urban", label: { es: "Urbana", en: "Urban" } },
  { value: "accessories", label: { es: "Accesorios", en: "Accessories" } },
  { value: "components", label: { es: "Componentes", en: "Components" } },
  { value: "clothing", label: { es: "Ropa", en: "Clothing" } },
  { value: "indoor_cycling", label: { es: "Ciclismo Indoor", en: "Indoor Cycling" } },
  { value: "service", label: { es: "Servicio", en: "Service" } },
]

export const CYCLING_EXPERIENCES = [
  { value: "beginner", label: { es: "Principiante", en: "Beginner" } },
  { value: "intermediate", label: { es: "Intermedio", en: "Intermediate" } },
  { value: "advanced", label: { es: "Avanzado", en: "Advanced" } },
  { value: "pro", label: { es: "Profesional", en: "Pro" } },
]
