import { useState, useEffect } from 'react'

// التعديل 26: قايمة منسدلة مخصوصة بدل قايمة النظام — منقولة من Records.jsx بالنص (مصدر واحد للسجلات والرئيسية)
// تعديل 1: دعم drill-in — الضغط على قيمة معينة يبدل محتوى نفس القايمة لقايمة فرعية مع زر رجوع
// drill = { matchValue, options, value, onPick, backLabel }
export default function CardSelect({ btnClass, options, value, onPick, disabled, dropKey, openKey, setOpenKey, drill }) {
  const [pos, setPos] = useState(null)
  const [drilled, setDrilled] = useState(false)
  const open = openKey === dropKey
  useEffect(() => { if (!open) setDrilled(false) }, [open])
  const shown = (drilled && drill && drill.options) ? drill.options : (options || [])
  const curVal = drilled ? (drill && drill.value) : value
  const cur = shown.find(o => o.value === curVal)
  const allLabels = [...(options || []), ...((drill && drill.options) || [])]
  const toggle = (e) => {
    if (disabled) return
    if (open) { setOpenKey(null); return }
    try {
      const r = e.currentTarget.getBoundingClientRect()
      const isCell = (btnClass || '').includes('claw-pick')
      const rowH = isCell ? 34 : 37
      const estH = Math.min(shown.length * rowH + 8, 248)
      let top = r.bottom + 4
      if (top + estH > window.innerHeight - 8) top = Math.max(8, r.top - estH - 4)
      // تعديل 1: عرض القايمة على قد المحتوى (أطول اسم في المستويين) بنفس خط الجدول — بحد أقصى الشاشة
      const fitW = Math.min(280, Math.max(120, ...allLabels.map(o => String(o.label || '').length * 9 + 44)))
      if (isCell) { const w = Math.min(280, Math.max(fitW, 150)); setPos({ top, left: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)), width: w }) }
      else { const w = Math.min(280, Math.max(r.width, 170, fitW)); setPos({ top, left: Math.max(8, r.right - w), width: w }) }
    } catch { setPos(null) }
    setOpenKey(dropKey)
  }
  return (<>
    <button disabled={disabled} onClick={toggle} title={cur ? cur.label : ''} className={btnClass + ' w-full flex items-center justify-center gap-1 px-2 py-1.5' + (disabled ? ' opacity-50' : '')}>
      <span className="truncate">{cur ? cur.label : '—'}</span><span className="text-[10px] shrink-0">▼</span>
    </button>
    {open && pos && (<>
      <div className="fixed inset-0 z-[60]" onClick={() => setOpenKey(null)} />
      <div className="fixed z-[61] bg-white rounded-xl border-2 border-slate-300 shadow-xl overflow-hidden" style={pos.left != null ? { top: pos.top, left: pos.left, width: pos.width } : { top: pos.top, right: pos.right, width: pos.width, maxWidth: 280 }}>
        <div className="max-h-[240px] overflow-y-auto py-1">
          {drilled && drill && (
            <button key="__back" onClick={() => setDrilled(false)} className="w-full text-right px-3 py-2 text-xs font-bold text-slate-500">
              {drill.backLabel || '‹ رجوع'}
            </button>
          )}
          {shown.map(o => (
            <button key={o.value} onClick={() => {
              if (!drilled && drill && o.value === drill.matchValue) { try { onPick(o.value) } catch {} setDrilled(true); return }
              setOpenKey(null)
              if (drilled && drill && drill.onPick) { try { drill.onPick(o.value) } catch {} }
              else { try { onPick(o.value) } catch {} }
            }} className={`w-full text-right px-3 py-2 text-xs font-bold ${o.value === curVal ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}>
              {o.value === curVal ? '✓ ' : ''}{o.label}
            </button>
          ))}
        </div>
      </div>
    </>)}
  </>)
}
