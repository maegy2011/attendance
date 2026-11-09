// utils/periods.js — مدد نظام العمل الدورية (تعديل 6 v12.12)
// المدة: {id, name, from:'yyyy-mm-dd', to:'yyyy-mm-dd',
//   officialStart, officialEnd, workSystemMode,
//   shift1:{start,end}, shift2:{start,end}, shift3:{start,end}}
// تعديل 4: الإجازة الأسبوعية بقت عامة فقط — نسخ المدة ودمجها للweekendDays اتشال (القيم القديمة تتجاهل)
// تعديل 1 (دورة جديدة): الشرايح بقت عامة فقط — نسخ المدة ودمجها للtardiness اتشال (القيم المخزنة تتجاهل بلا مسح)
// تعديل 1+2 (دورة جديدة): شيل معايرة المدة + الخاصة بقت عامة — القيم القديمة المخزنة تتجاهل بتسامح
// اليوم اللي مش داخل في أي مدة يشتغل على الإعدادات الحالية (الافتراضي) — تعديل 6

export function getPeriods(settings) {
  const p = settings && settings.tardinessPeriods
  return Array.isArray(p) ? p : []
}

export function findPeriodForDate(settings, dk) {
  if (!dk) return null
  const ps = getPeriods(settings).filter(p => p && p.from && p.to && p.from <= dk && dk <= p.to)
  ps.sort((a, b) => String(a.from).localeCompare(String(b.from)))
  return ps[0] || null
}

export function toMin(hm) {
  if (hm == null || hm === '') return null
  const [h, m] = String(hm).split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

export function minToHM(min) {
  const v = ((Math.round(min) % 1440) + 1440) % 1440
  return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0')
}

export function addMinutes(hm, min) {
  const base = toMin(hm)
  if (base == null) return hm
  let v = base + min
  if (v > 1439) v = 1439
  if (v < 0) v = 0
  return minToHM(v)
}

// الشرايح الافتراضية مربوطة ببداية الوردية: 0-15 صفر / 16-30 واحد / 31-45 اتنين / 46+ تلاتة — تعديل 6
export function defaultSlicesFor(startHM) {
  return [
    { from: addMinutes(startHM, 0), to: addMinutes(startHM, 15), count: 0 },
    { from: addMinutes(startHM, 16), to: addMinutes(startHM, 30), count: 1 },
    { from: addMinutes(startHM, 31), to: addMinutes(startHM, 45), count: 2 },
    { from: addMinutes(startHM, 46), to: '23:59', count: 3 },
  ]
}

export function defaultSpecialShift() {
  return {
    start: '08:00', end: '17:00',
    // تعديل 3 (دورة جديدة): فاكتور أساسي + خصم اختياري بدل otMethod/minusHours
    otFactor: 1, deductOn: true, deductHours: 7,
    lunchOn: true, lunchHours: 8,
    bonusOn: false, bonusHours: 7,
    taxiOn: false, taxiHours: 7,
    graceMin: 0,
  }
}

// مدة جديدة مبنية من الإعدادات الحالية (الافتراضي) — تعديل 6
export function defaultPeriod(name, from, to, settings) {
  const s = settings || {}
  const sh = (k, ds, de) => ({ start: (s[k] && s[k].start) || ds, end: (s[k] && s[k].end) || de })
  const s1 = sh('shift1', '08:00', '17:00'), s2 = sh('shift2', '16:00', '00:00'), s3 = sh('shift3', '00:00', '08:00')
  return {
    id: 'p' + Date.now(),
    name: name || '', from: from || '', to: to || '',
    officialStart: s.officialStart || '08:00', officialEnd: s.officialEnd || '15:00',
    workSystemMode: s.workSystemMode || 'single',
    shift1: s1, shift2: s2, shift3: s3,
  }
}

// دمج إعدادات المدة فوق الافتراضي لتاريخ معين — تعديل 6
export function resolvePeriodSettings(settings, dk) {
  const p = findPeriodForDate(settings, dk)
  if (!p) return settings
  const m = { ...settings }
  for (const k of ['officialStart', 'officialEnd', 'workSystemMode', 'shift1', 'shift2', 'shift3']) {
    if (p[k] !== undefined) m[k] = p[k]
  }
  return m
}

// مطابقة وقت الحضور (HH:MM) على الشرايح المطلقة — التصريح يصفر اليوم مركزيًا — تعديل 6
export function countFromRanges(ranges, hm, hasPermit) {
  if (hasPermit) return 0
  if (!hm) return 0
  for (const r of (ranges || [])) {
    if (r && r.from && r.to && hm >= r.from && hm <= r.to) return r.count || 0
  }
  return 0
}

// مطابقة بالأوفست من بداية مرجعية (للوردية الخاصة: أوفست التانية على موعد الخاصة + السماح) — تعديل 7
export function countFromOffsets(ranges, anchorStartHM, checkHM, anchorShiftHM, hasPermit) {
  if (hasPermit) return 0
  const a0 = toMin(anchorShiftHM), a1 = toMin(anchorStartHM), c = toMin(checkHM)
  if (a0 == null || a1 == null || c == null) return 0
  const rel = c - a1
  for (const r of (ranges || [])) {
    if (!r || !r.from || !r.to) continue
    if (rel >= toMin(r.from) - a0 && rel <= toMin(r.to) - a0) return r.count || 0
  }
  return 0
}

// تحقق المدد + الشرايح — يرجع قائمة أخطاء عربية — تعديل 6
export function validatePeriods(periods) {
  const errs = []
  const ps = Array.isArray(periods) ? periods : []
  const names = {}
  const sorted = [...ps].sort((a, b) => String(a.from || '').localeCompare(String(b.from || '')))
  sorted.forEach((p, i) => {
    const tag = `مدة "${p.name || '؟'}"`
    if (!p.name) errs.push(`${tag}: الاسم فاضي`)
    else if (names[p.name]) errs.push(`${tag}: الاسم مكرر`)
    else names[p.name] = 1
    if (!p.from || !p.to) errs.push(`${tag}: التاريخ من/إلى فاضي`)
    else if (p.from > p.to) errs.push(`${tag}: تاريخ البداية بعد النهاية`)
    if (i > 0 && p.from && sorted[i - 1].to && p.from <= sorted[i - 1].to) errs.push(`${tag}: متداخلة مع مدة "${sorted[i - 1].name}"`)
    // تعديل 1 (v12.15.8): الشرايح عامة فقط — المدة اللي مافيهاش شرايح خاصة تتجاوز فحص السطور
    const hasOwnSlices = !!(p.tardiness && (p.tardiness.shift1 || p.tardiness.shift2 || p.tardiness.shift3))
    if (hasOwnSlices) {
    for (const sh of ['shift1', 'shift2', 'shift3']) {
      const rows = (p.tardiness && p.tardiness[sh]) || []
      if (rows.length !== 4) { errs.push(`${tag} ${sh}: لازم 4 سطور`); continue }
      rows.forEach((r, ri) => {
        if (!r.from || !r.to) { errs.push(`${tag} ${sh} سطر ${ri + 1}: خانة فاضية`); return }
        if (r.to <= r.from && ri < 3) errs.push(`${tag} ${sh} سطر ${ri + 1}: النهاية لازم تبقى بعد البداية`)
        if (ri > 0) {
          const prev = rows[ri - 1]
          if (prev.to && r.from !== addMinutes(prev.to, 1)) errs.push(`${tag} ${sh} سطر ${ri + 1}: لازم يبدأ بعد نهاية اللي قبله بدقيقة`)
          if (prev.to && r.from <= prev.to) errs.push(`${tag} ${sh} سطر ${ri + 1}: متداخل مع اللي قبله`)
        }
      })
    }
    }
  })
  return errs
}
