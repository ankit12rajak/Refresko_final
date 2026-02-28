import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cpanelApi } from '../lib/cpanelApi'
import './Login.css'

const normalizePhone = (value) => value.replace(/\D/g, '')
const parseBoolish = (value) => {
  if (value === true || value === 1 || value === '1') return true
  const normalized = String(value ?? '').trim().toLowerCase()
  return ['true', 'yes', 'y', 'on'].includes(normalized)
}

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const isAdminLoginMode = location.pathname.endsWith('/admin') || new URLSearchParams(location.search).get('role') === 'admin'
  const isLoginDisabled = false
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    document.body.classList.add('system-cursor')

    const isAdminAuthenticated = localStorage.getItem('adminAuthenticated')
    const isAuthenticated = localStorage.getItem('isAuthenticated')
    const profileCompleted = localStorage.getItem('profileCompleted')

    if (isAdminLoginMode && isAdminAuthenticated === 'true') {
      navigate('/admin')
      return
    }

    if (!isAdminLoginMode && isAuthenticated && profileCompleted === 'true') {
      navigate('/dashboard')
      return
    }

    return () => {
      document.body.classList.remove('system-cursor')
    }
  }, [isAdminLoginMode, location.search, navigate])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    // Clear error when user starts typing
    if (error) {
      setError('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (isLoginDisabled) {
      setError('Login is temporarily disabled.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Save admin accounts before clearing (needed for fallback auth)
      const savedAdminAccounts = localStorage.getItem('adminAccounts')
      const savedPaymentConfig = localStorage.getItem('paymentGatewayConfig')
      
      // Clear all localStorage data for this site
      localStorage.clear()
      
      // Restore admin accounts and payment config if they existed
      if (savedAdminAccounts) {
        localStorage.setItem('adminAccounts', savedAdminAccounts)
      }
      if (savedPaymentConfig) {
        localStorage.setItem('paymentGatewayConfig', savedPaymentConfig)
      }

      // Keep a small delay for UI consistency
      await new Promise(resolve => setTimeout(resolve, 500))

      if (isAdminLoginMode && cpanelApi.isConfigured()) {
        try {
          const response = await cpanelApi.adminLogin({ email: formData.email, password: formData.password })

          if (response?.success && response?.admin) {
            localStorage.setItem('adminAuthenticated', 'true')
            localStorage.setItem('adminLoginEmail', response.admin.email)
            navigate('/admin')
            return
          }

          setError('Invalid credentials. Please try again.')
          setIsLoading(false)
          return
        } catch (apiError) {
          console.warn('cPanel admin login failed, trying localStorage:', apiError)
        }
      }

      let adminAccounts = []
      try {
        const savedAdmins = localStorage.getItem('adminAccounts')
        adminAccounts = savedAdmins ? JSON.parse(savedAdmins) : []
      } catch {
        adminAccounts = []
      }

      const matchingAdmin = adminAccounts.find(
        (admin) =>
          admin.email === formData.email.toLowerCase() &&
          admin.password === formData.password &&
          admin.status === 'active'
      )

      if (isAdminLoginMode && matchingAdmin) {
        localStorage.setItem('adminAuthenticated', 'true')
        localStorage.setItem('adminLoginEmail', matchingAdmin.email)
        navigate('/admin')
        return
      }

      if (isAdminLoginMode) {
        setError('Invalid credentials. Please try again.')
        setIsLoading(false)
        return
      }

      if (!cpanelApi.isConfigured()) {
        setError('Database connection failed. Please try again or contact support.')
        setIsLoading(false)
        return
      }

      try {
        const studentCode = formData.email.trim().toUpperCase()
        const enteredPhone = normalizePhone(formData.password)

        const response = await cpanelApi.getStudentByCode(studentCode)

        if (!response?.success || !response?.student) {
          setError('Student code not found. Please check and try again.')
          setIsLoading(false)
          return
        }

        const data = response.student
        const dbPhone = normalizePhone(data.phone || '')
        if (!enteredPhone || enteredPhone !== dbPhone) {
          setError('Invalid phone number. Please try again.')
          setIsLoading(false)
          return
        }

        const prefilledProfile = {
          name: data.name || '',
          studentId: data.student_code || '',
          email: data.email || '',
          phone: data.phone || '',
          department: data.department || '',
          year: data.year || '',
          payment_completion: parseBoolish(data.payment_completion),
          gate_pass_created: parseBoolish(data.gate_pass_created),
          payment_approved: data.payment_approved || 'pending',
          food_included: parseBoolish(data.food_included),
          food_preference: data.food_preference || null
        }

        // Set new authentication session (localStorage already cleared at login start)
        localStorage.setItem('isAuthenticated', 'true')
        localStorage.setItem('loginEmail', data.email || data.student_code)
        localStorage.setItem('loginStudentCode', data.student_code || studentCode)
        localStorage.setItem('prefilledProfile', JSON.stringify(prefilledProfile))

        if (parseBoolish(data.profile_completed)) {
          localStorage.setItem('studentProfile', JSON.stringify(prefilledProfile))
          localStorage.setItem('profileCompleted', 'true')
          navigate('/dashboard')
          return
        }

        localStorage.removeItem('profileCompleted')
        navigate('/profile-setup')
      } catch (err) {
        console.error('Student login verification failed:', err)
        
        // Provide specific error messages for different failure types
        if (err.message?.includes('timeout') || err.code === 'TIMEOUT') {
          setError('Connection timeout. Please check your internet connection and try again. If problem persists, try using a VPN.')
        } else if (err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
          setError('Network connection error. Please check your internet and try again.')
        } else if (err.message?.includes('CORS') || err.message?.includes('cross-origin')) {
          setError('Connection blocked. Please try again or contact support.')
        } else {
          setError('Unable to verify credentials. Please try again.')
        }
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('An unexpected error occurred. Please check your connection and try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="hex-grid-overlay" />
      
      <Link to="/" className="back-home">
        <span>← Back to Home</span>
      </Link>

      <motion.div
        className="auth-container"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="auth-header">
          <motion.div
            className="auth-icon"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="lock-icon">🔐</div>
          </motion.div>
          
          <motion.h1
            className="auth-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            {isAdminLoginMode ? 'ADMIN LOGIN' : 'SKF STUDENT LOGIN'}
          </motion.h1>
          
          <motion.p
            className="auth-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.7 }}
          >
            {isAdminLoginMode
              ? 'Sign in with admin credentials created by super admin'
              : 'Enter student code and phone number to continue'}
          </motion.p>
        </div>

        <motion.form
          className="auth-form"
          onSubmit={handleSubmit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.9 }}
        >
          {error && (
            <motion.div
              className="error-banner"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.div>
          )}

          {isAdminLoginMode ? null : (
            <div className="demo-credentials">
              <p className="demo-label">Student Login Format:</p>
              <p className="demo-info">Student Code: <span>BTECH\2022\CSE\0001</span></p>
              <p className="demo-info">Password: <span>Phone Number</span></p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">{isAdminLoginMode ? 'Admin Email' : 'Student Code'}</label>
            <input
              type={isAdminLoginMode ? 'email' : 'text'}
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={isAdminLoginMode ? 'admin@skf.in' : 'BTECH\\2022\\CSE\\0001'}
              required
              className="form-input"
              disabled={isLoading || isLoginDisabled}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{isAdminLoginMode ? 'Password' : 'Phone Number'}</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={isAdminLoginMode ? 'Enter your password' : 'Enter phone number'}
              required
              className="form-input"
              disabled={isLoading || isLoginDisabled}
            />
          </div>

          <div className="form-options">
            <label className="checkbox-label">
              <input type="checkbox" disabled={isLoading || isLoginDisabled} />
              <span>Remember me</span>
            </label>
            <a href="#" className="forgot-link">Forgot Password?</a>
          </div>

          <button type="submit" className="auth-btn" disabled={isLoading || isLoginDisabled}>
            <span>{isLoginDisabled ? 'LOGIN DISABLED' : isLoading ? 'LOGGING IN...' : 'LOGIN'}</span>
          </button>
        </motion.form>

        <motion.div
          className="auth-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.1 }}
        >
          {isAdminLoginMode ? (
            <Link to="/login" className="switch-link">
              ← Back to Login Choice
            </Link>
          ) : (
            <Link to="/login" className="switch-link">
              ← Back to Login Choice
            </Link>
          )}

          {isAdminLoginMode ? null : (
            <>
              <p className="auth-divider">
                <span>Not an SKF student?</span>
              </p>
              <Link to="/register" className="switch-link">
                Register for events as a participant →
              </Link>
            </>
          )}

          <Link to="/login/staff" className="switch-link">
            CR / Volunteer Login →
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default Login
