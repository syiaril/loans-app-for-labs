import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from "date-fns"
import { id } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, fmt: string = "dd MMM yyyy") {
  return format(new Date(date), fmt, { locale: id })
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), "dd MMM yyyy HH:mm", { locale: id })
}

export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: id })
}

export function generateLoanCode(): string {
  const now = new Date()
  const yy = now.getFullYear().toString().slice(-2)
  const mm = (now.getMonth() + 1).toString().padStart(2, "0")
  const dd = now.getDate().toString().padStart(2, "0")
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let random = ""
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `LN${yy}${mm}${dd}${random}`
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  borrowed: "Dipinjam",
  partial_return: "Sebagian Kembali",
  returned: "Dikembalikan",
  overdue: "Terlambat",
  cancelled: "Dibatalkan",
}

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  borrowed: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  partial_return: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  returned: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  overdue: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
}

export const ITEM_STATUS_LABELS: Record<string, string> = {
  available: "Tersedia",
  borrowed: "Dipinjam",
  maintenance: "Perbaikan",
  lost: "Hilang",
}

export const ITEM_STATUS_COLORS: Record<string, string> = {
  available: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  borrowed: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  maintenance: "bg-red-500/20 text-red-400 border-red-500/30",
  lost: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
}

export const CONDITION_LABELS: Record<string, string> = {
  good: "Baik",
  fair: "Cukup",
  poor: "Buruk",
  damaged: "Rusak",
  lost: "Hilang",
}

export const ACTION_LABELS: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  borrow: "Peminjaman",
  return: "Pengembalian",
  create: "Buat",
  update: "Edit",
  delete: "Hapus",
  approve: "Setujui",
}
