import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomeNew from './pages/HomeNew'
import Records from './pages/Records'
import AltDays from './pages/AltDays'
import Stats from './pages/Stats'
import ExtraNotes from './pages/ExtraNotes'
import Settings from './pages/Settings'
import Vacations from './pages/Vacations'
import Permits from './pages/Permits'
import DayTypeDialog from './components/DayTypeDialog'
import NotificationManager from './components/NotificationManager'
import AutoBackup from './components/AutoBackup'
import Toast from './components/Toast'
import PinLock from './components/PinLock'
import DisclaimerGate from './components/DisclaimerGate'
import NoticesCenter from './components/NoticesCenter'
import NotifTap from './components/NotifTap'
import PopDrag from './components/PopDrag'
import KeyAvoid from './components/KeyAvoid'
import Splash from './components/Splash'
import { SettingsProvider } from './contexts/SettingsContext'
import { AttendanceProvider, useAttendance } from './contexts/AttendanceContext'
import { useState, useEffect } from 'react'
import { version as APP_VERSION } from '../package.json'

// v12.5.10: أول تشغيل — الافتتاحية تتأجل لبعد الإخلاء والصلاحيات (تسلسل إجباري)


function AppInner() {
  const [unlocked, setUnlocked] = useState(false)
  // التعديل ١٠: تنبيه الإصلاح الذاتي للرمز (مفعلة بلا رمز → اتطفت)
  let toastFn = null
  try { toastFn = useAttendance().showToast } catch {}
  useEffect(() => {
    try {
      if (localStorage.getItem('pin_healed') === '1') {
        localStorage.removeItem('pin_healed')
        setTimeout(() => { try { toastFn && toastFn('⚠️ الحماية كانت مفعلة بلا رمز — أطفأناها، فعّلها وعيّن رمزًا') } catch {} }, 2000)
      }
    } catch {}
  }, [])
  // v12.5.10: شاشة الافتتاح فوق كل حاجة (حتى الإخلاء) — ثانيتين — كل فتحة
  // أول تشغيل: مفيش افتتاحية لحد ما الإخلاء والصلاحيات يخلصوا (onboarding-done)
  const isOnboarded = () => {
    try { return localStorage.getItem('disclaimerAccepted') === 'true' && localStorage.getItem('onboardingVersion') === APP_VERSION } catch { return false }
  }
  const [gateDone, setGateDone] = useState(isOnboarded)
  // تعديل 2 (2 نوفمبر 2026): الظهور 2 ثانية والمدة الكلية 2.85 للعادي واول تثبيت زي بعض
  const [splash, setSplash] = useState(isOnboarded)
  useEffect(() => {
    if (gateDone) return
    const h = () => { setGateDone(true); setSplash(true) }
    window.addEventListener('onboarding-done', h)
    return () => window.removeEventListener('onboarding-done', h)
  }, [gateDone])
  return (
    <>
      {splash && <Splash onDone={() => setSplash(false)} fadeMs={1000} totalMs={1500} />}
      <DisclaimerGate />
      {!unlocked && <PinLock onUnlock={() => setUnlocked(true)} />}
      {unlocked && (
        <>
          <Toast />
          <DayTypeDialog />
          <NoticesCenter />
        </>
      )}
    </>
  )
}

// v12.9.50: الجديدة مثبتة — القديمة اتحذفت نهائيًا

export default function App() {
  return (
    <SettingsProvider>
      <AttendanceProvider>
        <NotificationManager />
        <AutoBackup />
        <HashRouter>
          <NotifTap />
          <PopDrag />
          <KeyAvoid />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomeNew />} />
              <Route path="/records" element={<Records />} />
              <Route path="/alt-days" element={<AltDays />} />
              <Route path="/vacations" element={<Vacations />} />
              <Route path="/permits" element={<Permits />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/notes" element={<ExtraNotes />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
          <AppInner />
        </HashRouter>
      </AttendanceProvider>
    </SettingsProvider>
  )
}