import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import './Navbar.css'

const Navbar = () => {
  const isLoginDisabled = false
  const [isScrolled, setIsScrolled] = useState(false)
  const [showLoginMenu, setShowLoginMenu] = useState(false)
  const logoRef = useRef(null)
  const loginMenuRef = useRef(null)
  const navLinks = [
    { label: 'HOME', href: '/#home' },
    { label: 'EVENTS', to: '/events' },
    { label: 'GALLERY', to: '/gallery' }
  ]

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (loginMenuRef.current && !loginMenuRef.current.contains(event.target)) {
        setShowLoginMenu(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  return (
    <motion.nav
      className={`navbar ${isScrolled ? 'scrolled' : ''}`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <div className="navbar-container">
        <div ref={logoRef} className="logo">
          <div className="logo-icons-row">
            <img src="/college.png" alt="College Logo" className="brand-logo-img" />
            <span className="logo-separator">|</span>
            <img src="/refresko.png" alt="Refresko Logo" className="brand-logo-img" />
          </div>
          <span className="logo-year">2026</span>
        </div>

        <div className="nav-links-glass-box">
          <ul className="nav-links">
            {navLinks.map((link, index) => (
              <motion.li
                key={link.label}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                {link.to ? (
                  <Link className="nav-link interactive" to={link.to}>
                    {link.label}
                    <span className="link-underline" />
                  </Link>
                ) : (
                  <a className="nav-link interactive" href={link.href}>
                    {link.label}
                    <span className="link-underline" />
                  </a>
                )}
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="nav-actions">
          <div className="login-menu-wrapper" ref={loginMenuRef}>
            <motion.button
              className="login-btn interactive"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (!isLoginDisabled) {
                  setShowLoginMenu((prev) => !prev)
                }
              }}
              type="button"
              disabled={isLoginDisabled}
            >
              {isLoginDisabled ? 'LOGIN DISABLED' : 'LOGIN'}
            </motion.button>

            <AnimatePresence>
              {!isLoginDisabled && showLoginMenu && (
                <motion.div
                  className="login-dropdown"
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link
                    to="/login/student"
                    className="login-dropdown-item interactive"
                    onClick={() => setShowLoginMenu(false)}
                  >
                    Student Login
                  </Link>
                  <Link
                    to="/login/admin"
                    className="login-dropdown-item interactive"
                    onClick={() => setShowLoginMenu(false)}
                  >
                    Admin Login
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.nav>
  )
}

export default Navbar
