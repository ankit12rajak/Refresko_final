import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { cpanelApi } from '../../lib/cpanelApi'
import CustomCursor from '../../components/CustomCursor/CustomCursor'
import EventManagement from '../../components/SuperAdmin/EventManagement'
import PaymentAmountManagement from '../../components/SuperAdmin/PaymentAmountManagement'
import PaymentManagement from '../../components/Admin/PaymentManagement'
import Analytics from '../../components/Admin/Analytics'
import StudentManagement from '../../components/SuperAdmin/StudentManagement'
import AdminLoginManagement from '../../components/SuperAdmin/AdminLoginManagement'
import StaffAccountManagement from '../../components/SuperAdmin/StaffAccountManagement'
import './SuperAdmin.css'

const SuperAdmin = () => {
  const isLoginDisabled = false
  const [activeTab, setActiveTab] = useState('events')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loggedInUser, setLoggedInUser] = useState('')
  const navigate = useNavigate()

  // Check if already authenticated on mount
  useEffect(() => {
    const savedAuth = sessionStorage.getItem('superAdminAuth')
    const savedUser = sessionStorage.getItem('superAdminUsername')
    if (savedAuth === 'true' && savedUser) {
      setIsAuthenticated(true)
      setLoggedInUser(savedUser)
    }
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()

    if (isLoginDisabled) {
      setError('Login is temporarily disabled.')
      return
    }

    setError('')
    setLoading(true)

    try {
      if (!cpanelApi.isConfigured()) {
        setError('Super admin API is not configured.')
        setLoading(false)
        return
      }

      const response = await cpanelApi.superAdminLogin({ username: username.trim(), password })
      if (response?.success && response?.admin) {
        const displayIdentity = response.admin.username || response.admin.email || username.trim()
        setIsAuthenticated(true)
        setLoggedInUser(displayIdentity)
        sessionStorage.setItem('superAdminAuth', 'true')
        sessionStorage.setItem('superAdminUsername', displayIdentity)
        setError('')
        setLoading(false)
        return
      }

      setError('Invalid username or password')
      setLoading(false)
    } catch (err) {
      console.error('Login error:', err)
      setError(err?.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setLoggedInUser('')
    sessionStorage.removeItem('superAdminAuth')
    sessionStorage.removeItem('superAdminUsername')
    navigate('/')
  }

  // Render login page if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="super-admin-login-page">
        {/* No custom cursor on login page for better input interaction */}
        <div className="login-background">
          <div className="circuit-pattern" />
          <div className="data-stream" />
        </div>

        <motion.div
          className="login-container"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="login-header">
            <motion.div
              className="login-logo"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="lock-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h1>SUPER ADMIN</h1>
              <div className="login-subtitle">
                <span className="text-glitch" data-text="SECURE ACCESS">SECURE ACCESS</span>
              </div>
            </motion.div>
          </div>

          <motion.form
            className="login-form"
            onSubmit={handleLogin}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="form-group">
              <label htmlFor="username">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                USERNAME
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoComplete="username"
                className="login-input"
                disabled={isLoginDisabled || loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                PASSWORD
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                className="login-input"
                disabled={isLoginDisabled || loading}
              />
            </div>

            {error && (
              <motion.div
                className="error-message"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              className="login-button interactive"
              disabled={loading || isLoginDisabled}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isLoginDisabled ? (
                <>
                  LOGIN DISABLED
                </>
              ) : loading ? (
                <>
                  <span className="loading-spinner"></span>
                  AUTHENTICATING...
                </>
              ) : (
                <>
                  ACCESS DASHBOARD
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </motion.button>
          </motion.form>

          <motion.div
            className="login-footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <Link to="/" className="back-home-link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
              Back to Home
            </Link>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="super-admin-dashboard">
      <CustomCursor />
      <div className="hex-grid-overlay" />
      
      {/* Header */}
      <header className="super-admin-header">
        <div className="super-admin-header-content">
          <div className="super-admin-logo">
            <Link to="/">
              <span className="logo-main">REFRESKO</span>
              <span className="logo-year">2026</span>
            </Link>
          </div>
          
          <div className="super-admin-title">
            <h1>SUPER ADMIN DASHBOARD</h1>
            <p>Supreme Knowledge Foundation - Master Control{loggedInUser && ` • Welcome, ${loggedInUser}`}</p>
          </div>

          <button className="logout-btn interactive" onClick={handleLogout}>
            <span>LOGOUT</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="super-admin-nav">
        <div className="super-admin-nav-container">
          <motion.button
            className={`nav-tab interactive ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>EVENT MANAGEMENT</span>
          </motion.button>

          <motion.button
            className={`nav-tab interactive ${activeTab === 'amounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('amounts')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <span>PAYMENT AMOUNTS</span>
          </motion.button>

          <motion.button
            className={`nav-tab interactive ${activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveTab('payments')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            <span>PAYMENTS & RECEIPTS</span>
          </motion.button>

          <motion.button
            className={`nav-tab interactive ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="20" x2="12" y2="10"/>
              <line x1="18" y1="20" x2="18" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="16"/>
            </svg>
            <span>ANALYTICS</span>
          </motion.button>

          <motion.button
            className={`nav-tab interactive ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>STUDENT ACCOUNTS</span>
          </motion.button>

          <motion.button
            className={`nav-tab interactive ${activeTab === 'admin-logins' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin-logins')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>ADMIN LOGIN CONTROL</span>
          </motion.button>

          <motion.button
            className={`nav-tab interactive ${activeTab === 'staff-accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff-accounts')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>STAFF ACCOUNT CONTROL</span>
          </motion.button>


        </div>
      </nav>

      {/* Content */}
      <main className="super-admin-content">
        <AnimatePresence mode="wait">
          {activeTab === 'events' && (
            <motion.div
              key="events"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <EventManagement />
            </motion.div>
          )}

          {activeTab === 'amounts' && (
            <motion.div
              key="amounts"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <PaymentAmountManagement />
            </motion.div>
          )}

          {activeTab === 'payments' && (
            <motion.div
              key="payments"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <PaymentManagement />
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <Analytics />
            </motion.div>
          )}

          {activeTab === 'students' && (
            <motion.div
              key="students"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <StudentManagement />
            </motion.div>
          )}

          {activeTab === 'admin-logins' && (
            <motion.div
              key="admin-logins"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <AdminLoginManagement />
            </motion.div>
          )}

          {activeTab === 'staff-accounts' && (
            <motion.div
              key="staff-accounts"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <StaffAccountManagement superAdminUsername={loggedInUser} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

export default SuperAdmin
