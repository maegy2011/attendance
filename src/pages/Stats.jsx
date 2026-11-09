import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import NotesDialog from '../components/NotesDialog'
import { useAttendance } from '../contexts/AttendanceContext'
import { useSettings } from '../contexts/SettingsContext'
import { formatCurrency, formatHours, calculateMonthly, calculateDay, migrateDayType } from '../utils/calculations'
import { getDayNameAr, timestampToTime } from '../utils/calendar'
import { getAltDays, getLeavesV2, getPermitsV2 } from '../utils/storage'
import { getRawLateMin, getTardinessCount, hasLatePermit } from '../utils/tardiness'
import { getSpecialById } from '../utils/specials'

export default function Stats() {
  const { records, updateRecordFields, saveNotes } = useAttendance()
  const { settings, updateSettings } = useSettings()
  const location = useLocation()
  const navigate = useNavigate()
  // التعديل 19: الدخول من كارت الرئيسية يفتح لوحة التأخيرات مباشرة
  const [expanded, setExpanded] = useState(location.state?.open || null)
  // v12.5.1: زر ترتيب التأخيرات — الافتراضي الأحدث→الأقدم
  const [tardSortDesc, setTardSortDesc] = useState(true)
  const now = new Date()
  // تعديل ١ (دورة v12.6): شهر مستقل لكل لوحة — الافتراضي الحالي، اللي بعده يقف عند الحالي والقبله يعدي السنين
  const [mYear, setMYear] = useState(now.getFullYear())
  const [mMonth, setMMonth] = useState(now.getMonth())
  const [tYear, setTYear] = useState(now.getFullYear())
  const [tMonth, setTMonth] = useState(now.getMonth())
  // التعديل ١ نقطة 5: سنة الهيدر — تضبط الكل دفعة واحدة
  const [hYear, setHYear] = useState(now.getFullYear())
  const setAllYears = (y) => {
    setHYear(y); setMYear(y); setTYear(y)
    if (y === now.getFullYear()) {
      if (mMonth > now.getMonth()) setMMonth(now.getMonth())
      if (tMonth > now.getMonth()) setTMonth(now.getMonth())
    }
  }
  const isCurrentM = mYear === now.getFullYear() && mMonth === now.getMonth()
  const isCurrentT = tYear === now.getFullYear() && tMonth === now.getMonth()
  const goPrevM = () => { if (mMonth === 0) { setMMonth(11); setMYear(mYear - 1) } else setMMonth(mMonth - 1) }
  const goNextM = () => { if (isCurrentM) return; if (mMonth === 11) { setMMonth(0); setMYear(mYear + 1) } else setMMonth(mMonth + 1) }
  const goPrevT = () => { if (tMonth === 0) { setTMonth(11); setTYear(tYear - 1) } else setTMonth(tMonth - 1) }
  const goNextT = () => { if (isCurrentT) return; if (tMonth === 11) { setTMonth(0); setTYear(tYear + 1) } else setTMonth(tMonth + 1) }
  const startOfMonth = new Date(mYear, mMonth, 1)
  // تعديل 1 (2 نوفمبر 2026): اخر الشهر 11:59:59 بالليل مش 12 اول اليوم — عشان اخر يوم ميتفوتش
  const endOfMonth = new Date(mYear, mMonth + 1, 0, 23, 59, 59, 999)
  const monthly = calculateMonthly(records, settings, startOfMonth, endOfMonth)
  const startOfYear = new Date(mYear, 0, 1)
  // تعديل 1 (2 نوفمبر 2026): اخر السنة 11:59:59 بالليل — نفس علة اخر الشهر
  const endOfYear = new Date(mYear, 11, 31, 23, 59, 59, 999)
  const yearly = calculateMonthly(records, settings, startOfYear, endOfYear)
  const daysInMonth = new Date(mYear, mMonth + 1, 0).getDate()
  const tDaysInMonth = new Date(tYear, tMonth + 1, 0).getDate()
  const dateKeyOf = (y, m, d) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  // التعديل 19: نفس الحسبة الموحدة (utils/tardiness) — الرئيسية والإحصائيات واحد
  const permitsAll = getPermitsV2()
  const getTardiness = (dk) => getTardinessCount(records, settings, dk)
  const getRawLate = (dk) => getRawLateMin(records, settings, dk)
  const monthTardinessDays = []
  let monthTardinessTotal = 0
  for (let d = 1; d <= tDaysInMonth; d++) {
    const dk = dateKeyOf(tYear, tMonth, d)
    const cnt = getTardiness(dk)
    if (cnt > 0) monthTardinessDays.push({ dk, count: cnt })
    // تعديل 6 (v12.12): فوق 45 بقى عدد 3 عادي والحذف عند التصريح مركزي — فرع over45 اتشال
    monthTardinessTotal += cnt
  }
  monthTardinessDays.sort((a, b) => tardSortDesc ? b.dk.localeCompare(a.dk) : a.dk.localeCompare(b.dk))
  let yearTardinessTotal = 0
  for (let m = 0; m < 12; m++) {
    const dim = new Date(tYear, m + 1, 0).getDate()
    for (let d = 1; d <= dim; d++) yearTardinessTotal += getTardiness(dateKeyOf(tYear, m, d))
  }
  // القاعدة الجديدة (بأمر عمرو): حضور ظاهر + بصمة ناقصة (حضور أو انصراف) + يوم فات فقط — لا اليوم ولا المستقبل
  const todayKeyStr = dateKeyOf(now.getFullYear(), now.getMonth(), now.getDate())
  const ignoredList = []
  const weekendDays = (settings.weekendDays && settings.weekendDays.length === 2) ? settings.weekendDays : [5, 6]
  for (let d = 1; d <= daysInMonth; d++) {
    const dk = dateKeyOf(mYear, mMonth, d)
    if (dk >= todayKeyStr) continue
    const rec = records[dk]
    let dc = rec?.dayCalculation || ''
    if (!dc && rec?.dayType) { try { dc = migrateDayType(rec.dayType).dayCalculation } catch {} }
    const dow = new Date(dk).getDay()
    if (!dc && weekendDays.includes(dow)) dc = 'weekend_rest'
    const isPresent = !['regular_vacation', 'rest_day', 'weekend_rest', 'sick', 'unpaid', 'special'].includes(dc)
    if (isPresent && (!rec?.checkIn || !rec?.checkOut)) ignoredList.push(dk)
  }
  const goToDay = (dk) => {
    try {
      sessionStorage.setItem('hr_jump_ym', JSON.stringify({ year: +dk.slice(0, 4), month: +dk.slice(5, 7) - 1 }))
      sessionStorage.setItem('hr_jump_dk', dk)
    } catch {}
    navigate('/records')
  }
  const storedAlt = getAltDays()
  const altDays = storedAlt.length > 0 ? storedAlt.filter(a=>a.date.startsWith(String(mYear))).map(a=>({ dk: a.date, calc: { totalHours: 7, meetsAltMinimum: true }, raw: a })).sort((a,b)=>a.dk.localeCompare(b.dk)) : Object.entries(records).filter(([dk, r]) => r.dayType === 'alt_day' && dk.startsWith(String(mYear))).map(([dk, r]) => ({ dk, calc: calculateDay(r, settings) })).sort((a, b) => a.dk.localeCompare(b.dk))
  const toggle = (key) => setExpanded(expanded === key ? null : key)
  const [showOtTable, setShowOtTable] = useState(false)
  // تعديل 2-6 (دورة جديدة v12.15.4): جداول الغداء + تفكيك النقدي + ملاحظات + سنة مالية
  const [showLunch, setShowLunch] = useState(false)
  const [otBreak, setOtBreak] = useState(false)
  const [fiscalOpen, setFiscalOpen] = useState(false)
  const [showFiscalTable, setShowFiscalTable] = useState(false)
  // التعديل ١٣: تفكيك الإضافي — الغدا + النقدي + التاكسي (المكافأة بره الحسبة)
  const extrasTotal = monthly.totalLunch + monthly.totalOvertime + monthly.totalTaxi
  const lunchDays = monthly.days.filter(d => (d.lunchValue || 0) > 0)
  const taxiDays = monthly.days.filter(d => (d.taxiValue || 0) > 0)
  const bonusDays = monthly.days.filter(d => (d.bonusValue || 0) > 0)
  const wd = (settings.weekendDays && settings.weekendDays.length === 2) ? settings.weekendDays : [5, 6]
  const WD_NAMES = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
  const dayDow = (dk) => { try { return new Date(dk + 'T12:00:00').getDay() } catch { return new Date(dk).getDay() } }
  const isHolDay = (d) => (d.isOvertimeHoliday === true) || (d.dayType === 'overtime_holiday')
  const friDays = monthly.days.filter(d => { if (isHolDay(d)) return false; return dayDow(d.date) === wd[0] && (d.overtimeHours || 0) > 0 })
  const satDays = monthly.days.filter(d => { if (isHolDay(d)) return false; return dayDow(d.date) === wd[1] && (d.overtimeHours || 0) > 0 })
  const holDays = monthly.days.filter(d => isHolDay(d) && (d.overtimeHours || 0) > 0)
  const ordDays = monthly.days.filter(d => { if (isHolDay(d)) return false; const dw = dayDow(d.date); if (dw === wd[0] || dw === wd[1]) return false; return (d.overtimeHours || 0) > 0 })
  const sumH = (arr) => Math.round(arr.reduce((a, d) => a + (d.overtimeHours || 0), 0) * 100) / 100
  const spDays = monthly.days.filter(d => d.dayType === 'shiftX' && (d.overtimeHours || 0) > 0)
  const curFY = (() => { const n = new Date(); const y = n.getFullYear(); const m = n.getMonth(); return m >= 6 ? { from: `${y}-07-01`, to: `${y + 1}-06-30` } : { from: `${y - 1}-07-01`, to: `${y}-06-30` } })()
  const fiscal = settings.tardFiscal || curFY
  const fiscalDays = Object.keys(records || {}).filter(k => k >= fiscal.from && k <= fiscal.to).map(dk => ({ dk, count: getTardiness(dk) })).filter(x => x.count > 0).sort((a, b) => tardSortDesc ? b.dk.localeCompare(a.dk) : a.dk.localeCompare(b.dk))
  const fiscalTotal = fiscalDays.reduce((a, x) => a + x.count, 0)
  const extrasTable = (
    <table className="w-full text-xs mt-3 ctable">
      <thead><tr className="bg-slate-700 text-white text-xs"><th className="p-2">اليوم</th><th className="p-2">ساعات الإضافي</th><th className="p-2">المقابل النقدي</th><th className="p-2">المجموع</th></tr></thead>
      <tbody>{monthly.days.map((d, odi) => (
        <tr key={d.date} className={`border-t ct-${odi % 2 ? 'odd' : 'even'} ${odi % 2 ? 'bg-slate-100' : ''}`}><td className="p-1 text-center">{getDayNameAr(d.date)} {new Date(d.date).getDate()}</td><td className="p-1 text-center">{formatHours(d.overtimeHours)}</td><td className="p-1 text-center text-green-600">{formatCurrency(d.overtimeValue)}</td><td className="p-1 text-center font-bold">{formatCurrency(d.total)}</td></tr>
      ))}</tbody>
      <tfoot><tr className="border-t bg-slate-100 font-bold"><td className="p-1 text-center">المجموع</td><td className="p-1 text-center">{formatHours(monthly.totalOvertimeHours)}</td><td className="p-1 text-center">{formatCurrency(monthly.totalOvertime)}</td><td className="p-1 text-center"></td></tr></tfoot>
    </table>
  )
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  return (
    <div className="px-4 py-2 space-y-2 page-stats">
      {/* v12.9.53: نفس ارتفاع هيدر الإجازات (52px) */}
      <div className="bg-gradient-to-br from-emerald-700 to-emerald-600 rounded-2xl p-3 text-white mt-4 flex items-center justify-between hd-stats" style={{ minHeight: '52px' }}>
        <h1 className="font-extrabold" style={{ fontSize: '14px' }}>📊 الإحصائيات</h1>
        {/* التعديل ١ نقطة 5: خانة السنة — تضبط كل اللوحات دفعة واحدة (وكل لوحة تفضل مستقلة) */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl px-2 py-1 w-fit" onClick={e=>e.stopPropagation()}>
          <button onClick={()=>setAllYears(hYear-1)} className="text-slate-600 text-xs px-1 font-bold" title="السنة اللي قبلها">▶</button>
          <span className="text-xs font-bold text-slate-600">{hYear}</span>
          <button onClick={()=>setAllYears(hYear+1)} disabled={hYear>=now.getFullYear()} className={`text-xs px-1 font-bold ${hYear>=now.getFullYear() ? 'text-slate-300' : 'text-slate-600'}`} title="السنة اللي بعدها">◀</button>
        </div>
      </div>
      <div className="card w-full text-right">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-700">💰 إحصائيات الإضافي الشهري</h3>
              <button onClick={(e) => { e.stopPropagation(); navigate('/notes') }} className="text-lg px-2" title="الملاحظات">📝</button>
            </div>
            {/* تعديل ١ (دورة v12.6): نفس خانة هيدر السجلات ▶ قبله يمين / ◀ بعده شمال */}
            <div className="flex items-center gap-1 mt-1 bg-slate-100 rounded-xl px-2 py-1 w-fit">
              <button onClick={(e)=>{e.stopPropagation(); goPrevM()}} className="text-slate-600 text-sm px-1 font-bold" title="الشهر اللي قبله">▶</button>
              <span className="text-sm font-bold text-slate-600">{months[mMonth]} {mYear}</span>
              <button onClick={(e)=>{e.stopPropagation(); goNextM()}} disabled={isCurrentM} className={`text-sm px-1 font-bold ${isCurrentM ? 'text-slate-300' : 'text-slate-600'}`} title="الشهر اللي بعده">◀</button>
            </div>
          </div>
        </div>
        {/* التعديل ١٣: ملخص الإضافي — label + سهم + عدد الأيام + الرقم */}
        <div className="flex justify-between items-center mt-2">
          <button onClick={(e) => { e.stopPropagation(); toggle('extras') }} className="text-slate-500 text-sm font-bold">اجمالي الاضافي الشهري {expanded === 'extras' ? '▲' : '▼'}</button>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-sm">{monthly.totalDays} يوم</span>
            <span className="font-extrabold text-blue-700">{formatCurrency(extrasTotal)} {settings.currency}</span>
          </div>
        </div>
        {expanded === 'extras' && (
          <div className="mt-2 space-y-2 border-t pt-2" onClick={(e) => e.stopPropagation()}>
            {monthly.totalLunch > 0 && (
              <div>
              <div className="flex justify-between items-center text-sm"><button onClick={(e) => { e.stopPropagation(); setShowLunch(!showLunch) }} className="text-slate-500 font-bold">اجمالي بدل الغداء {showLunch ? '▲' : '▼'}</button><span className="font-bold">{(() => {
                // تعديل 1: تفكيك حسب القيمة مع اسم الخاصة — الإجمالي مجموع القيم الفعلية
                const byVal = {}
                lunchDays.forEach(dd => {
                  const v = dd.lunchValue || 0
                  const rec = (records || {})[dd.date] || {}
                  const nm = rec.shift === 'shiftX' ? (((getSpecialById(settings, rec.specialId) || {}).name) || 'خاصة') : null
                  const k = v + '|' + (nm || '')
                  if (!byVal[k]) byVal[k] = { v, n: 0, nm }
                  byVal[k].n++
                })
                return Object.values(byVal).map(g => `${g.n} × ${formatCurrency(g.v)}${g.nm ? ` (${g.nm})` : ''}`).join(' + ') + ` = ${formatCurrency(monthly.totalLunch)}`
              })()}</span></div>
              {showLunch && (
                <table className="w-full text-xs ctable mt-2">
                  <thead><tr className="bg-slate-700 text-white text-xs"><th className="p-2">اليوم المستحق</th><th className="p-2">القيمة</th></tr></thead>
                  <tbody>{lunchDays.map((dd, ldi) => (
                    <tr key={dd.date} className={`border-t ${ldi % 2 ? 'bg-slate-100' : ''}`}><td className="p-1 text-center">{getDayNameAr(dd.date)} {new Date(dd.date).getDate()} {months[mMonth]}</td><td className="p-1 text-center font-bold">{formatCurrency(dd.lunchValue || 0)}</td></tr>
                  ))}</tbody>
                </table>
              )}
              </div>
            )}
            {monthly.totalTaxi > 0 && (
              <div className="flex justify-between text-sm"><span className="text-slate-500">اجمالي بدل التاكسي</span><span className="font-bold">{taxiDays.length} × {formatCurrency(settings.taxiValue || 0)} = {formatCurrency(monthly.totalTaxi)}</span></div>
            )}
            <div>
              <div className="flex justify-between items-center text-sm">
                <button onClick={(e) => { e.stopPropagation(); setOtBreak(!otBreak) }} className="text-slate-500 font-bold">اجمالي المقابل النقدي {otBreak ? '▲' : '▼'}</button>
                <span className="font-bold">{formatHours(monthly.totalOvertimeHours)} × {formatCurrency(settings.hourlyRate || 0)} = {formatCurrency(monthly.totalOvertime)}</span>
              </div>
              {otBreak && (
                <div className="mt-2 space-y-1.5 border-t pt-2">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">أيام {WD_NAMES[wd[0]]}</span><span className="font-bold">{friDays.length} يوم = {formatHours(sumH(friDays))}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">أيام {WD_NAMES[wd[1]]}</span><span className="font-bold">{satDays.length} يوم = {formatHours(sumH(satDays))}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">أيام العطلات الرسمية</span><span className="font-bold">{holDays.length} يوم = {formatHours(sumH(holDays))}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">أيام إضافي أسبوعي</span><span className="font-bold">{ordDays.length} يوم = {formatHours(sumH(ordDays))}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">أيام ورديات خاصة</span><span className="font-bold">{spDays.length} يوم = {formatHours(sumH(spDays))}</span></div>
                  <div className="flex justify-between items-center text-sm"><span className="text-slate-500">سعر الساعة</span><span className="flex items-center gap-1"><input type="number" min="0" value={settings.hourlyRate || ''} onChange={e => { const v = parseFloat(e.target.value); updateSettings({ ...settings, hourlyRate: isNaN(v) ? 0 : v }) }} placeholder="0" className="w-20 p-1 border-2 border-slate-200 rounded-xl font-bold text-center text-xs" dir="ltr" onClick={e => e.stopPropagation()} /><span className="text-xs font-bold">{settings.currency}</span></span></div>
                  <div className="flex justify-between items-center text-sm"><span className="text-slate-500">تقريب الساعات</span><span className="flex gap-1">{[{ v: 'floor', label: 'تجاهل الكسور' }, { v: 'none', label: 'بدون تقريب' }].map(o => (<button key={o.v} onClick={(e) => { e.stopPropagation(); updateSettings({ ...settings, hourRounding: o.v }) }} className={`text-xs px-2 py-1 rounded-full border-2 font-bold ${(settings.hourRounding || 'floor') === o.v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}>{o.label}</button>))}</span></div>
                  <div className="flex justify-between items-center text-sm"><button onClick={(e) => { e.stopPropagation(); setShowOtTable(!showOtTable) }} className="text-slate-500 font-bold">التفاصيل {showOtTable ? '▲' : '▼'}</button></div>
                  {showOtTable && extrasTable}
                </div>
              )}
            </div>
          </div>
        )}
        {/* التعديل ١٣: سطر المكافأة — سهم يفرد المعادلة + جدول المستحقين */}
        {settings.bonusEnabled === true && (
          <div className="flex justify-between items-center mt-2">
            <button onClick={(e) => { e.stopPropagation(); toggle('bonus') }} className="text-slate-500 text-sm font-bold">اجمالي المكافأة {expanded === 'bonus' ? '▲' : '▼'}</button>
            <span className="font-extrabold text-amber-600">{formatCurrency(monthly.totalBonus)} {settings.currency}</span>
          </div>
        )}
        {settings.bonusEnabled === true && expanded === 'bonus' && (
          <div className="mt-2 space-y-2 border-t pt-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between text-sm"><span className="text-slate-500">عدد ايام المكافأة × القيمة</span><span className="font-bold">{bonusDays.length} × {formatCurrency(settings.bonusValue || 0)} = {formatCurrency(monthly.totalBonus)}</span></div>
            <div className="flex justify-between items-center text-sm"><span className="text-slate-500">قيمة المكافأة</span><span className="flex items-center gap-1"><input type="number" min="0" value={settings.bonusValue ?? ''} onChange={e => { const v = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0); updateSettings({ ...settings, bonusValue: v }) }} placeholder="0" className="w-20 p-1 border-2 border-slate-200 rounded-xl font-bold text-center text-xs" dir="ltr" onClick={e => e.stopPropagation()} /><span className="text-xs font-bold">{settings.currency}</span></span></div>
            <table className="w-full text-xs ctable">
              <thead><tr className="bg-slate-700 text-white text-xs"><th className="p-2">اليوم المستحق</th><th className="p-2">ساعات الحضور</th></tr></thead>
              <tbody>{bonusDays.length === 0 ? (
                <tr><td colSpan="2" className="p-2 text-center text-slate-400">لا توجد أيام مستحقة 🎉</td></tr>
              ) : bonusDays.map((d, bdi) => (
                <tr key={d.date} className={`border-t ${bdi % 2 ? 'bg-slate-100' : ''}`}><td className="p-1 text-center">{getDayNameAr(d.date)} {new Date(d.date).getDate()} {months[mMonth]}</td><td className="p-1 text-center font-bold">{formatHours(d.totalHours || 0)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      {/* كارت الأيام المتجاهلة — بمبي فاتح متدرج طول ما فيه متجاهلة */}
      <button onClick={() => toggle('ignored')} className="card w-full text-right transition-all" style={ignoredList.length > 0 ? { background: 'linear-gradient(to bottom right,#FCE4EC,#F8BBD0)' } : undefined}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-700">🚫 الأيام المتجاهلة</h3>
            <div className="text-xs text-slate-500 mt-1">حضور بلا بصمة — أيام فاتت</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-red-600">{ignoredList.length} يوم</span>
            <span className="text-slate-400">{expanded === 'ignored' ? '▲' : '▼'}</span>
          </div>
        </div>
        {expanded === 'ignored' && (
          <div className="mt-3 border-t pt-3" onClick={(e) => e.stopPropagation()}>
            {ignoredList.length === 0 ? (
              <div className="text-center text-slate-400 text-xs">مفيش أيام متجاهلة 🎉</div>
            ) : (
              <table className="w-full text-xs ctable">
                <thead><tr className="bg-slate-700 text-white text-xs"><th className="p-2">التاريخ</th><th className="p-2">انتقال إلى</th></tr></thead>
                <tbody>{ignoredList.map((dk) => (
                  <tr key={dk} className="border-t"><td className="p-1 text-center">{getDayNameAr(dk)} {new Date(dk).getDate()} {months[mMonth]}</td><td className="p-1 text-center"><button onClick={(e) => { e.stopPropagation(); goToDay(dk) }} className="text-lg" title="انتقال للسجلات">➡️</button></td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}
      </button>
      <button onClick={() => toggle('tardiness')} className="card w-full text-right hover:bg-slate-50 transition-all">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-700">📅 التأخيرات</h3>
            {/* تعديل ٣ (v12.6.6): رجوع خانة مدمجة + عددي الشهر/السنة في خانتين */}
            <div className="flex items-center gap-1 mt-1 bg-slate-100 rounded-xl px-2 py-1 w-fit">
              <button onClick={(e)=>{e.stopPropagation(); goPrevT()}} className="text-slate-600 text-sm px-1 font-bold" title="الشهر اللي قبله">▶</button>
              <span className="text-sm font-bold text-slate-600">{months[tMonth]} {tYear}</span>
              <button onClick={(e)=>{e.stopPropagation(); goNextT()}} disabled={isCurrentT} className={`text-sm px-1 font-bold ${isCurrentT ? 'text-slate-300' : 'text-slate-600'}`} title="الشهر اللي بعده">◀</button>
            </div>
          </div>
          <span className="text-slate-400">{expanded === 'tardiness' ? '▲' : '▼'}</span>
        </div>
        {/* تعديل ٥: لوحة عددي الشهر/السنة بعرض اللوحة */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-2 mt-2 flex items-center justify-between gap-1">
          <span className="bg-white rounded-xl border border-slate-200 px-2 py-1 text-red-500 text-sm font-bold">الشهر: {monthTardinessTotal} تأخير</span>
          <span className="bg-white rounded-xl border border-slate-200 px-2 py-1 text-amber-500 text-sm font-bold">السنة: {yearTardinessTotal} تأخير</span>
        </div>
        {(expanded === 'tardiness' || fiscalOpen) && (
          <div className="mt-4 space-y-2 border-t pt-3">
            {/* تعديل ٦: الأحدث فوق الجدول زي باقي الجداول */}
            <div className="flex items-center justify-end">
              <button onClick={(e)=>{e.stopPropagation(); setTardSortDesc(!tardSortDesc)}} className="sortfilter text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-full px-2 py-1.5">{tardSortDesc?'⬇️ الأحدث':'⬆️ الأقدم'}</button>
            </div>
            <div className="flex items-center gap-1 text-sm font-bold">
              <button onClick={(e) => { e.stopPropagation(); setFiscalOpen(!fiscalOpen) }} className="text-slate-500">من {fiscal.from} إلى {fiscal.to} {fiscalOpen ? '▲' : '▼'}</button>
              <span className="text-xs text-slate-400">({fiscalTotal} تأخير)</span>
            </div>
            {fiscalOpen && (
              <div className="space-y-1.5 border rounded-xl p-1.5 bg-slate-50" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-500 font-bold">من</span>
                  <input type="date" value={fiscal.from} onChange={e => updateSettings({ ...settings, tardFiscal: { ...fiscal, from: e.target.value } })} className="flex-1 p-1 border-2 border-slate-200 rounded-xl text-xs font-bold" dir="ltr" onClick={e => e.stopPropagation()} />
                  <span className="text-slate-500 font-bold">إلى</span>
                  <input type="date" value={fiscal.to} onChange={e => updateSettings({ ...settings, tardFiscal: { ...fiscal, to: e.target.value } })} className="flex-1 p-1 border-2 border-slate-200 rounded-xl text-xs font-bold" dir="ltr" onClick={e => e.stopPropagation()} />
                </div>
                <div className="flex justify-between items-center">
                  <button onClick={(e) => { e.stopPropagation(); setShowFiscalTable(!showFiscalTable) }} className="text-slate-500 text-xs font-bold">تأخيرات السنة المالية {showFiscalTable ? '▲' : '▼'}</button>
                  <span className="text-xs font-bold text-red-600">{fiscalDays.length} يوم</span>
                </div>
                {showFiscalTable && (
                  <table className="w-full text-xs ctable">
                    <thead><tr className="bg-slate-700 text-white text-xs"><th className="p-2">اليوم</th><th className="p-2">موعد الحضور</th><th className="p-2">عدد التأخيرات</th></tr></thead>
                    <tbody>{fiscalDays.length === 0 ? (
                      <tr><td colSpan="3" className="p-2 text-center text-slate-400">لا توجد تأخيرات 🎉</td></tr>
                    ) : fiscalDays.map((d, fdi) => (
                      <tr key={d.dk} className={`border-t ${fdi % 2 ? 'bg-slate-100' : ''}`}><td className="p-1 text-center">{getDayNameAr(d.dk)} {d.dk}</td><td className="p-1 text-center font-mono text-xs">{records[d.dk]?.checkIn ? timestampToTime(records[d.dk].checkIn) : '—'}</td><td className="p-1 text-center font-bold text-red-600">{d.count}</td></tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            )}
            <table className="w-full text-xs ctable">
              <thead><tr className="bg-slate-700 text-white text-xs"><th className="p-2">اليوم</th><th className="p-2">موعد الحضور</th><th className="p-2">عدد التأخيرات</th></tr></thead>
              <tbody>{monthTardinessDays.length === 0 ? (
                <tr><td colSpan="3" className="p-2 text-center text-slate-400">لا توجد تأخيرات هذا الشهر 🎉</td></tr>
              ) : monthTardinessDays.map((d,tdi) => (
                <tr key={d.dk} className={`border-t ct-${tdi%2?'odd':'even'}${d.over45?' tardy-zero-row':(tdi%2?' bg-slate-100':'')}`}><td className="p-1 text-center">{getDayNameAr(d.dk)} {d.dk}</td><td className="p-1 text-center font-mono text-xs">{records[d.dk]?.checkIn ? timestampToTime(records[d.dk].checkIn) : '—'}</td><td className="p-1 text-center font-bold text-red-600">{d.count}</td></tr>
              ))}</tbody>
            </table>
          </div>
      )}
      </button>
    </div>
  )
}
