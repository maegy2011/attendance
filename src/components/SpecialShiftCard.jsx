// components/SpecialShiftCard.jsx — تعديل 1 (دورة جديدة): قايمة الورديات الخاصة المتعددة بالأسماء
// سطر الاسم: سهمين + خانة نص + مسح — التنقل يحدث الكارت لحظيا — آخر كارت فارغ للتسجيل — المسح بتأكيد مزدوج
// سلوك الأرقام: مسح عادي + كتابة عادية + الخروج من الفاضي يرجع صفر بصمت من غير رسايل
import { useState, useEffect } from 'react'
import { getSpecials, newSpecial } from '../utils/specials'

const rowCls = 'flex items-center gap-1.5 font-bold text-xs mb-1 p-1 rounded-lg border border-slate-200 bg-white'
const boxCls = 'w-5 h-5 shrink-0'
const numCls = 'p-1.5 border-2 border-slate-200 rounded-xl font-bold bg-white text-center text-xs'
const unitCls = 'shrink-0 text-slate-600 text-xs font-bold text-center'
const inpCls = 'flex-1 p-1.5 border-2 border-slate-200 rounded-xl font-bold bg-white text-center text-sm'

// خانة رقم: مسودة محلية + حفظ الصح لحظيا + الخروج من الفاضي يرجع صفر بصمت
function NumField({ value, onCommit, disabled, float, step }) {
  const [draft, setDraft] = useState(null)
  useEffect(() => { setDraft(null) }, [value])
  const shown = draft !== null ? draft : String(value ?? '')
  return (
    <input
      type="number" min="0" step={step || 1} value={shown} disabled={disabled}
      onChange={e => {
        // تعديل 1: تطبيع الصفر الشمال لحظيا (010 ← 10) مع الحفاظ على كتابة الكسور (1. ← 1.5)
        const raw = e.target.value
        if (raw === '') { setDraft(''); return }
        if (float) {
          if (!/^\d*\.?\d*$/.test(raw)) return
          const norm = raw.replace(/^0+(?=\d)/, '') || '0'
          setDraft(norm)
          if (!/\.$/.test(norm)) { const v = parseFloat(norm); if (!isNaN(v) && v >= 0) onCommit(v) }
          return
        }
        if (!/^\d*$/.test(raw)) return
        const norm = raw.replace(/^0+(?=\d)/, '') || '0'
        setDraft(norm)
        const v = parseInt(norm)
        if (!isNaN(v)) onCommit(v)
      }}
      onBlur={() => { if (draft === '') onCommit(0); setDraft(null) }}
      className={numCls} style={{ maxWidth: 70, width: 70 }} dir="ltr"
      onClick={e => e.stopPropagation()}
    />
  )
}

const DEFAULT_BODY = { start: '08:00', end: '17:00', otFactor: 1, deductOn: true, deductHours: 7, lunchOn: true, lunchHours: 8, lunchValue: 0, bonusOn: false, bonusHours: 7, taxiOn: false, taxiHours: 7, graceMin: 0 }

export default function SpecialShiftCard({ settings, onSaveList, showToast }) {
  const list = getSpecials(settings)
  const [sel, setSel] = useState(0)
  const [confirmDel, setConfirmDel] = useState(false)
  // تعديل 2: طي الكارت كله — مغلق افتراضيا
  const [cardOpen, setCardOpen] = useState(false)
  const [justCreated, setJustCreated] = useState(null)
  const [nameDraft, setNameDraft] = useState(null)
  const cur = sel < list.length ? list[sel] : null

  useEffect(() => { setNameDraft(null); setConfirmDel(false) }, [sel, list.length])

  const patchCur = (obj) => {
    if (!cur) return
    onSaveList(list.map(x => x.id === cur.id ? { ...x, ...obj } : x))
  }

  const goNav = (d) => {
    let n = sel + d
    if (n < 0) n = 0
    if (n > list.length) n = list.length
    setSel(n)
  }

  // الاسم: لحظي + وحيد + مسح الجديد الفاضي — الفاضي على المحفوظة يرجع لاسمها
  const commitName = (v) => {
    const name = (v || '').trim()
    if (cur) {
      if (!name) return 'revert'
      if (list.some(x => x.id !== cur.id && (x.name || '') === name)) { showToast && showToast('⛔ الاسم مكرر'); return 'revert' }
      patchCur({ name })
      return 'ok'
    }
    if (!name) return 'empty'
    const np = { ...newSpecial(name, settings && settings.lunchValue), ...DEFAULT_BODY, lunchValue: Number(settings && settings.lunchValue) || 0, name }
    onSaveList([...list, np])
    setJustCreated(np.id)
    setSel(list.length)
    return 'ok'
  }

  const onNameBlur = () => {
    if (nameDraft === null) return
    const r = commitName(nameDraft)
    if (r === 'revert' || r === 'empty') {
      // الجديد الفاضي اللي لسه منشأ يتمسح — المحفوظة ترجع لاسمها
      if (!cur && justCreated) {
        onSaveList(getSpecials(settings).filter(x => x.id !== justCreated))
        setJustCreated(null)
      }
    } else if (r === 'ok') {
      setJustCreated(null)
    }
    setNameDraft(null)
  }

  const delCur = () => {
    if (!cur) return
    if (!confirmDel) { setConfirmDel(true); return }
    onSaveList(list.filter(x => x.id !== cur.id))
    setSel(0)
    setConfirmDel(false)
    showToast && showToast('🗑️ اتمسحت الوردية — أيامها تقع على الأولى تلقائيا')
  }

  const body = cur || { ...DEFAULT_BODY, lunchValue: Number(settings && settings.lunchValue) || 0 }
  const dis = !cur

  const numRow = (checked, onCheck, label, val, onVal, unit, extra) => (
    <label className={rowCls + ' cursor-pointer'} style={dis || (extra && extra.dim) ? { opacity: 0.4 } : {}}>
      <input type="checkbox" checked={!!checked} onChange={onCheck} className={boxCls} disabled={dis || (extra && (extra.lock || extra.checkLock))} />
      <span className="flex-1">{label}</span>
      <span onClick={e => e.stopPropagation()} className="contents">
        <NumField value={val} onCommit={onVal} disabled={dis || (extra && (extra.disOff ? !checked : extra.inputLock))} float={extra && extra.float} step={extra && extra.step} />
      </span>
      <span className={unitCls} style={{ minWidth: 40 }}>{unit}</span>
    </label>
  )

  return (
    <div className="p-1.5 rounded-lg border-2 border-purple-300 bg-purple-50">
      <div className="font-bold text-sm mb-1 text-center">⭐ الورديات الخاصة</div>
      {/* سطر الاسم: سهمين + خانة نص + مسح — تعديل 1 */}
      <div className="flex items-center justify-center gap-1 mb-1.5">
        <button onClick={() => goNav(-1)} disabled={sel <= 0} className="px-2 py-1 rounded-lg border-2 border-slate-200 bg-white font-bold disabled:opacity-30" title="اللي قبلها">‹</button>
        <input
          value={nameDraft !== null ? nameDraft : (cur ? (cur.name || '') : '')}
          onChange={e => {
            const v = e.target.value
            setNameDraft(v)
            const activeId = (cur && cur.id) || justCreated
            if (activeId) {
              const name = v.trim()
              const fresh = getSpecials(settings)
              if (name && !(fresh.some(x => x.id !== activeId && (x.name || '') === name))) {
                onSaveList(fresh.map(x => x.id === activeId ? { ...x, name: v } : x))
              }
            } else if (v.trim()) {
              const r = commitName(v)
              if (r === 'ok') setNameDraft(null)
            }
          }}
          onBlur={onNameBlur}
          placeholder={cur ? '' : 'اسم وردية جديدة...'}
          className={inpCls} style={{ maxWidth: 180 }}
        />
        <button onClick={() => goNav(1)} disabled={sel >= list.length} className="px-2 py-1 rounded-lg border-2 border-slate-200 bg-white font-bold disabled:opacity-30" title="اللي بعدها">›</button>
        <button onClick={() => setCardOpen(!cardOpen)} className="px-2 py-1 rounded-lg border-2 border-slate-200 bg-white font-bold text-xs" title={cardOpen ? 'إخفاء محتويات الوردية' : 'إظهار محتويات الوردية'}>{cardOpen ? '▲' : '▼'}</button>
      </div>
      {!list.length && !cur && (
        <p className="text-center text-xs text-slate-500 mb-1.5">مافيش ورديات خاصة مسجلة — اكتب اسم في الخانة عشان تسجل أول واحدة</p>
      )}
      {cardOpen && (<div style={dis ? { opacity: 0.55 } : {}}>
        <div className="grid grid-cols-2 gap-1 mb-1">
          <div className="input-group"><label className="text-xs">موعد الحضور</label><input type="time" value={body.start || '08:00'} disabled={dis} onChange={e => patchCur({ start: e.target.value })} className="p-1.5 text-xs" /></div>
          <div className="input-group"><label className="text-xs">موعد الانصراف</label><input type="time" value={body.end || '17:00'} disabled={dis} onChange={e => patchCur({ end: e.target.value })} className="p-1.5 text-xs" /></div>
        </div>
        {/* سطر الفاكتور أساسي بلا مربع */}
        <div className={rowCls}>
          <span className={boxCls} />
          <span className="flex-1">احتساب نسبة ساعات الإضافي</span>
          <span onClick={e => e.stopPropagation()} className="contents">
            <NumField value={body.otFactor ?? 1} onCommit={v => patchCur({ otFactor: v })} disabled={dis} float step={0.25} />
          </span>
          <span className={unitCls} style={{ minWidth: 40 }}>×</span>
        </div>
        {numRow(body.deductOn, e => patchCur({ deductOn: e.target.checked }), 'خصم ساعات عمل رسمية', body.deductHours ?? 7, v => patchCur({ deductHours: v }), 'ساعات', { disOff: true })}
        {/* سطر التأخير تحت ساعات العمل — تعديل 3: بلا مربع (مسافة للمحاذاة) + مربوط بمربع الخصم */}
        <div className={rowCls} style={(dis || !body.deductOn) ? { opacity: 0.4 } : {}}>
          <span className={boxCls} />
          <span className="flex-1">⏰ التأخير بعد موعد الوردية بـ</span>
          <span onClick={e => e.stopPropagation()} className="contents">
            <NumField value={body.graceMin ?? 0} onCommit={v => patchCur({ graceMin: v })} disabled={dis || !body.deductOn} />
          </span>
          <span className={unitCls} style={{ minWidth: 40 }}>دقيقة</span>
        </div>
        {!body.deductOn && cur && (
          <p className="text-xs text-slate-500 text-center">بند التأخير يتفعل مع مربع الخصم (شرايح التانية)</p>
        )}
        {numRow(body.lunchOn, e => patchCur({ lunchOn: e.target.checked }), '🍽️ بدل فطار أو غداء أو عشاء بعد قضاء', body.lunchHours ?? 8, v => patchCur({ lunchHours: v }), 'ساعات', {})}
        {/* قيمة البدل الخاص — صف فرعي بنفس الأعمدة */}
        <div className={rowCls} style={dis || !body.lunchOn ? { opacity: 0.4 } : {}}>
          <span className={boxCls} />
          <span className="flex-1">قيمة البدل الخاص</span>
          <span onClick={e => e.stopPropagation()} className="contents">
            <NumField value={body.lunchValue ?? 0} onCommit={v => patchCur({ lunchValue: v })} disabled={dis || !body.lunchOn} />
          </span>
          <span className={unitCls} style={{ minWidth: 40 }}>ج</span>
        </div>
        {numRow(body.bonusOn, e => patchCur({ bonusOn: e.target.checked }), '🎁 مكافأة بعد قضاء', body.bonusHours ?? 7, v => patchCur({ bonusHours: v }), 'ساعات', {})}
        {numRow(body.taxiOn, e => patchCur({ taxiOn: e.target.checked }), '🚕 بدل تاكسي بعد قضاء', body.taxiHours ?? 7, v => patchCur({ taxiHours: v }), 'ساعات', {})}
      </div>)}
      {cur && cardOpen && (
        <div className="flex items-center justify-center gap-1 mt-1.5">
          <button onClick={delCur} className="px-2 py-1 rounded-lg border-2 border-slate-200 bg-white font-bold text-xs" style={confirmDel ? { background: '#dc2626', color: '#fff' } : {}} title="مسح الوردية">{confirmDel ? 'تأكيد مسح الوردية؟' : '🗑️ مسح الوردية'}</button>
        </div>
      )}
    </div>
  )
}
