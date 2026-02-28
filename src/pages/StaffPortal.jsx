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
  }, [navigate])

  const paidTransactions = useMemo(
    () => transactions.filter((item) => ['pending', 'completed', 'declined'].includes(String(item?.status || '').toLowerCase())),
    [transactions]
  )

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

      <div className="staff-header">
        <div>
          <h1>STAFF PORTAL</h1>
          <p>{staffName} · {staffRole.toUpperCase()}</p>
        </div>
        <div className="staff-actions">
          <button type="button" onClick={loadData}>Refresh</button>
          <button type="button" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {error ? <div className="staff-error">{error}</div> : null}

      {isLoading ? <div className="staff-card">Loading...</div> : (
        <>
          <div className="staff-grid">
            <div className="staff-card">
              <h3>Paid / Submitted</h3>
              <p className="staff-number">{summary?.submitted_payments ?? paidTransactions.length}</p>
            </div>
            <div className="staff-card">
              <h3>Pending Payment</h3>
              <p className="staff-number">{summary?.pending_payment_students ?? pendingList.length}</p>
            </div>
            <div className="staff-card">
              <h3>Pending List</h3>
              <p className="staff-number">{pendingList.length}</p>
            </div>
          </div>

          <div className="staff-card">
            <h2>Transaction Details</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student Code</th>
                    <th>Name</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>UTR</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((row) => (
                    <tr key={row.payment_id || `${row.student_code}-${row.utr_no}`}>
                      <td>{row.student_code}</td>
                      <td>{row.student_name}</td>
                      <td>₹{row.amount}</td>
                      <td>{row.payment_approved || row.status}</td>
                      <td>{row.utr_no}</td>
                    </tr>
                  ))}
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
                    <th>Department</th>
                    <th>Year</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingList.map((row) => (
                    <tr key={`${row.student_code}-${row.name}`}>
                      <td>{row.student_code}</td>
                      <td>{row.name}</td>
                      <td>{row.department}</td>
                      <td>{row.year}</td>
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
                    placeholder="BTECH\2022\CSE\0001"
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

                <button type="submit">Mark Entry</button>
              </form>

              {entryMessage ? <div className="staff-info">{entryMessage}</div> : null}
            </div>
          ) : null}

          <Link to="/" className="staff-home-link">← Back to Home</Link>
        </>
      )}
    </div>
  )
}

export default StaffPortal
