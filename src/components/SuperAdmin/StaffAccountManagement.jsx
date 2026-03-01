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
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [savingAccount, setSavingAccount] = useState(false)
  const [departmentOptions, setDepartmentOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [staffAccounts, setStaffAccounts] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    role: 'volunteer',
    departmentScope: '',
    yearScope: '',
    password: '',
    isActive: 1
  })

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

  const loadStaffAccounts = async () => {
    const superAdminPassword = formData.superAdminPassword

    if (!superAdminUsername) {
      setError('Super admin username is missing. Please login again.')
      return
    }

    if (!superAdminPassword) {
      setError('Enter your super admin password to view staff accounts')
      return
    }

    if (!cpanelApi.isConfigured()) {
      setError('API is not configured')
      return
    }

    try {
      setLoadingAccounts(true)
      const response = await cpanelApi.listStaffAccounts({
        superAdminUsername,
        superAdminPassword
      })

      const accounts = Array.isArray(response?.accounts) ? response.accounts : []
      setStaffAccounts(accounts)
      if (error) setError('')
    } catch (apiError) {
      setError(apiError?.message || 'Unable to load staff accounts')
    } finally {
      setLoadingAccounts(false)
    }
  }

  const startEdit = (account) => {
    setEditingId(account.id)
    setEditForm({
      name: String(account.name || ''),
      username: String(account.username || ''),
      role: String(account.role || 'volunteer'),
      departmentScope: String(account.department_scope || ''),
      yearScope: String(account.year_scope || ''),
      password: '',
      isActive: Number(account.is_active) === 1 ? 1 : 0
    })
    setError('')
    setSuccess('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({
      name: '',
      username: '',
      role: 'volunteer',
      departmentScope: '',
      yearScope: '',
      password: '',
      isActive: 1
    })
  }

  const handleEditChange = (event) => {
    const { name, value } = event.target
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSaveEdit = async (accountId) => {
    const superAdminPassword = formData.superAdminPassword

    if (!superAdminUsername) {
      setError('Super admin username is missing. Please login again.')
      return
    }

    if (!superAdminPassword) {
      setError('Enter your super admin password to save changes')
      return
    }

    const name = editForm.name.trim()
    const username = editForm.username.trim().toLowerCase()
    const role = editForm.role
    const departmentScope = editForm.departmentScope.trim()
    const yearScope = editForm.yearScope.trim()
    const password = editForm.password.trim()
    const isActive = Number(editForm.isActive) === 1 ? 1 : 0

    if (!name || !username || !role) {
      setError('Name, username and role are required')
      return
    }

    if (role === 'cr' && (!departmentScope || !yearScope)) {
      setError('Department and Year are required for CR')
      return
    }

    if (password && password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    try {
      setSavingAccount(true)

      await cpanelApi.updateStaffAccount({
        staffId: accountId,
        name,
        username,
        role,
        departmentScope,
        yearScope,
        isActive,
        password,
        superAdminUsername,
        superAdminPassword
      })

      setSuccess('✓ Staff account updated successfully')
      setEditingId(null)
      await loadStaffAccounts()
    } catch (apiError) {
      setError(apiError?.message || 'Unable to update staff account')
    } finally {
      setSavingAccount(false)
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

      <div className="staff-list-section">
        <div className="staff-list-header">
          <h3>All CR & Volunteer Accounts</h3>
          <button
            type="button"
            className="create-staff-btn"
            onClick={loadStaffAccounts}
            disabled={loadingAccounts}
          >
            {loadingAccounts ? 'Loading...' : 'Refresh Accounts'}
          </button>
        </div>

        {!staffAccounts.length ? (
          <p className="staff-empty-note">No staff accounts loaded yet. Click "Refresh Accounts" to view all CR and Volunteer accounts.</p>
        ) : (
          <div className="staff-table-wrapper">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Department Scope</th>
                  <th>Year Scope</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {staffAccounts.map((account) => {
                  const isEditing = editingId === account.id

                  if (!isEditing) {
                    return (
                      <tr key={account.id}>
                        <td>{account.name}</td>
                        <td>{account.username}</td>
                        <td>{String(account.role || '').toUpperCase()}</td>
                        <td>{account.department_scope || '-'}</td>
                        <td>{account.year_scope || '-'}</td>
                        <td>{Number(account.is_active) === 1 ? 'Active' : 'Inactive'}</td>
                        <td>
                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => startEdit(account)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={account.id} className="editing-row">
                      <td>
                        <input
                          name="name"
                          value={editForm.name}
                          onChange={handleEditChange}
                          className="table-input"
                        />
                      </td>
                      <td>
                        <input
                          name="username"
                          value={editForm.username}
                          onChange={handleEditChange}
                          className="table-input"
                        />
                      </td>
                      <td>
                        <select
                          name="role"
                          value={editForm.role}
                          onChange={handleEditChange}
                          className="table-input"
                        >
                          <option value="volunteer">Volunteer</option>
                          <option value="cr">CR</option>
                        </select>
                      </td>
                      <td>
                        <select
                          name="departmentScope"
                          value={editForm.departmentScope}
                          onChange={handleEditChange}
                          disabled={editForm.role !== 'cr'}
                          className="table-input"
                        >
                          <option value="">Select Department</option>
                          {departmentOptions.map((department) => (
                            <option key={department} value={department}>{department}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          name="yearScope"
                          value={editForm.yearScope}
                          onChange={handleEditChange}
                          disabled={editForm.role !== 'cr'}
                          className="table-input"
                        >
                          <option value="">Select Year</option>
                          {yearOptions.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          name="isActive"
                          value={editForm.isActive}
                          onChange={handleEditChange}
                          className="table-input"
                        >
                          <option value={1}>Active</option>
                          <option value={0}>Inactive</option>
                        </select>
                      </td>
                      <td>
                        <div className="table-action-group">
                          <input
                            name="password"
                            type="password"
                            value={editForm.password}
                            onChange={handleEditChange}
                            className="table-input password-input"
                            placeholder="New password"
                          />
                          <button
                            type="button"
                            className="table-action-btn save"
                            onClick={() => handleSaveEdit(account.id)}
                            disabled={savingAccount}
                          >
                            {savingAccount ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="table-action-btn cancel"
                            onClick={cancelEdit}
                            disabled={savingAccount}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default StaffAccountManagement
