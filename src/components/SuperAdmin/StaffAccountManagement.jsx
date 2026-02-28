import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { cpanelApi } from '../../lib/cpanelApi'
import './StaffAccountManagement.css'

const StaffAccountManagement = ({ superAdminUsername = '' }) => {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'volunteer',
    departmentScope: '',
    yearScope: '',
    superAdminPassword: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [departmentOptions, setDepartmentOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])

  useEffect(() => {
    const loadScopeOptions = async () => {
      if (!cpanelApi.isConfigured()) return

      try {
        const response = await cpanelApi.listStudents({ limit: 2000, offset: 0 })
        const students = Array.isArray(response?.students) ? response.students : []

        const departments = [...new Set(
          students
            .map((item) => String(item?.department || '').trim())
            .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b))

        const years = [...new Set(
          students
            .map((item) => String(item?.year || '').trim())
            .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b))

        setDepartmentOptions(departments)
        setYearOptions(years)
      } catch {
        setDepartmentOptions([])
        setYearOptions([])
      }
    }

    loadScopeOptions()
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (error) setError('')
    if (success) setSuccess('')
  }

  const handleCreateStaff = async (event) => {
    event.preventDefault()

    const name = formData.name.trim()
    const username = formData.username.trim().toLowerCase()
    const password = formData.password.trim()
    const role = formData.role
    const departmentScope = formData.departmentScope.trim()
    const yearScope = formData.yearScope.trim()
    const superAdminPassword = formData.superAdminPassword

    if (!name || !username || !password || !role || !superAdminPassword) {
      setError('All fields are required')
      return
    }

    if (role === 'cr' && (!departmentScope || !yearScope)) {
      setError('Department and Year are required for CR')
      return
    }

    if (password.length < 6) {
      setError('Staff password must be at least 6 characters')
      return
    }

    if (!superAdminUsername) {
      setError('Super admin username is missing. Please login again.')
      return
    }

    if (!cpanelApi.isConfigured()) {
      setError('API is not configured')
      return
    }

    try {
      setLoading(true)
      await cpanelApi.createStaffAccount({
        name,
        username,
        password,
        role,
        departmentScope,
        yearScope,
        superAdminUsername,
        superAdminPassword
      })

      setSuccess(`✓ ${role.toUpperCase()} account created successfully`)
      setFormData((prev) => ({
        ...prev,
        name: '',
        username: '',
        password: '',
        role: 'volunteer',
        departmentScope: '',
        yearScope: ''
      }))
    } catch (apiError) {
      setError(apiError?.message || 'Unable to create staff account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="staff-account-management">
      <div className="section-header">
        <div className="header-content">
          <h2>Staff Account Control</h2>
          <p>Create CR and Volunteer accounts (Super Admin only)</p>
        </div>
      </div>

      <motion.form
        className="staff-create-form"
        onSubmit={handleCreateStaff}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="staffName">Name</label>
            <input
              id="staffName"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="staffUsername">Username</label>
            <input
              id="staffUsername"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleChange}
              placeholder="staff username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="staffRole">Role</label>
            <select
              id="staffRole"
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
            >
              <option value="volunteer">Volunteer</option>
              <option value="cr">CR</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="departmentScope">Department (CR Scope)</label>
            <select
              id="departmentScope"
              name="departmentScope"
              value={formData.departmentScope}
              onChange={handleChange}
              disabled={formData.role !== 'cr'}
              required={formData.role === 'cr'}
            >
              <option value="">Select Department</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="yearScope">Year (CR Scope)</label>
            <select
              id="yearScope"
              name="yearScope"
              value={formData.yearScope}
              onChange={handleChange}
              disabled={formData.role !== 'cr'}
              required={formData.role === 'cr'}
            >
              <option value="">Select Year</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="staffPassword">Staff Password</label>
            <input
              id="staffPassword"
              name="password"
              type="text"
              value={formData.password}
              onChange={handleChange}
              placeholder="Minimum 6 characters"
              required
            />
          </div>

          <div className="form-group super-admin-password-group">
            <label htmlFor="superAdminPassword">Your Super Admin Password</label>
            <input
              id="superAdminPassword"
              name="superAdminPassword"
              type="password"
              value={formData.superAdminPassword}
              onChange={handleChange}
              placeholder="Confirm super admin password"
              required
            />
          </div>
        </div>

        {error && <p className="form-message error">{error}</p>}
        {success && <p className="form-message success">{success}</p>}

        <button type="submit" className="create-staff-btn" disabled={loading}>
          {loading ? 'Creating...' : 'Create Staff Account'}
        </button>
      </motion.form>
    </div>
  )
}

export default StaffAccountManagement
