// 等价移植自 Vue 版 前端代码/src/views/report/period.ts:逐行照搬,不改语义。
// Intl 统一用 Asia/Shanghai;周计算把 ISO 字符串当 UTC 日期运算,周一为一周之首。

export function shanghaiIsoDate(when = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(when)
}

export function shanghaiDate(when = new Date()) {
  return new Date(`${shanghaiIsoDate(when)}T00:00:00+08:00`)
}

export function periodRangeLabel(period: { start: string; end: string }) {
  return `${period.start} 至 ${period.end}`
}

export function resolveDayPeriod(onDate: Date) {
  const iso = shanghaiIsoDate(onDate)
  return { start: iso, end: iso }
}

export function resolveWeekPeriod(onDate: Date, today = new Date()) {
  const onIso = shanghaiIsoDate(onDate)
  const todayIso = shanghaiIsoDate(today)
  const monday = addIsoDays(onIso, -weekdayMonday0(onIso))
  const thisMonday = addIsoDays(todayIso, -weekdayMonday0(todayIso))
  if (monday === thisMonday) {
    return { start: monday, end: todayIso }
  }
  return { start: monday, end: addIsoDays(monday, 6) }
}

function weekdayMonday0(iso: string) {
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay()
  return weekday === 0 ? 6 : weekday - 1
}

function addIsoDays(iso: string, days: number) {
  const next = new Date(`${iso}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}
