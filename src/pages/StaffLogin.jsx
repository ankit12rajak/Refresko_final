import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cpanelApi } from '../lib/cpanelApi'
import './Login.css'

const StaffLogin = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await cpanelApi.staffLogin({ username, password })
      if (!response?.success || !response?.staff || !response?.token) {
        setError('Unable to login. Please try again.')
        setIsLoading(false)
        return
      }

      localStorage.setItem('staffAuthenticated', 'true')
      localStorage.setItem('staffToken', response.token)
      localStorage.setItem('staffRole', response.staff.role)
      localStorage.setItem('staffName', response.staff.name)
      localStorage.setItem('staffUsername', response.staff.username)

      navigate('/staff-portal')
    } catch (loginError) {
      setError(loginError?.message || 'Invalid credentials')
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
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="auth-header">
          <h1 className="auth-title">CR / VOLUNTEER LOGIN</h1>
          <p className="auth-subtitle">Limited access: payment status and gate entry tools only</p>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          {error ? <div className="error-banner">{error}</div> : null}

          <div className="form-group">
            <label htmlFor="staff-username">Username</label>
            <input
              id="staff-username"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="staff-password">Password</label>
            <input
              id="staff-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          <button type="submit" className="auth-btn" disabled={isLoading}>
            <span>{isLoading ? 'LOGGING IN...' : 'LOGIN'}</span>
          </button>
        </form>

        <div className="auth-footer">
          <p className="demo-info">Staff accounts are created by Super Admin only.</p>

          <Link to="/login" className="switch-link">← Back to Student/Admin Login</Link>
        </div>
      </motion.div>
    </div>
  )
}

export default StaffLogin
