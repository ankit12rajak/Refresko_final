import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import './Login.css'

const LoginSelection = () => {
  const isStudentLoginDisabled = false
  const isAdminLoginDisabled = false

  const blockStudentLoginNavigation = (event) => {
    if (isStudentLoginDisabled) {
      event.preventDefault()
    }
  }

  const blockAdminLoginNavigation = (event) => {
    if (isAdminLoginDisabled) {
      event.preventDefault()
    }
  }

  return (
    <div className="auth-page">
      <div className="hex-grid-overlay" />

      <motion.div
        className="auth-container"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="auth-header">
          <motion.h1
            className="auth-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            LOGIN AS
          </motion.h1>

          <motion.p
            className="auth-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Choose your login type to continue
          </motion.p>
        </div>

        <motion.div
          className="auth-form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <Link
            to="/login/student"
            className="auth-btn"
            style={{
              display: 'block',
              textDecoration: 'none',
              marginBottom: '16px',
              opacity: isStudentLoginDisabled ? 0.6 : 1,
              pointerEvents: isStudentLoginDisabled ? 'none' : 'auto',
              cursor: isStudentLoginDisabled ? 'not-allowed' : 'pointer'
            }}
            onClick={blockStudentLoginNavigation}
            aria-disabled={isStudentLoginDisabled}
          >
            <span>{isStudentLoginDisabled ? 'STUDENT LOGIN DISABLED' : 'STUDENT LOGIN'}</span>
          </Link>

          <Link
            to="/login/admin"
            className="auth-btn"
            style={{
              display: 'block',
              textDecoration: 'none',
              opacity: isAdminLoginDisabled ? 0.6 : 1,
              pointerEvents: isAdminLoginDisabled ? 'none' : 'auto',
              cursor: isAdminLoginDisabled ? 'not-allowed' : 'pointer'
            }}
            onClick={blockAdminLoginNavigation}
            aria-disabled={isAdminLoginDisabled}
          >
            <span>{isAdminLoginDisabled ? 'ADMIN LOGIN DISABLED' : 'ADMIN LOGIN'}</span>
          </Link>

          <Link
            to="/login/staff"
            className="auth-btn"
            style={{
              display: 'block',
              textDecoration: 'none',
              marginTop: '16px'
            }}
          >
            <span>CR / VOLUNTEER LOGIN</span>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default LoginSelection
