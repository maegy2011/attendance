// v12.11.25 التعديل التالت: العطلات الثابتة اتمسحت نهائيًا — المستخدم هو اللي يحدد
// (عادي / عطلة رسمية) من تركيبة اليوم في السجلات. التاريخ مش بيفرض حاجة.
export function getHolidaysForYear(year) {
  return {}
}

export function isHoliday(date) {
  return null
}

export function getDayNameAr(date) {
  const d = new Date(date)
  return ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][d.getDay()]
}

export function getMonthNameAr(m) {
  return ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'][m]
}

export function formatDateAr(date) {
  const d = new Date(date)
  return `${d.getDate()} ${getMonthNameAr(d.getMonth())} ${d.getFullYear()}`
}

export function timestampToTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// تاريخ محلي (YYYY-MM-DD) من ISO timestamp — مش UTC
// مهم للوردية التانية: الانصراف بعد منتصف الليل بيسجل في اليوم التاني
export function timestampToDateKey(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function dateKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// تعديل 3 (2 نوفمبر 2026): معايرة التوقيع على جهاز البصمة — رقم واحد بالثواني (+/-)
// التخزين = المظبوط والحسبة متزودش حاجة — الترحيل يتطبق مرة واحدة ساعة التسجيل الجديد بس
// الثواني تطير: الحفظ ساعات ودقايق بس (قص لأسفل بعد الجمع)
function pad2(n) { return String(n).padStart(2, '0') }

export function formatOffsetLabel(offsetSec) {
  const s = Number(offsetSec) || 0
  if (!s) return ''
  const sign = s > 0 ? '+' : '-'
  const a = Math.abs(Math.trunc(s))
  return `${sign}${Math.floor(a / 60)}:${pad2(a % 60)}`
}

// جمع الترحيل على وقت HH:MM وترجيع HH:MM (الثواني تطير) — لفة لليوم التالي/اللي قبله مسموحة
function shiftHM(h, m, offsetSec) {
  const totalSec = (h * 60 + m) * 60 + (Number(offsetSec) || 0)
  const mins = ((Math.floor(totalSec / 60) % 1440) + 1440) % 1440
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`
}

export function calibratedTimeHM(timeStr, offsetSec) {
  if (!/^\d{1,2}:\d{2}$/.test(timeStr || '')) return timeStr
  const [h, m] = timeStr.split(':').map(Number)
  return shiftHM(h, m, offsetSec)
}

// الوقت المظبوط دلوقتي (ساعات ودقايق — الثواني طايرة) — للاقتراح الافتراضي في بوب اب التسجيل
// ملحوظة: الدقة هنا للدقيقة; كارت الاعدادات بيعرض الثواني الحية للمقارنة بس
function nowHM() {
  const n = new Date()
  return `${pad2(n.getHours())}:${pad2(n.getMinutes())}`
}

export function calibratedNowHM(offsetSec) {
  return calibratedTimeHM(nowHM(), offsetSec)
}
