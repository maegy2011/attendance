// منطق التأخيرات الموحد — تعديل 6 (v12.12): المحرك الجديد يقرا الشرايح من المدد حسب التاريخ
// الافتراضي (مافيش مدة) = نفس الحدود القديمة مربوطة ببداية الوردية + فوق 45 = 3 (تعديل 6)
// التصريح يحذف تأخيرات اليوم مركزيًا هنا — تعديل 6
import { getPermitsV2 } from './storage'
import { getSpecialForRecord } from './specials'
import { resolvePeriodSettings, defaultSlicesFor, countFromRanges, countFromOffsets } from './periods'

export function getWeekendDays(settings) {
  return (settings.weekendDays && settings.weekendDays.length === 2) ? settings.weekendDays : [5, 6]
}

export function getShiftStartMin(settings, shift, sp) {
  if (shift === 'shiftX') {
    // تعديل 1: بداية الخاصة المختارة للسجل — ثم العام القديم — ثم 08:00
    if (sp && sp.start) { const [h, m] = sp.start.split(':').map(Number); return h * 60 + m }
    const s = (settings.specialShift && settings.specialShift.start) || '08:00'
    const [h, m] = s.split(':').map(Number)
    return h * 60 + m
  }
  const s = settings[shift] || settings.shift1 || { start: '08:00' }
  const [h, m] = (s.start || '08:00').split(':').map(Number)
  return h * 60 + m
}

// الفرق الخام (دقايق الحضور - بداية الوردية - السماح للخاصة) — سالب/صفر يعني مش متأخر
// يرجع 0 للحالات المستثناة (ويك إند/إجازة/مفيش حضور/حالة مش يوم عادي) — الـ7 مستثناة زي ما هي (تعديل 6)
export function getRawLateMin(records, settings, dk) {
  settings = resolvePeriodSettings(settings, dk)
  const weekendDays = getWeekendDays(settings)
  const dow = new Date(dk).getDay()
  if (weekendDays.includes(dow)) return 0
  const rec = (records || {})[dk]
  if (!rec?.checkIn) return 0
  const dc = rec.dayCalculation || rec.dayType || ''
  if (['regular_vacation', 'rest_day', 'sick', 'unpaid', 'special', 'weekend_rest', 'overtime_holiday', 'weekend_overtime'].includes(dc)) return 0
  if (rec.dayType === 'overtime_holiday' || rec.dayStatus === 'overtime_holiday' || rec.dayStatus === 'weekend_overtime') return 0
  const ds = rec.dayStatus || ''
  if (ds !== 'normal_day' && ds !== '') return 0
  const shift = rec.shift || rec.dayType
  // التعديل ٢٥: مفيش وردية متسجلة = مفيش تأخير (اتقفل القياس على الأولى) + shiftX (تعديل 7)
  if (!['shift1', 'shift2', 'shift3', 'shiftX'].includes(shift)) return 0
  const workStartMin = getShiftStartMin(settings, shift, getSpecialForRecord(settings, rec))
  let grace = 0
  if (shift === 'shiftX') grace = Number((getSpecialForRecord(settings, rec) || {}).graceMin || 0)
  const ci = new Date(rec.checkIn)
  return ci.getHours() * 60 + ci.getMinutes() - workStartMin - grace
}

// عدد التأخيرات من شرايح المدة (أو الافتراضي) — إذن تأخير بتاريخ اليوم يصفر اليوم كله — تعديل 6+7
export function getTardinessCount(records, settings, dk) {
  const S = resolvePeriodSettings(settings, dk)
  const rec = (records || {})[dk]
  if (!rec?.checkIn) return 0
  // تعديل 1 (v12.15.7): توحيد الاستبعاد عام + مدة — الجمعة/السبت + العطلات + الإجازات مفيش عليها تأخير (أيام أوفر تايم مش عمل رسمي)
  if (getWeekendDays(S).includes(new Date(dk).getDay())) return 0
  const dcx = rec.dayCalculation || rec.dayType || ''
  if (['regular_vacation', 'rest_day', 'sick', 'unpaid', 'special', 'weekend_rest', 'overtime_holiday', 'weekend_overtime', 'alt_day'].includes(dcx)) return 0
  if (rec.dayType === 'overtime_holiday' || rec.dayStatus === 'overtime_holiday' || rec.dayStatus === 'weekend_overtime' || rec.dayStatus === 'alt_day') return 0
  const dsx = rec.dayStatus || ''
  if (dsx !== 'normal_day' && dsx !== '') return 0
  const shift = rec.shift || rec.dayType || ''
  if (!['shift1', 'shift2', 'shift3', 'shiftX'].includes(shift)) return 0
  let permits = []
  try { permits = getPermitsV2() || [] } catch { permits = [] }
  const hasPermit = hasLatePermit(permits, dk)
  if (hasPermit) return 0
  const ci = new Date(rec.checkIn)
  const hm = String(ci.getHours()).padStart(2, '0') + ':' + String(ci.getMinutes()).padStart(2, '0')
  // الوردية الخاصة: شرايح التانية مربوطة بموعد الخاصة المختارة + السماح — تعديل 3 مربوط بمربع الخصم
  if (shift === 'shiftX') {
    const sp = getSpecialForRecord(S, rec) || {}
    if (!sp.deductOn) return 0
    const s2ranges = (S.tardiness && S.tardiness.shift2) || defaultSlicesFor(minToHM(getShiftStartMin(S, 'shift2')))
    const anchor = minToHM(getShiftStartMin(S, 'shiftX', sp) + (Number(sp.graceMin) || 0))
    const s2anchor = minToHM(getShiftStartMin(S, 'shift2'))
    return countFromOffsets(s2ranges, anchor, hm, s2anchor, false)
  }
  const ranges = (S.tardiness && S.tardiness[shift]) || defaultSlicesFor(minToHM(getShiftStartMin(S, shift)))
  return countFromRanges(ranges, hm, false)
}

function minToHM(min) {
  const v = ((Math.round(min) % 1440) + 1440) % 1440
  return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0')
}

// هل فيه إذن تأخير مسجل بتاريخ معين؟ (الكشف في جدول التصاريح)
export function hasLatePermit(permitsList, dk) {
  try { return (permitsList || []).some(p => p && p.date === dk && p.type === 'late') } catch { return false }
}
