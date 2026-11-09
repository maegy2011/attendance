// pages/ExtraNotes.jsx — تعديل 2 (v12.15.6): صفحة ملاحظات مستقلة — ملهاش دعوة بملاحظات السجلات
// تخزين مستقل att_extra_notes + تعديل وحذف وتخزين لحظي + تاريخ لكل ملاحظة
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getExtraNotes, saveExtraNotes } from '../utils/storage'

const todayKey = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}` }

export default function ExtraNotes() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState(() => getExtraNotes())
  const [ndate, setNdate] = useState(todayKey())
  const [ntext, setNtext] = useState('')
  const [editId, setEditId] = useState(null)
  const [editText, setEditText] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)

  const persist = (list) => { setNotes(list); saveExtraNotes(list) }
  const add = () => {
    const txt = ntext.trim()
    if (!txt) return
    const item = { id: `${Date.now()}`, date: ndate || todayKey(), text: txt }
    persist([...notes, item].sort((a, b) => String(b.date).localeCompare(String(a.date))))
    setNtext('')
  }
  const startEdit = (n) => { setEditId(n.id); setEditText(n.text); setConfirmDel(null) }
  const commitEdit = () => {
    const txt = editText.trim()
    if (!txt) return
    persist(notes.map(n => n.id === editId ? { ...n, text: txt } : n))
    setEditId(null); setEditText('')
  }
  const del = (id) => {
    if (confirmDel !== id) { setConfirmDel(id); return }
    persist(notes.filter(n => n.id !== id))
    setConfirmDel(null)
  }

  return (
    <div className="px-4 py-2 space-y-2">
      <div className="bg-gradient-to-br from-emerald-700 to-emerald-600 rounded-2xl p-3 text-white mt-4 flex items-center justify-between" style={{ minHeight: '52px' }}>
        <button onClick={() => navigate('/stats')} className="text-white text-lg font-bold px-2" title="رجوع للإحصائيات">➡️</button>
        <h1 className="font-extrabold" style={{ fontSize: '14px' }}>📝 الملاحظات</h1>
        <span className="text-xs font-bold">{notes.length} ملاحظة</span>
      </div>
      <div className="card w-full text-right">
        <div className="flex items-center gap-1.5">
          <input type="date" value={ndate} onChange={e => setNdate(e.target.value)} className="p-2 border-2 border-slate-200 rounded-xl font-bold text-xs shrink-0" dir="ltr" style={{ maxWidth: 140 }} />
          <input value={ntext} onChange={e => setNtext(e.target.value)} placeholder="اكتب ملاحظة..." className="flex-1 p-2 border-2 border-slate-200 rounded-xl font-bold text-sm" />
          <button onClick={add} className="btn btn-primary text-xs px-3 h-[2.5rem] shrink-0">➕</button>
        </div>
      </div>
      <div className="card w-full text-right">
        {notes.length === 0 ? (
          <p className="text-center text-xs text-slate-400">مفيش ملاحظات مسجلة</p>
        ) : (
          <div className="space-y-1.5">
            {notes.map(n => (
              <div key={n.id} className="border-b pb-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-600 text-xs shrink-0">{n.date}</span>
                  <span className="flex gap-1 shrink-0">
                    {editId === n.id ? (
                      <button onClick={commitEdit} className="text-xs px-2 py-1 rounded-lg border-2 border-green-500 bg-green-50 font-bold">✔</button>
                    ) : (
                      <button onClick={() => startEdit(n)} className="text-xs px-2 py-1 rounded-lg border-2 border-slate-200 font-bold">✏️</button>
                    )}
                    <button onClick={() => del(n.id)} className="text-xs px-2 py-1 rounded-lg border-2 border-slate-200 font-bold" style={confirmDel === n.id ? { background: '#dc2626', color: '#fff' } : {}}>{confirmDel === n.id ? 'تأكيد؟' : '🗑️'}</button>
                  </span>
                </div>
                {editId === n.id ? (
                  <input value={editText} onChange={e => setEditText(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit() }} autoFocus className="w-full mt-1 p-2 border-2 border-blue-300 rounded-xl text-sm font-bold" />
                ) : (
                  <p className="text-sm text-slate-700 text-right mt-0.5">{n.text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
