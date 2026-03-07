import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'qrcode'
import md5 from 'blueimp-md5'
import { House, Ticket, ReceiptText, LogOut, CreditCard, ShieldCheck } from 'lucide-react'
import { cpanelApi } from '../lib/cpanelApi'
import { getActivePaymentOption, loadPaymentConfig } from '../lib/paymentConfig'
import { loadPaymentConfigWithApi } from '../lib/paymentConfigApi'
import './SKFDashboard.css'

const parseBoolish = (value) => {
  if (value === true || value === 1 || value === '1') return true
  const normalized = String(value ?? '').trim().toLowerCase()
  return ['true', 'yes', 'y', 'on'].includes(normalized)
}

const normalizeApprovalState = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['approved', 'declined', 'pending'].includes(normalized)) return normalized
  return 'pending'
}

const getGravatarUrl = (email, size = 200) => {
  const normalizedEmail = String(email ?? '').trim().toLowerCase()
  if (!normalizedEmail) {
    return `https://www.gravatar.com/avatar/?s=${size}&d=mp&r=g`
  }

  const hash = md5(normalizedEmail)
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp&r=g`
}

// Default data structure
const defaultStudentData = {
  name: 'John Doe',
  studentId: 'BTECH\\2022\\CSE\\0001',
  email: 'john.doe@skf.edu',
  department: 'Computer Science',
  year: '3rd Year',
  phone: '+91 98765 43210',
  avatar: null,
  registeredEvents: ['Tech Quiz', 'Hackathon'],
  contributionStatus: 'Volunteer'
}

const SKFDashboard = () => {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('home')
  const [student, setStudent] = useState(defaultStudentData)
  const [latestPayment, setLatestPayment] = useState(null)
  const [showFoodModal, setShowFoodModal] = useState(false)
  const [foodPreference, setFoodPreference] = useState('')
  const [gatePassQrCodeUrl, setGatePassQrCodeUrl] = useState('')
  const [paymentConfig, setPaymentConfig] = useState(() => loadPaymentConfig())
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
  const [googleWalletLoading, setGoogleWalletLoading] = useState(false)
  const [googleWalletError, setGoogleWalletError] = useState('')
  const receiptCardRef = useRef(null)

  const activePaymentOption = useMemo(
    () => getActivePaymentOption(paymentConfig),
    [paymentConfig]
  )
  const configuredPaymentAmount = Number(activePaymentOption?.amount) || 500
  const isFoodIncluded = Boolean(activePaymentOption?.includeFood)
  const studentInitials = useMemo(
    () => String(student.name || '')
      .split(' ')
      .filter(Boolean)
      .map((namePart) => namePart[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SK',
    [student.name]
  )
  const studentGravatarUrl = useMemo(() => getGravatarUrl(student.email, 200), [student.email])

  // Fetch payment status from database (cross-device sync)
  const fetchPaymentStatusFromDatabase = async (studentCode) => {
    if (!studentCode) return null

    try {
      // Try cPanel API
      if (cpanelApi.isConfigured()) {
        try {
          const studentResponse = await cpanelApi.getStudentByCode(studentCode)
          if (studentResponse?.success && studentResponse?.student) {
            const data = studentResponse.student
            const paymentCompletion = parseBoolish(data.payment_completion)
            const gatePassCreated = parseBoolish(data.gate_pass_created)
            const paymentApproved = normalizeApprovalState(data.payment_approved)

            let status = 'pending'
            if (paymentApproved === 'approved') {
              status = 'completed'
            } else if (paymentApproved === 'declined') {
              status = 'declined'
            } else if (paymentCompletion) {
              status = 'processing'
            }

            return {
              status,
              payment_approved: paymentApproved,
              payment_completion: paymentCompletion,
              gate_pass_created: gatePassCreated,
              amount: Number(data.latest_payment_amount) || configuredPaymentAmount,
              utr_no: data.latest_payment_utr_no || '',
              transaction_id: data.latest_payment_transaction_id || '',
              date: data.latest_payment_date || ''
            }
          }
        } catch (apiError) {
          console.warn('Failed to fetch from database:', apiError)
        }
      }
    } catch (error) {
      console.error('Failed to fetch payment status from database:', error)
    }
    return null
  }

  const findLatestStudentPayment = async (profileData) => {
    const studentId = profileData?.studentId || ''
    const studentEmail = profileData?.email || localStorage.getItem('loginEmail') || ''

    // First, try to get status from database (cross-device sync)
    const dbPaymentStatus = await fetchPaymentStatusFromDatabase(studentId)

    try {
      const savedPayments = localStorage.getItem('paymentSubmissions')
      const allPayments = savedPayments ? JSON.parse(savedPayments) : []

      const studentPayments = Array.isArray(allPayments)
        ? allPayments.filter((payment) => {
            const paymentStudentCode = payment.studentCode || payment.studentId || ''
            const paymentEmail = payment.email || ''
            return paymentStudentCode === studentId || (studentEmail && paymentEmail === studentEmail)
          })
        : []

      if (!studentPayments.length && !dbPaymentStatus) {
        setLatestPayment(null)
        return
      }

      const latest = studentPayments.length > 0 ? [...studentPayments].sort((a, b) => {
        const timeA = new Date(a.date || 0).getTime()
        const timeB = new Date(b.date || 0).getTime()
        return timeB - timeA
      })[0] : null

      // Merge database status with localStorage data (database takes priority)
      const normalizedAmount = Number(latest?.amount || dbPaymentStatus?.amount)
      const nextAmount = normalizedAmount > 0 && normalizedAmount !== 500 ? normalizedAmount : configuredPaymentAmount
      
      const finalPaymentData = {
        ...(latest || {}),
        ...(dbPaymentStatus || {}),
        amount: nextAmount,
        status: dbPaymentStatus?.status || latest?.status || 'pending',
        payment_approved: normalizeApprovalState(dbPaymentStatus?.payment_approved || latest?.payment_approved || latest?.paymentApproved || 'pending'),
        paymentApproved: normalizeApprovalState(dbPaymentStatus?.payment_approved || latest?.paymentApproved || latest?.payment_approved || 'pending'),
        payment_completion: dbPaymentStatus?.payment_completion !== undefined
          ? parseBoolish(dbPaymentStatus.payment_completion)
          : parseBoolish(latest?.payment_completion),
        gate_pass_created: dbPaymentStatus?.gate_pass_created !== undefined
          ? parseBoolish(dbPaymentStatus.gate_pass_created)
          : parseBoolish(latest?.gate_pass_created)
      }

      if (!finalPaymentData.utrNo && finalPaymentData.utr_no) {
        finalPaymentData.utrNo = finalPaymentData.utr_no
      }
      if (!finalPaymentData.transactionId && finalPaymentData.transaction_id) {
        finalPaymentData.transactionId = finalPaymentData.transaction_id
      }

      setLatestPayment(finalPaymentData)

      // Update localStorage with database status for offline use
      if (dbPaymentStatus && latest && studentPayments.length > 0) {
        const updatedPayments = allPayments.map(payment => {
          const paymentStudentCode = payment.studentCode || payment.studentId || ''
          if (paymentStudentCode === studentId) {
            return {
              ...payment,
              status: dbPaymentStatus.status,
              payment_approved: dbPaymentStatus.payment_approved,
              paymentApproved: dbPaymentStatus.payment_approved,
              payment_completion: parseBoolish(dbPaymentStatus.payment_completion)
            }
          }
          return payment
        })
        localStorage.setItem('paymentSubmissions', JSON.stringify(updatedPayments))
      }
    } catch {
      // If localStorage fails but we have DB status, use that
      if (dbPaymentStatus) {
        setLatestPayment({
          ...dbPaymentStatus,
          amount: dbPaymentStatus.amount || configuredPaymentAmount,
          paymentApproved: dbPaymentStatus.payment_approved
        })
      } else {
        setLatestPayment(null)
      }
    }
  }

  useEffect(() => {
    document.body.classList.add('system-cursor')
    
    // Load payment config from database first (cross-device sync)
    const loadConfig = async () => {
      try {
        const config = await loadPaymentConfigWithApi()
        setPaymentConfig(config)
      } catch (error) {
        console.warn('Failed to load payment config from API, using localStorage:', error)
        setPaymentConfig(loadPaymentConfig())
      }
    }
    loadConfig()
    
    // Check authentication
    const isAuthenticated = localStorage.getItem('isAuthenticated')
    const profileCompleted = localStorage.getItem('profileCompleted')
    
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    
    if (profileCompleted !== 'true') {
      navigate('/profile-setup')
      return
    }

    const verifyProfileCompletionFromDatabase = async () => {
      if (!cpanelApi.isConfigured()) return

      const loginStudentCode = localStorage.getItem('loginStudentCode')
      const prefilledProfileRaw = localStorage.getItem('prefilledProfile')
      let fallbackStudentCode = ''

      if (prefilledProfileRaw) {
        try {
          const prefilled = JSON.parse(prefilledProfileRaw)
          fallbackStudentCode = String(prefilled?.studentId || '').trim().toUpperCase()
        } catch {
          fallbackStudentCode = ''
        }
      }

      const studentCode = String(loginStudentCode || fallbackStudentCode || '').trim().toUpperCase()
      if (!studentCode) return

      try {
        const response = await cpanelApi.getStudentByCode(studentCode)
        const dbCompleted = response?.success && response?.student?.profile_completed
          ? String(response.student.profile_completed) === '1' || response.student.profile_completed === true
          : false

        if (!dbCompleted) {
          localStorage.removeItem('profileCompleted')
          localStorage.removeItem('studentProfile')
          navigate('/profile-setup')
          return
        }

        localStorage.setItem('profileCompleted', 'true')
      } catch {
      }
    }

    verifyProfileCompletionFromDatabase()
    
    // Load student profile from localStorage
    const savedProfile = localStorage.getItem('studentProfile')
    if (savedProfile) {
      try {
        const profileData = JSON.parse(savedProfile)
        setStudent({
          ...defaultStudentData,
          name: profileData.name || defaultStudentData.name,
          studentId: profileData.studentId || defaultStudentData.studentId,
          email: profileData.email || defaultStudentData.email,
          department: profileData.department || defaultStudentData.department,
          year: profileData.year || defaultStudentData.year,
          phone: profileData.phone || defaultStudentData.phone
        })
        findLatestStudentPayment(profileData)
      } catch (error) {
        console.error('Error loading profile:', error)
      }
    }

    return () => {
      document.body.classList.remove('system-cursor')
    }
  }, [navigate])

  const isPaymentApproved = 
    normalizeApprovalState(latestPayment?.payment_approved || latestPayment?.paymentApproved) === 'approved'
  
  const isPaymentDeclined = 
    normalizeApprovalState(latestPayment?.payment_approved || latestPayment?.paymentApproved) === 'declined'

  const isPaymentCompleted =
    parseBoolish(latestPayment?.payment_completion)
  const isGatePassCreated = parseBoolish(latestPayment?.gate_pass_created)
  const payment = latestPayment
    ? {
        transactionId: latestPayment.transactionId || latestPayment.utrNo || 'N/A',
        utrNo: latestPayment.utrNo || latestPayment.utr_no || 'N/A',
        amount: `₹${Number(latestPayment.amount || configuredPaymentAmount)}`,
        paymentDate: latestPayment.date || new Date().toISOString(),
        paymentMethod: latestPayment.paymentMethod || 'UPI',
        status: isPaymentApproved
          ? 'Approved'
          : isPaymentDeclined
            ? 'Declined'
            : isPaymentCompleted
              ? 'Under Review'
              : 'Pending',
        description: 'Refresko 2026 - SKF Student Registration'
      }
    : null

  const handleDownloadReceiptJpg = async () => {
    if (!receiptCardRef.current || !payment) return

    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(receiptCardRef.current, {
        backgroundColor: '#0b0f18',
        scale: 2,
        useCORS: true,
      })

      const imageUrl = canvas.toDataURL('image/jpeg', 0.95)
      const safeStudentCode = String(student.studentId || 'student').replace(/[^A-Za-z0-9_-]/g, '_')
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = `receipt_${safeStudentCode}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Failed to download receipt JPG:', error)
    }
  }

  const gatePassPayload = useMemo(() => {
    const normalizedCode = String(student.studentId || '').trim().toUpperCase()
    const normalizedName = String(student.name || '').trim().toLowerCase()
    const normalizedPhone = String(student.phone || '').trim()
    const normalizedEmail = String(student.email || '').trim().toLowerCase()
    const normalizedDepartment = String(student.department || '').trim().toLowerCase()
    const normalizedYear = String(student.year || '').trim().toLowerCase()
    const normalizedPassCode = `SKF-PASS-${normalizedCode}-REFRESKO2026`

    const payload = {
      ver: '2',
      type: 'SKF_GATE_PASS',
      Student_Code_Hash: md5(normalizedCode),
      Details_Hash: {
        student_code: md5(normalizedCode),
        pass_code: md5(normalizedPassCode),
        name: md5(normalizedName),
        phone: md5(normalizedPhone),
        email: md5(normalizedEmail),
        department: md5(normalizedDepartment),
        year: md5(normalizedYear),
      },
      Generated_At: new Date().toISOString(),
    }

    return JSON.stringify(payload)
  }, [student])

  const gatePassPayloadHash = useMemo(
    () => md5(gatePassPayload),
    [gatePassPayload]
  )

  useEffect(() => {
    let isActive = true

    const generateGatePassQrCode = async () => {
      if (!isPaymentApproved || !isGatePassCreated) {
        setGatePassQrCodeUrl('')
        return
      }

      try {
        const dataUrl = await QRCode.toDataURL(gatePassPayload, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: 'H'
        })

        if (isActive) {
          setGatePassQrCodeUrl(dataUrl)
        }
      } catch (error) {
        console.error('Failed to generate gate pass QR code:', error)
        if (isActive) {
          setGatePassQrCodeUrl('')
        }
      }
    }

    generateGatePassQrCode()

    return () => {
      isActive = false
    }
  }, [gatePassPayload, isPaymentApproved, isGatePassCreated])

  useEffect(() => {
    setAvatarLoadFailed(false)
  }, [studentGravatarUrl])

  const handleLogout = () => {
    // Clear authentication data
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('profileCompleted')
    localStorage.removeItem('studentProfile')
    localStorage.removeItem('loginEmail')
    localStorage.removeItem('loginStudentCode')
    
    // Redirect to home
    navigate('/')
  }

  const handleAddToGoogleWallet = async () => {
    if (!isPaymentApproved || !isGatePassCreated) {
      setGoogleWalletError('Gate pass not available yet')
      return
    }

    setGoogleWalletLoading(true)
    setGoogleWalletError('')

    try {
      const response = await cpanelApi.generateGoogleWalletPass(student.studentId)
      
      if (response?.success && response?.save_url) {
        // Open Google Wallet save URL in a new window
        window.open(response.save_url, '_blank', 'width=600,height=800')
      } else {
        throw new Error(response?.error || 'Failed to generate Google Wallet pass')
      }
    } catch (error) {
      console.error('Google Wallet error:', error)
      setGoogleWalletError(error.message || 'Failed to add to Google Wallet. Please try again.')
    } finally {
      setGoogleWalletLoading(false)
    }
  }

  const handleMakePayment = () => {
    if (isPaymentCompleted) {
      return
    }

    if (isFoodIncluded) {
      setShowFoodModal(true)
      return
    }

    localStorage.setItem('foodPreference', 'null')
    navigate('/payment-gateway')
  }

  const handleProceedToPayment = () => {
    if (isPaymentCompleted) {
      return
    }

    if (foodPreference) {
      // Save food preference to localStorage
      localStorage.setItem('foodPreference', foodPreference)
      setShowFoodModal(false)
      // Navigate to payment gateway
      navigate('/payment-gateway')
    }
  }

  const handleFoodSelect = (preference) => {
    setFoodPreference(preference)
  }

  const generatePassCode = () => `SKF-PASS-${student.studentId}-REFRESKO2026`

  const containerVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.5, ease: 'easeOut' }
    },
    exit: { 
      opacity: 0, 
      x: -20,
      transition: { duration: 0.3 }
    }
  }

  return (
    <div className="dashboard-page">
      <div className="hex-grid-overlay" />

      <div className="dashboard-layout">
        {/* Sidebar Navigation */}
        <motion.aside 
          className="dashboard-sidebar"
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="sidebar-header">
            <div className="sidebar-logo">SKF</div>
            <span className="sidebar-title">DASHBOARD</span>
          </div>

          <nav className="sidebar-nav">
            <button 
              className={`nav-item ${activeSection === 'home' ? 'active' : ''}`}
              onClick={() => setActiveSection('home')}
            >
              <span className="nav-icon"><House size={18} strokeWidth={2} /></span>
              <span className="nav-label">Home</span>
            </button>
            <button 
              className={`nav-item ${activeSection === 'gatepass' ? 'active' : ''}`}
              onClick={() => setActiveSection('gatepass')}
            >
              <span className="nav-icon"><Ticket size={18} strokeWidth={2} /></span>
              <span className="nav-label">Gate Pass</span>
            </button>
            <button 
              className={`nav-item ${activeSection === 'receipt' ? 'active' : ''}`}
              onClick={() => setActiveSection('receipt')}
            >
              <span className="nav-icon"><ReceiptText size={18} strokeWidth={2} /></span>
              <span className="nav-label">Receipt</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <button className="logout-btn" onClick={handleLogout}>
              <span className="nav-icon"><LogOut size={18} strokeWidth={2} /></span>
              <span className="nav-label">Logout</span>
            </button>
          </div>
        </motion.aside>

        {/* Main Content Area */}
        <main className="dashboard-main">
          <Link to="/" className="back-home">
            <span>← Back to Home</span>
          </Link>

          <AnimatePresence mode="wait">
            {/* HOME SECTION */}
            {activeSection === 'home' && (
              <motion.div
                key="home"
                className="dashboard-section home-section"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="section-header">
                  <h1 className="section-title">Welcome Back!</h1>
                  <p className="section-subtitle">Manage your Refresko 2026 experience</p>
                </div>

                {/* Quick Stats Section */}
                <div className="quick-stats">
                  <motion.div 
                    className="stat-card payment-stat"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="stat-icon"><CreditCard size={26} strokeWidth={2} /></div>
                    <div className="stat-content">
                      <span className="stat-label">Payment Status</span>
                      <span className={`stat-value ${isPaymentApproved ? 'approved' : isPaymentDeclined ? 'declined' : 'pending'}`}>
                        {isPaymentApproved ? '✓ Approved' : isPaymentDeclined ? '✗ Declined' : '⏳ Pending'}
                      </span>
                    </div>
                  </motion.div>

                  <motion.div 
                    className="stat-card gate-stat"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="stat-icon"><Ticket size={26} strokeWidth={2} /></div>
                    <div className="stat-content">
                      <span className="stat-label">Gate Pass</span>
                      <span className={`stat-value ${isPaymentApproved ? 'ready' : 'unavailable'}`}>
                        {isPaymentApproved ? '✓ Ready' : '✕ Unavailable'}
                      </span>
                    </div>
                  </motion.div>

                  <motion.div 
                    className="stat-card session-stat"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="stat-icon"><ShieldCheck size={26} strokeWidth={2} /></div>
                    <div className="stat-content">
                      <span className="stat-label">Session</span>
                      <span className="stat-value">Active & Secure</span>
                    </div>
                  </motion.div>
                </div>

                {/* Student Details Card */}
                <div className="student-card">
                  <div className="card-header">
                    <h2>Student Profile</h2>
                    <span className="status-badge active">Active</span>
                  </div>
                  <div className="student-info">
                    <div className="student-avatar">
                      <div className="avatar-placeholder">
                        {!avatarLoadFailed ? (
                          <img
                            src={studentGravatarUrl}
                            alt={`${student.name || 'Student'} profile`}
                            className="avatar-image"
                            referrerPolicy="no-referrer"
                            onError={() => setAvatarLoadFailed(true)}
                          />
                        ) : (
                          studentInitials
                        )}
                      </div>
                    </div>
                    <div className="student-details">
                      <div className="detail-row">
                        <span className="detail-label">Name</span>
                        <span className="detail-value">{student.name}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Student ID</span>
                        <span className="detail-value">{student.studentId}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Email</span>
                        <span className="detail-value">{student.email}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Department</span>
                        <span className="detail-value">{student.department}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Year</span>
                        <span className="detail-value">{student.year}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Phone</span>
                        <span className="detail-value">{student.phone}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Cards */}
                <div className="action-cards">
                  {/* Contribute to Fest Card */}
                  <motion.div 
                    className="action-card contribute-card"
                    whileHover={{ scale: 1.02, y: -5 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="action-icon"><CreditCard size={24} strokeWidth={2} /></div>
                    <h3>Contribute to Fest</h3>
                    <p>
                      Complete your registration by making the fest payment.
                      {isFoodIncluded ? ' Select your food preference and proceed to payment.' : ' Food is not included for this amount and payment opens directly.'}
                    </p>
                    <div className="payment-highlight">
                      <div className="payment-amount">
                        <span className="amount-label">Registration Fee</span>
                        <span className="amount-value">₹{configuredPaymentAmount}</span>
                      </div>
                      <div className="payment-includes">
                        <span>✓ All Event Access</span>
                        <span>{isFoodIncluded ? '✓ Food & Refreshments' : '✕ Food Not Included'}</span>
                        <span>✓ Merchandise Voucher</span>
                      </div>
                    </div>
                    <button
                      className="action-btn"
                      onClick={handleMakePayment}
                      disabled={isPaymentCompleted}
                    >
                      <span>{isPaymentCompleted ? 'Payment Completed' : 'Make Payment'}</span>
                    </button>
                  </motion.div>

                  {/* Register for Events Card */}
                  {/* <motion.div 
                    className="action-card events-card"
                    whileHover={{ scale: 1.02, y: -5 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="action-icon">🎪</div>
                    <h3>Register for Events</h3>
                    <p>Explore and register for exciting events at Refresko 2026!</p>
                    
                    {student.registeredEvents.length > 0 && (
                      <div className="registered-events">
                        <span className="events-label">Your Registered Events:</span>
                        <div className="events-tags">
                          {student.registeredEvents.map((event, index) => (
                            <span key={index} className="event-tag">{event}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <button className="action-btn secondary">
                      <span>Browse All Events</span>
                    </button>
                  </motion.div> */}
                </div>

                {/* Gate Pass Preview Card - Shows only if payment is approved */}
                {isPaymentApproved && (
                  <motion.div 
                    className="gate-pass-preview-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                  >
                    <div className="preview-header">
                      <h2>Your Gate Pass is Ready! 🎫</h2>
                      <span className="preview-badge">ACTIVE</span>
                    </div>
                    
                    <div className="preview-content">
                      <div className="preview-qr-section">
                        <div className="preview-qr">
                          {gatePassQrCodeUrl ? (
                            <img
                              src={gatePassQrCodeUrl}
                              alt="Quick QR Code"
                              className="preview-qr-image"
                            />
                          ) : (
                            <div className="preview-qr-placeholder">
                              <span>Generating...</span>
                            </div>
                          )}
                        </div>
                        <p className="qr-hint">Tap to view full pass • hashed payload</p>
                      </div>

                      <div className="preview-info-section">
                        <div className="preview-info-row">
                          <span className="info-label">Pass Holder</span>
                          <span className="info-value">{student.name}</span>
                        </div>
                        <div className="preview-info-row">
                          <span className="info-label">Student ID</span>
                          <span className="info-value code">{student.studentId}</span>
                        </div>
                        <div className="preview-info-row">
                          <span className="info-label">Valid For</span>
                          <span className="info-value">March 27-28, 2026</span>
                        </div>
                        <div className="preview-info-row">
                          <span className="info-label">Status</span>
                          <span className="info-value status-active">✓ VALID</span>
                        </div>
                        <div className="preview-info-row">
                          <span className="info-label">QR Hash</span>
                          <span className="info-value code">{gatePassPayloadHash.slice(0, 12)}...</span>
                        </div>
                      </div>
                    </div>

                    <button 
                      className="preview-view-btn"
                      onClick={() => setActiveSection('gatepass')}
                    >
                      <span>View Full Gate Pass</span>
                      <span className="btn-arrow">→</span>
                    </button>
                  </motion.div>
                )}

              </motion.div>
            )}

            {/* GATE PASS SECTION */}
            {activeSection === 'gatepass' && (
              <motion.div
                key="gatepass"
                className="dashboard-section gatepass-section"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="section-header">
                  <h1 className="section-title">Gate Pass</h1>
                  <p className="section-subtitle">Your digital entry pass for Refresko 2026</p>
                </div>

                {isPaymentApproved ? (
                <div className="gatepass-card">
                  <div className="gatepass-header">
                    <div className="gatepass-logo">
                      <div className="logo-icons-row">
                        <img src="/college.png" alt="College Logo" className="brand-logo-img" />
                        <span className="logo-separator">|</span>
                        <img src="/refresko.png" alt="Refresko Logo" className="brand-logo-img" />
                      </div>
                      <div className="logo-title-row">
                        <span className="logo-text">REFRESKO</span>
                        <span className="logo-year">2026</span>
                      </div>
                    </div>
                    <span className="pass-type">SKF STUDENT PASS</span>
                    <div className="pass-meta-strip">
                      <span className="pass-meta-chip">ENTRY ACCESS</span>
                      <span className="pass-meta-chip">SECURE QR</span>
                    </div>
                  </div>

                  <div className="qr-container">
                    <div className="qr-code">
                      <div className="qr-placeholder">
                        {gatePassQrCodeUrl ? (
                          <img
                            src={gatePassQrCodeUrl}
                            alt="Gate pass QR code"
                            className="qr-image"
                          />
                        ) : (
                          <span className="qr-loading-text">Generating QR...</span>
                        )}
                      </div>
                      <div className="qr-glow"></div>
                    </div>
                    <p className="qr-instruction">Scan at entry gate for verification</p>
                  </div>

                  <div className="pass-details">
                    <div className="pass-detail-row">
                      <span className="pass-label">Pass Holder</span>
                      <span className="pass-value">{student.name}</span>
                    </div>
                    <div className="pass-detail-row">
                      <span className="pass-label">Student ID</span>
                      <span className="pass-value">{student.studentId}</span>
                    </div>
                    <div className="pass-detail-row">
                      <span className="pass-label">Pass Code</span>
                      <span className="pass-value code">{generatePassCode()}</span>
                    </div>
                    <div className="pass-detail-row">
                      <span className="pass-label">Valid For</span>
                      <span className="pass-value">All Days - March 27th & 28th, 2026</span>
                    </div>
                    <div className="pass-detail-row">
                      <span className="pass-label">QR Payload Hash</span>
                      <span className="pass-value code">{gatePassPayloadHash}</span>
                    </div>
                  </div>

                  <div className="pass-footer">
                    <span className="pass-status valid">✓ VALID PASS</span>
                    <span className="pass-security-chip">HASHED DETAILS</span>
                  </div>

                  {/* Google Wallet Button */}
                  <div className="google-wallet-section">
                    <button 
                      className="google-wallet-btn"
                      onClick={handleAddToGoogleWallet}
                      disabled={googleWalletLoading}
                    >
                      {googleWalletLoading ? (
                        <>
                          <span className="wallet-loading">⏳</span>
                          <span>Adding to Wallet...</span>
                        </>
                      ) : (
                        <>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="currentColor"/>
                          </svg>
                          <span>Add to Google Wallet</span>
                        </>
                      )}
                    </button>
                    {googleWalletError && (
                      <p className="google-wallet-error">{googleWalletError}</p>
                    )}
                    <p className="google-wallet-hint">Save your gate pass to your phone for quick access</p>
                  </div>
                </div>
                ) : (
                <div className="student-card">
                  <div className="card-header">
                    <h2>Gate Pass Not Available Yet</h2>
                    <span className="status-badge">Pending</span>
                  </div>
                  <p className="section-subtitle" style={{ marginBottom: '0' }}>
                    {isPaymentDeclined
                      ? 'Your payment was declined by admin. Please submit payment proof again.'
                      : 'Your payment is under admin review. Gate pass will appear here after approval.'}
                  </p>
                </div>
                )}

                <div className="pass-instructions">
                  <h3>Entry Instructions</h3>
                  <ul>
                    <li>Present this QR code at the main entrance</li>
                    <li>Keep your Student ID ready for verification</li>
                    <li>This pass grants access to all SKF student areas</li>
                    
                  </ul>
                </div>
              </motion.div>
            )}

            {/* RECEIPT SECTION */}
            {activeSection === 'receipt' && (
              <motion.div
                key="receipt"
                className="dashboard-section receipt-section"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="section-header">
                  <h1 className="section-title">Payment Receipt</h1>
                  <p className="section-subtitle">Your payment confirmation and details</p>
                </div>

                {isPaymentApproved && payment ? (
                <div className="receipt-card" ref={receiptCardRef}>
                  <div className="receipt-header">
                    <div className="receipt-logo">
                      <div className="logo-icons-row">
                        <img src="/college.png" alt="College Logo" className="brand-logo-img" />
                        <span className="logo-separator">|</span>
                        <img src="/refresko.png" alt="Refresko Logo" className="brand-logo-img" />
                      </div>
                      <div className="logo-title-row">
                        <span className="logo-text">REFRESKO</span>
                        <span className="logo-year">2026</span>
                      </div>
                    </div>
                    <div className="receipt-badge">
                      <span className={`payment-status ${isPaymentApproved ? 'paid' : 'pending'}`}>
                        ✓ {payment.status}
                      </span>
                    </div>
                  </div>

                  <div className="receipt-body">
                    <div className="receipt-title">
                      <h2>Payment Receipt</h2>
                      <div className="receipt-title-right">
                        <span className="receipt-number">#{payment.transactionId}</span>
                        <span className="receipt-meta-chip">UTR #{payment.utrNo || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="receipt-info">
                      <div className="info-group">
                        <span className="info-label">Paid By</span>
                        <span className="info-value">{student.name}</span>
                      </div>
                      <div className="info-group">
                        <span className="info-label">Student ID</span>
                        <span className="info-value">{student.studentId}</span>
                      </div>
                      <div className="info-group">
                        <span className="info-label">Email</span>
                        <span className="info-value">{student.email}</span>
                      </div>
                      <div className="info-group">
                        <span className="info-label">Payment Date</span>
                        <span className="info-value">{new Date(payment.paymentDate).toLocaleDateString('en-IN', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        })}</span>
                      </div>
                      <div className="info-group">
                        <span className="info-label">Payment Method</span>
                        <span className="info-value">{payment.paymentMethod}</span>
                      </div>
                      <div className="info-group info-group-utr">
                        <span className="info-label">UTR No</span>
                        <span className={`info-value info-value-utr ${(payment.utrNo || 'N/A') === 'N/A' ? 'is-empty' : ''}`}>
                          #{payment.utrNo || 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="receipt-breakdown">
                      <div className="breakdown-total">
                        <span>Total Amount</span>
                        <span className="total-amount">{payment.amount}</span>
                      </div>
                    </div>

                    <div className="receipt-description">
                      <span className="desc-label">Description</span>
                      <span className="desc-value">{payment.description}</span>
                    </div>
                  </div>

                  <div className="receipt-footer">
                    <div className="receipt-stamp">
                      <div className="stamp-inner">
                        <span>PAID</span>
                      </div>
                    </div>
                    <div className="receipt-actions">
                      <button className="receipt-btn receipt-btn-download" onClick={handleDownloadReceiptJpg}>
                        <span className="receipt-btn-icon">[JPG]</span>
                        <span>Download Receipt</span>
                      </button>
                    </div>
                  </div>

                  <div className="receipt-note">
                    <p>This is a computer-generated receipt and does not require a signature.</p>
                    <p>For any queries, contact: Ankit Rajak(CSE 3rd Year):7439498461</p>
                  </div>
                </div>
                ) : (
                <div className="student-card">
                  <div className="card-header">
                    <h2>Receipt Not Available Yet</h2>
                    <span className="status-badge">Pending</span>
                  </div>
                  <p className="section-subtitle" style={{ marginBottom: '0' }}>
                    {isPaymentDeclined
                      ? 'Your payment was declined by admin. Please complete payment again to generate receipt.'
                      : 'Your payment receipt will be generated here once admin approves your payment.'}
                  </p>
                </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Food Preference Modal */}
      <AnimatePresence>
        {showFoodModal && (
          <>
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFoodModal(false)}
            />
            <motion.div
              className="food-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="modal-header">
                <h2>Select Food Preference</h2>
                <button className="modal-close" onClick={() => setShowFoodModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <p className="modal-description">
                  Choose your preferred meal type for Refresko 2026
                </p>
                <div className="food-options">
                  <label 
                    className={`food-option ${foodPreference === 'VEG' ? 'selected' : ''}`}
                    onClick={() => handleFoodSelect('VEG')}
                  >
                    <div className="food-icon">🥗</div>
                    <div className="food-details">
                      <span className="food-type">Vegetarian</span>
                      <span className="food-desc">Pure veg meals</span>
                    </div>
                    <div className="food-radio">
                      <input
                        type="radio"
                        name="foodPreference"
                        value="VEG"
                        checked={foodPreference === 'VEG'}
                        onChange={() => handleFoodSelect('VEG')}
                      />
                    </div>
                  </label>
                  <label 
                    className={`food-option ${foodPreference === 'NON-VEG' ? 'selected' : ''}`}
                    onClick={() => handleFoodSelect('NON-VEG')}
                  >
                    <div className="food-icon">🍗</div>
                    <div className="food-details">
                      <span className="food-type">Non-Vegetarian</span>
                      <span className="food-desc">Includes meat options</span>
                    </div>
                    <div className="food-radio">
                      <input
                        type="radio"
                        name="foodPreference"
                        value="NON-VEG"
                        checked={foodPreference === 'NON-VEG'}
                        onChange={() => handleFoodSelect('NON-VEG')}
                      />
                    </div>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="modal-btn cancel" 
                  onClick={() => setShowFoodModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="modal-btn proceed"
                  onClick={handleProceedToPayment}
                  disabled={!foodPreference}
                >
                  Proceed to Payment
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default SKFDashboard
