// components/PeriodsCard.jsx — الكارت الكبير لمدد نظام العمل الدورية (تعديل 6 v12.12)
// سطر الاسم + سطر المدة من/إلى + سهمين تنقل + كارتين فرعيين (تعديل 1 دورة جديدة: الشرايح بقت عامة — اتشالت من هنا)
// اليوم اللي مش داخل في أي مدة يشتغل على الإعدادات الحالية (الافتراضي)
import { useState } from 'react'
import { getPeriods, findPeriodForDate, defaultPeriod, validatePeriods, addMinutes, toMin } from '../utils/periods'

const SHIFT_LABELS = { shift1: 'الأولى', shift2: 'التانية', shift3: 'التالتة' }
const inp = 'w-full p-2 border-2 border-slate-200 rounded-xl font-bold bg-white text-center text-sm'

function todayKey() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export default function PeriodsCard({ settings, onSavePeriods, showToast }) {
  const periods = getPeriods(settings)
  const sorted = [...periods].sort((a, b) => String(a.from || '').localeCompare(String(b.from || '')))
  // الفهرس: -1 = الافتراضي — وإلا فهرس في المصفوفة المرتبة
  const [sel, setSel] = useState(() => {
    const tk = todayKey()
    const cur = findPeriodForDate(settings, tk)
    if (!cur) return -1
    const i = sorted.findIndex(p => p.id === cur.id)
    return i
  })
  const [confirmDel, setConfirmDel] = useState(false)
  // تعديل 6: طي الكارت كله — تعديل 7: التسجيل من خانة الاسم بلا فورم
  const [cardOpen, setCardOpen] = useState(false)
  const [regName, setRegName] = useState('')
  // تعديل 4: طي محتوى المدة + طي شرايح كل وردية — مقفولين افتراضيا
  const [openP, setOpenP] = useState(false)

  const patchPeriod = (idx, patch) => {
    const id = sorted[idx] && sorted[idx].id
    if (!id) return
    const next = periods.map(p => p.id === id ? { ...p, ...patch } : p)
    onSavePeriods(next)
  }
  const errs = validatePeriods(periods)
  const cur = sel >= 0 ? sorted[sel] : null

  const goNav = (d) => {
    if (!sorted.length) return
    let n = sel + d
    if (n < 0) n = 0
    if (n >= sorted.length) n = sorted.length - 1
    setSel(n)
    setConfirmDel(false)
    setOpenP(false)
  }

  // تعديل 7: التسجيل من خانة الاسم — أول حرف ينشئ المدة ويفتح محتوياتها — المكرر يقفز للموجودة
  const createFromName = (name) => {
    const nm = (name || '').trim()
    if (!nm) return
    const ex = sorted.findIndex(p => (p.name || '') === nm)
    if (ex >= 0) { setSel(ex); setConfirmDel(false); setOpenP(true); setOpenS({ shift1: false, shift2: false, shift3: false }); setRegName(''); return }
    const tk = todayKey()
    const np = defaultPeriod(nm, tk, `${tk.slice(0, 4)}-12-31`, settings)
    const next = [...periods, np]
    onSavePeriods(next)
    const ns = [...next].sort((a, b) => String(a.from || '').localeCompare(String(b.from || '')))
    setSel(ns.findIndex(p => p.id === np.id))
    setOpenP(true)
    setRegName('')
    showToast && showToast('✅ اتسجلت المدة — اظبط التواريخ من وإلى')
  }

  const delPeriod = () => {
    if (!confirmDel) { setConfirmDel(true); return }
    const id = cur && cur.id
    onSavePeriods(periods.filter(p => p.id !== id))
    setSel(-1); setConfirmDel(false)
    showToast && showToast('🗑️ اتمسحت المدة')
  }

  const patchShift = (sh, key, val) => {
    if (!cur) return
    const old = (cur[sh] && cur[sh][key]) || ''
    const upd = { ...cur[sh], [key]: val }
    const patch = { [sh]: upd }
    // الترحيل التلقائي للشرايح مع بداية الوردية — تعديل 6 (الفرق يتحرك بنفس المقدار)
    if (key === 'start' && old && val && cur.tardiness && cur.tardiness[sh]) {
      const d = (toMin(val) ?? 0) - (toMin(old) ?? 0)
      if (d !== 0) {
        const shifted = cur.tardiness[sh].map((r, i) => {
          if (i === 3) return { ...r, from: addShift(r.from, d), to: '23:59' }
          return { ...r, from: addShift(r.from, d), to: addShift(r.to, d) }
        })
        patch.tardiness = { ...cur.tardiness, [sh]: shifted }
      }
    }
    patchPeriod(sel, patch)
  }
  const addShift = (hm, d) => {
    if (!hm) return hm
    const v = (toMin(hm) ?? 0) + d
    const c = Math.max(0, Math.min(1439, v))
    return String(Math.floor(c / 60)).padStart(2, '0') + ':' + String(c % 60).padStart(2, '0')
  }

  return (
    <div className="card" style={{ padding: '8px', background: 'radial-gradient(ellipse at center, #ffffff 45%, #fff7ed 100%)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="font-bold text-slate-700 text-sm">🏭 نظام العمل السنوي والمدد</h3>
        {/* تعديل 6: سهم طي الكارت كله — مغلق افتراضيا */}
        <button onClick={() => setCardOpen(!cardOpen)} className="px-2 py-1 rounded-lg border-2 border-slate-200 bg-white font-bold text-xs" title={cardOpen ? 'إخفاء الكارت' : 'إظهار الكارت'}>{cardOpen ? '▲' : '▼'}</button>
      </div>
      {cardOpen && (<>
      {/* سطر الاسم + الأسهم — تعديل 6 */}
      <div className="flex items-center justify-center gap-1 mb-1.5">
        <button onClick={() => goNav(-1)} disabled={!sorted.length || sel <= 0} className="px-2 py-1 rounded-lg border-2 border-slate-200 bg-white font-bold disabled:opacity-30" title="المدة اللي قبلها">‹</button>
        {cur ? (
          <input value={cur.name || ''} onChange={e => patchPeriod(sel, { name: e.target.value })} placeholder="اسم المدة" className={inp} style={{ maxWidth: 180 }} />
        ) : (
          <input value={regName} onChange={e => { const v = e.target.value; setRegName(v); if (v.trim()) createFromName(v) }} placeholder="اضغط للتسجيل" className={inp} style={{ maxWidth: 180 }} />
        )}
        <button onClick={() => goNav(1)} disabled={!sorted.length || sel >= sorted.length - 1} className="px-2 py-1 rounded-lg border-2 border-slate-200 bg-white font-bold disabled:opacity-30" title="المدة اللي بعدها">›</button>
      </div>
      {/* سطر المدة من/إلى — تعديل 6 */}
      <div className="flex items-center justify-center gap-1 mb-1.5 text-xs font-bold text-slate-600">
        <span>من</span>
        {cur ? (
          <input type="date" value={cur.from || ''} onChange={e => patchPeriod(sel, { from: e.target.value })} className={inp} style={{ maxWidth: 140 }} dir="ltr" />
        ) : (<span>—</span>)}
        <span>إلى</span>
        {cur ? (
          <input type="date" value={cur.to || ''} onChange={e => patchPeriod(sel, { to: e.target.value })} className={inp} style={{ maxWidth: 140 }} dir="ltr" />
        ) : (<span>دائم</span>)}
      </div>
      <div className="flex items-center justify-center gap-1 mb-1.5">
        {cur && (
          <button onClick={delPeriod} className="btn text-xs px-3 py-1.5" style={confirmDel ? { background: '#dc2626', color: '#fff' } : {}}>{confirmDel ? 'تأكيد المسح؟' : '🗑️ مسح المدة'}</button>
        )}
        {cur && (
          <button onClick={() => setOpenP(!openP)} className="btn text-xs px-3 py-1.5" title={openP ? 'إخفاء محتويات المدة' : 'إظهار محتويات المدة'}>{openP ? '▲' : '▼'}</button>
        )}
      </div>
      {errs.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-2 mb-1.5 text-xs font-bold text-red-700">
          {errs.map((e, i) => <div key={i}>⛔ {e}</div>)}
        </div>
      )}
      {cur && openP && (
        <div className="space-y-2 mt-1">
          {/* 1) مواعيد العمل الرسمية */}
          <div className="p-1.5 rounded-lg border-2 border-slate-200">
            <div className="font-bold text-xs mb-1">🕗 مواعيد العمل الرسمية</div>
            <div className="grid grid-cols-2 gap-1">
              <div className="input-group"><label className="text-xs">حضور</label><input type="time" value={cur.officialStart || '08:00'} onChange={e => patchPeriod(sel, { officialStart: e.target.value })} className="p-1.5 text-xs" /></div>
              <div className="input-group"><label className="text-xs">انصراف</label><input type="time" value={cur.officialEnd || '15:00'} onChange={e => patchPeriod(sel, { officialEnd: e.target.value })} className="p-1.5 text-xs" /></div>
            </div>
          </div>
          {/* 2) نظام العمل (الورديات) */}
          <div className="p-1.5 rounded-lg border-2 border-slate-200">
            <div className="font-bold text-xs mb-1">🏢 نظام العمل</div>
            <div className="flex gap-2 mb-1">
              {[['single', 'وردية واحدة'], ['double', 'ورديتين'], ['triple', '3 ورديات']].map(([v, l]) => (
                <label key={v} className="flex items-center gap-1 font-bold text-xs cursor-pointer">
                  <input type="radio" name={'ws-' + cur.id} checked={(cur.workSystemMode || 'single') === v} onChange={() => patchPeriod(sel, { workSystemMode: v })} className="w-3.5 h-3.5" />{l}
                </label>
              ))}
            </div>
            {['shift1', 'shift2', 'shift3'].map(sh => (
              <div key={sh} className="grid grid-cols-2 gap-1 mb-1">
                <div className="input-group"><label className="text-xs">وردية {SHIFT_LABELS[sh]} - حضور</label><input type="time" value={(cur[sh] && cur[sh].start) || ''} onChange={e => patchShift(sh, 'start', e.target.value)} className="p-1.5 text-xs" /></div>
                <div className="input-group"><label className="text-xs">انصراف</label><input type="time" value={(cur[sh] && cur[sh].end) || ''} onChange={e => patchShift(sh, 'end', e.target.value)} className="p-1.5 text-xs" /></div>
              </div>
            ))}
          </div>
        </div>
      )}
      </>)}
    </div>
  )
}
