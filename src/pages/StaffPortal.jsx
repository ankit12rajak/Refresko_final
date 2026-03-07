import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cpanelApi } from '../lib/cpanelApi'
import './StaffPortal.css'

const StaffPortal = () => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [transactions, setTransactions] = useState([])
  const [pendingList, setPendingList] = useState([])
  const [summary, setSummary] = useState(null)

  const [day, setDay] = useState('day1')
  const [studentCode, setStudentCode] = useState('')
  const [qrData, setQrData] = useState('')
  const [entryMessage, setEntryMessage] = useState('')
  const [searchText, setSearchText] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')

  const staffRole = (localStorage.getItem('staffRole') || '').toLowerCase()
  const staffName = localStorage.getItem('staffName') || localStorage.getItem('staffUsername') || 'Staff'
  const token = localStorage.getItem('staffToken') || ''

  const isVolunteer = staffRole === 'volunteer'
  const isCr = staffRole === 'cr'

  const loadData = async () => {
    if (!token) {
      navigate('/login/staff')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await cpanelApi.staffTransactions(token)
      setTransactions(Array.isArray(response?.transactions) ? response.transactions : [])
      setPendingList(Array.isArray(response?.pending_list) ? response.pending_list : [])
      setSummary(response?.summary || null)
    } catch (fetchError) {
      setError(fetchError?.message || 'Unable to load data')
      if (fetchError?.status === 401) {
        localStorage.removeItem('staffAuthenticated')
        localStorage.removeItem('staffToken')
        localStorage.removeItem('staffRole')
        localStorage.removeItem('staffName')
        localStorage.removeItem('staffUsername')
        navigate('/login/staff')
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    document.body.classList.add('system-cursor')

    const isAuthenticated = localStorage.getItem('staffAuthenticated')
    if (isAuthenticated !== 'true') {
      navigate('/login/staff')
      return
    }

    if (!isVolunteer && !isCr) {
      navigate('/login/staff')
      return
    }

    loadData()

    return () => {
      document.body.classList.remove('system-cursor')
    }
  }, [navigate])

  const paidTransactions = useMemo(
    () => transactions.filter((item) => ['pending', 'completed', 'declined'].includes(String(item?.status || '').toLowerCase())),
    [transactions]
  )

  const topAnalytics = useMemo(() => {
    const paidStudentCodes = new Set(
      paidTransactions
        .map((item) => String(item?.student_code || '').trim().toUpperCase())
        .filter(Boolean)
    )

    const pendingStudentCodes = new Set(
      pendingList
        .map((item) => String(item?.student_code || '').trim().toUpperCase())
        .filter(Boolean)
    )

    // Pending list and paid list should be disjoint, but guard against overlap.
    pendingStudentCodes.forEach((code) => {
      if (paidStudentCodes.has(code)) {
        pendingStudentCodes.delete(code)
      }
    })

    const paidStudents = summary?.paid_count ?? summary?.submitted_payments ?? paidStudentCodes.size
    const pendingStudents = summary?.pending_payment_students ?? pendingStudentCodes.size
    const totalStudents = paidStudents + pendingStudents

    return {
      totalStudents,
      paidStudents,
      pendingStudents,
    }
  }, [paidTransactions, pendingList, summary])

  const getPaymentLabelMeta = (statusValue) => {
    const normalized = String(statusValue || '').toLowerCase()
    if (normalized === 'approved' || normalized === 'completed') {
      return { label: 'Paid', className: 'status-chip status-success' }
    }
    if (normalized === 'pending') {
      return { label: 'Waiting for Approval', className: 'status-chip status-pending' }
    }
    if (normalized === 'declined' || normalized === 'rejected') {
      return { label: 'Not Paid', className: 'status-chip status-danger' }
    }
    return { label: 'Not Paid', className: 'status-chip status-danger' }
  }

  const filteredTransactions = useMemo(() => {
    const query = String(searchText || '').trim().toLowerCase()

    return transactions.filter((row) => {
      const paymentStatus = getPaymentLabelMeta(row.payment_approved || row.status)
      const statusMatches = paymentFilter === 'all'
        || (paymentFilter === 'paid' && paymentStatus.label === 'Paid')
        || (paymentFilter === 'waiting' && paymentStatus.label === 'Waiting for Approval')
        || (paymentFilter === 'not_paid' && paymentStatus.label === 'Not Paid')

      if (!statusMatches) return false

      const rowDepartment = String(row.department || '').trim()
      const rowYear = String(row.year || '').trim()
      const departmentMatches = departmentFilter === 'all' || rowDepartment === departmentFilter
      const yearMatches = yearFilter === 'all' || rowYear === yearFilter
      if (!departmentMatches || !yearMatches) return false

      if (query === '') return true

      const studentCodeText = String(row.student_code || '').toLowerCase()
      const studentNameText = String(row.student_name || '').toLowerCase()
      const phoneText = String(row.phone || '').toLowerCase()
      return studentCodeText.includes(query) || studentNameText.includes(query) || phoneText.includes(query)
    })
  }, [transactions, searchText, paymentFilter, departmentFilter, yearFilter])

  const filteredPendingList = useMemo(() => {
    const query = String(searchText || '').trim().toLowerCase()
    if (paymentFilter === 'paid' || paymentFilter === 'waiting') {
      return []
    }

    return pendingList.filter((row) => {
      const rowDepartment = String(row.department || '').trim()
      const rowYear = String(row.year || '').trim()
      const departmentMatches = departmentFilter === 'all' || rowDepartment === departmentFilter
      const yearMatches = yearFilter === 'all' || rowYear === yearFilter
      if (!departmentMatches || !yearMatches) return false

      if (query === '') return true
      const studentCodeText = String(row.student_code || '').toLowerCase()
      const studentNameText = String(row.name || '').toLowerCase()
      const phoneText = String(row.phone || '').toLowerCase()
      return studentCodeText.includes(query) || studentNameText.includes(query) || phoneText.includes(query)
    })
  }, [pendingList, searchText, paymentFilter, departmentFilter, yearFilter])

  const departmentOptions = useMemo(() => {
    const values = new Set()
    transactions.forEach((row) => {
      const value = String(row.department || '').trim()
      if (value) values.add(value)
    })
    pendingList.forEach((row) => {
      const value = String(row.department || '').trim()
      if (value) values.add(value)
    })
    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))]
  }, [transactions, pendingList])

  const yearOptions = useMemo(() => {
    const values = new Set()
    transactions.forEach((row) => {
      const value = String(row.year || '').trim()
      if (value) values.add(value)
    })
    pendingList.forEach((row) => {
      const value = String(row.year || '').trim()
      if (value) values.add(value)
    })
    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))]
  }, [transactions, pendingList])

  const toCsvCell = (value) => {
    const text = String(value ?? '')
    return `"${text.replace(/"/g, '""')}"`
  }

  const handleExportFilteredCsv = () => {
    const lines = []

    lines.push('Filtered Payment Records')
    const paymentHeaders = ['Student Code', 'Name', 'Mobile', 'Department', 'Year', 'Amount', 'Status']
    lines.push(paymentHeaders.map(toCsvCell).join(','))
    filteredTransactions.forEach((row) => {
      const paymentStatus = getPaymentLabelMeta(row.payment_approved || row.status)
      lines.push([
        row.student_code,
        row.student_name,
        row.phone || '-',
        row.department || '',
        row.year || '',
        row.amount ?? '',
        paymentStatus.label,
      ].map(toCsvCell).join(','))
    })

    lines.push('')
    lines.push('Filtered Pending Students')
    const pendingHeaders = ['Student Code', 'Name', 'Mobile', 'Department', 'Year', 'Status']
    lines.push(pendingHeaders.map(toCsvCell).join(','))
    filteredPendingList.forEach((row) => {
      lines.push([
        row.student_code,
        row.name,
        row.phone || '-',
        row.department || '',
        row.year || '',
        'Not Paid',
      ].map(toCsvCell).join(','))
    })

    const csvContent = lines.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `staff_portal_filtered_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleLogout = async () => {
    try {
      if (token) {
        await cpanelApi.staffLogout(token)
      }
    } catch {
      // ignore logout API failures
    } finally {
      localStorage.removeItem('staffAuthenticated')
      localStorage.removeItem('staffToken')
      localStorage.removeItem('staffRole')
      localStorage.removeItem('staffName')
      localStorage.removeItem('staffUsername')
      navigate('/login/staff')
    }
  }

  const handleMarkEntry = async (e) => {
    e.preventDefault()
    setEntryMessage('')

    try {
      const response = await cpanelApi.markGateEntry({
        token,
        studentCode,
        qrData,
        day
      })
      setEntryMessage(response?.message || 'Entry marked')
      setStudentCode('')
      setQrData('')
    } catch (entryError) {
      setEntryMessage(entryError?.message || 'Unable to mark entry')
    }
  }

  return (
    <div className="staff-page">
      <div className="hex-grid-overlay" />

      <div className="staff-shell">

        <div className="staff-header">
          <div>
            <h1>STAFF PORTAL</h1>
            <p>{staffName} · {staffRole.toUpperCase()}</p>
          </div>
          <div className="staff-actions">
            <button type="button" className="staff-btn" onClick={loadData}>Refresh</button>
            <button type="button" className="staff-btn staff-btn-danger" onClick={handleLogout}>Logout</button>
          </div>
        </div>

        {error ? <div className="staff-error">{error}</div> : null}

        {isLoading ? <div className="staff-card">Loading...</div> : (
          <>
            <div className="staff-grid">
              <div className="staff-card">
                <h3>Total Students</h3>
                <p className="staff-number">{topAnalytics.totalStudents}</p>
              </div>
              <div className="staff-card">
                <h3>Paid Students</h3>
                <p className="staff-number">{topAnalytics.paidStudents}</p>
              </div>
              <div className="staff-card">
                <h3>Pending Students</h3>
                <p className="staff-number">{topAnalytics.pendingStudents}</p>
              </div>
            </div>

            <div className="staff-card">
              <h2>Payment Labels</h2>
              <div className="staff-label-legend">
                <span className="status-chip status-success">Paid</span>
                <span className="status-chip status-pending">Waiting for Approval</span>
                <span className="status-chip status-danger">Not Paid</span>
              </div>
            </div>

            <div className="staff-card">
              <h2>Filters</h2>
              <div className="staff-filters">
                <label>
                  Search Student
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Student code, name, or mobile"
                  />
                </label>
                <label>
                  Department
                  <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                    <option value="all">All Departments</option>
                    {departmentOptions.filter((value) => value !== 'all').map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Year
                  <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                    <option value="all">All Years</option>
                    {yearOptions.filter((value) => value !== 'all').map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Payment Status
                  <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
                    <option value="all">All</option>
                    <option value="paid">Paid</option>
                    <option value="waiting">Waiting for Approval</option>
                    <option value="not_paid">Not Paid</option>
                  </select>
                </label>
                <div className="staff-filter-actions">
                  <button
                    type="button"
                    className="staff-btn staff-filter-clear"
                    onClick={() => {
                      setSearchText('')
                      setPaymentFilter('all')
                      setDepartmentFilter('all')
                      setYearFilter('all')
                    }}
                  >
                    Clear Filters
                  </button>
                  <button
                    type="button"
                    className="staff-btn"
                    onClick={handleExportFilteredCsv}
                  >
                    Export CSV
                  </button>
                </div>
              </div>
            </div>

            <div className="staff-card">
              <h2>Payment Records</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student Code</th>
                      <th>Name</th>
                      <th>Mobile</th>
                      {!isCr ? <th>Amount</th> : null}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={isCr ? 4 : 5} className="empty-row">No payment records found for current filters</td>
                      </tr>
                    ) : filteredTransactions.map((row) => {
                      const paymentStatus = getPaymentLabelMeta(row.payment_approved || row.status)
                      return (
                      <tr key={row.payment_id || `${row.student_code}-${row.transaction_id || row.created_at || ''}`}>
                        <td>{row.student_code}</td>
                        <td>{row.student_name}</td>
                        <td>{row.phone || '-'}</td>
                        {!isCr ? <td>₹{row.amount}</td> : null}
                        <td>
                          <span className={paymentStatus.className}>
                            {paymentStatus.label}
                          </span>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="staff-card">
              <h2>Pending List</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student Code</th>
                      <th>Name</th>
                      <th>Mobile</th>
                      <th>Department</th>
                      <th>Year</th>
                      <th>Payment Label</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPendingList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty-row">No pending students found for current filters</td>
                      </tr>
                    ) : filteredPendingList.map((row) => (
                      <tr key={`${row.student_code}-${row.name}`}>
                        <td>{row.student_code}</td>
                        <td>{row.name}</td>
                        <td>{row.phone || '-'}</td>
                        <td>{row.department}</td>
                        <td>{row.year}</td>
                        <td>
                          <span className="status-chip status-danger">Not Paid</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {isVolunteer ? (
              <div className="staff-card">
                <h2>Gate Entry (Volunteer Only)</h2>
                <p>Scan gate pass QR data or manually type student code. One entry allowed per day.</p>

                <form onSubmit={handleMarkEntry} className="gate-form">
                  <label>
                    Day
                    <select value={day} onChange={(e) => setDay(e.target.value)}>
                      <option value="day1">Day 1</option>
                      <option value="day2">Day 2</option>
                    </select>
                  </label>

                  <label>
                    Student Code (Manual)
                    <input
                      value={studentCode}
                      onChange={(e) => setStudentCode(e.target.value)}
                      placeholder="SKFGI\2024\BCA\0032"
                    />
                  </label>

                  <label>
                    QR Data (Scan Input)
                    <textarea
                      value={qrData}
                      onChange={(e) => setQrData(e.target.value)}
                      placeholder='Paste scanned QR text or JSON payload'
                      rows={4}
                    />
                  </label>

                  <button type="submit" className="staff-btn">Mark Entry</button>
                </form>

                {entryMessage ? <div className="staff-info">{entryMessage}</div> : null}
              </div>
            ) : null}

            <Link to="/" className="staff-home-link">← Back to Home</Link>
          </>
        )}
      </div>
    </div>
  )
}

export default StaffPortal
