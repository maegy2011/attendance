// utils/specials.js — تعديل 1 (دورة جديدة): الورديات الخاصة المتعددة بالأسماء
// القايمة: settings.specialShifts [{id, name, ...config}] — السجل يشاور بـ rec.specialId — الغايب يقع على الأولى
import { defaultSpecialShift } from './periods'

export function getSpecials(settings) {
  const a = settings && settings.specialShifts
  return Array.isArray(a) ? a.filter(x => x && typeof x === 'object') : []
}

export function getSpecialById(settings, id) {
  const l = getSpecials(settings)
  return l.find(x => x.id === id) || l[0] || null
}

export function getSpecialForRecord(settings, rec) {
  if (rec && rec.specialId) {
    const f = getSpecials(settings).find(x => x.id === rec.specialId)
    if (f) return f
  }
  return getSpecials(settings)[0] || null
}

export function getSpecialName(settings, rec, fallback) {
  const s = rec ? getSpecialForRecord(settings, rec) : getSpecials(settings)[0]
  return (s && s.name) || fallback || 'وردية خاصة'
}

// عنصر جديد بإعدادات افتراضية — قيمة الوجبة تبدأ من العامة ثم تستقل
export function newSpecial(name, lunchValue) {
  return {
    id: 'sp' + Date.now() + Math.floor(Math.random() * 1000),
    name: name || '',
    ...defaultSpecialShift(),
    lunchValue: Number(lunchValue) || 0,
  }
}
