/** Format tiền tệ VND */
export function fmtVND(n: number): string {
  return (Number(n) || 0).toLocaleString('vi-VN') + '₫'
}

/** Format số không có đơn vị */
export function fmtNum(n: number): string {
  return (Number(n) || 0).toLocaleString('vi-VN')
}

/** Pad 2 chữ số */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** Format ngày YYYY-MM-DD */
export function dayStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Format datetime ngắn HH:mm DD/MM */
export function fmtDateTime(ts: number | string | Date | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`
}

/** Format time HH:mm */
export function fmtTime(ts: number | string | Date | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** Tính số phút trễ */
export function minsAgo(ts: number | string | Date): number {
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
}

/** Tạo device id cho phiên */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server'
  let id = localStorage.getItem('cfh-device')
  if (!id) {
    id = Math.random().toString(36).slice(2, 10)
    localStorage.setItem('cfh-device', id)
  }
  return id
}

export const VIEWNAME: Record<string, string> = {
  pos: 'Tạo đơn',
  kitchen: 'Quầy pha',
  pay: 'Thu tiền',
  report: 'Báo cáo',
}

export const VIEWIC: Record<string, string> = {
  pos: '🧾',
  kitchen: '☕',
  pay: '💵',
  report: '📊',
}

export const TABDEF: Record<string, [string, string]> = {
  pos: ['🧾', 'Tạo đơn'],
  kitchen: ['☕', 'Quầy pha'],
  pay: ['💵', 'Thu tiền'],
  report: ['📊', 'Báo cáo'],
  leaderboard: ['🏆', 'Xếp hạng'],
  menu: ['⚙️', 'Cài đặt'],
}

export const STATUSNAME: Record<string, string> = {
  new: 'chờ pha',
  notified: 'đã gửi thông báo',
  making: 'đang pha',
  done: 'xong món',
  paid: 'đã thu tiền',
  canceled: 'đã hủy',
}

export const NOTES_OPTIONS = ['Lạnh', 'Nóng', 'Ít ngọt', 'Nhiều đá', 'Không đá', 'Đá riêng']
