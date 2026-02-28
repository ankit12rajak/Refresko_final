import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import ComingSoonPage from './pages/ComingSoonPage.jsx'
import Admin from './pages/Admin/Admin.jsx'
import SuperAdmin from './pages/SuperAdmin/SuperAdmin.jsx'
import ProfileSetup from './pages/ProfileSetup.jsx'
import SKFDashboard from './pages/SKFDashboard.jsx'
import PaymentGateway from './pages/PaymentGateway.jsx'
import StaffLogin from './pages/StaffLogin.jsx'
import StaffPortal from './pages/StaffPortal.jsx'

const APP_BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? String(__APP_BUILD_ID__) : 'dev'
const BUILD_STORAGE_KEY = 'refresko_app_build_id'
const RELOAD_GUARD_PREFIX = 'refresko_cache_refresh_done_'

const clearSiteCaches = async () => {
  if (typeof window === 'undefined') {
    return
  }

  if ('caches' in window) {
    try {
      const cacheKeys = await window.caches.keys()
      await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)))
    } catch (error) {
      console.warn('Cache storage clear failed:', error)
    }
  }

  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    } catch (error) {
      console.warn('Service worker unregister failed:', error)
    }
  }
}

const ensureLatestDeployment = async () => {
  if (typeof window === 'undefined') {
    return true
  }

  const previousBuildId = window.localStorage.getItem(BUILD_STORAGE_KEY)
  if (previousBuildId === APP_BUILD_ID) {
    return true
  }

  await clearSiteCaches()
  window.localStorage.setItem(BUILD_STORAGE_KEY, APP_BUILD_ID)

  const reloadGuardKey = `${RELOAD_GUARD_PREFIX}${APP_BUILD_ID}`
  if (!window.sessionStorage.getItem(reloadGuardKey)) {
    window.sessionStorage.setItem(reloadGuardKey, '1')
    window.location.reload()
    return false
  }

  return true
}

const renderApp = () => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/student" element={<Login />} />
          <Route path="/login/admin" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/super-admin" element={<SuperAdmin />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route path="/dashboard" element={<SKFDashboard />} />
          <Route path="/payment-gateway" element={<PaymentGateway />} />
          <Route path="/login/staff" element={<StaffLogin />} />
          <Route path="/staff-portal" element={<StaffPortal />} />
          <Route
            path="/events"
            element={
              <ComingSoonPage
                title="Events"
                subtitle="Next-level arenas, curated matchups, and battles engineered for maximum adrenaline."
                launchLine="MARCH 2026"
              />
            }
          />
          <Route
            path="/gallery"
            element={
              <ComingSoonPage
                title="Gallery"
                subtitle="A cinematic archive of Refresko moments, crafted for the boldest minds."
                launchLine="MARCH 2026"
              />
            }
          />
        </Routes>
      </BrowserRouter>
    </StrictMode>,
  )
}

const bootstrap = async () => {
  const shouldRender = await ensureLatestDeployment()
  if (!shouldRender) {
    return
  }
  renderApp()
}

bootstrap()
