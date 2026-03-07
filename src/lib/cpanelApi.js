const RAW_API_BASE_URL = (import.meta.env.VITE_CPANEL_API_BASE_URL || '').replace(/\/$/, '')
const API_BASE_URL = import.meta.env.DEV ? '/api' : RAW_API_BASE_URL
const SUPERADMIN_TOKEN = import.meta.env.VITE_CPANEL_SUPERADMIN_TOKEN || ''
const REQUEST_TIMEOUT = 15000 // 15 seconds
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000 // Initial retry delay

const parseJsonSafe = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const buildUrl = (path, query) => {
  const trimmedPath = path.startsWith('/') ? path : `/${path}`
  const base = API_BASE_URL || ''

  const queryString = query && Object.keys(query).length > 0
    ? `?${new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()}`
    : ''

  return `${base}${trimmedPath}${queryString}`
}

const createTimeoutPromise = (ms) => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error('Request timeout - Network may be slow or unreachable')
      error.code = 'TIMEOUT'
      reject(error)
    }, ms)
  })
}

const request = async (path, { method = 'GET', headers = {}, body, query, timeout = REQUEST_TIMEOUT } = {}) => {
  if (!API_BASE_URL) {
    const error = new Error('CPANEL_API_BASE_URL_MISSING')
    error.code = 'CPANEL_API_BASE_URL_MISSING'
    throw error
  }

  let lastError = null
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // For FormData, don't set Content-Type header - let browser set it with boundary
      const fetchOptions = {
        method,
        body,
        mode: 'cors',
        credentials: 'omit' // Changed from 'include' to avoid CORS duplicate header issues
      }

      // Only include headers if not FormData
      if (!(body instanceof FormData)) {
        fetchOptions.headers = {
          ...headers,
          'Accept': 'application/json'
        }
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        const response = await fetch(buildUrl(path, query), {
          ...fetchOptions,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        const payload = await parseJsonSafe(response)

        if (!response.ok || payload?.success === false) {
          const message = payload?.message || payload?.error || `Request failed with status ${response.status}`
          const error = new Error(message)
          error.status = response.status
          error.payload = payload
          throw error
        }

        return payload
      } catch (error) {
        clearTimeout(timeoutId)
        throw error
      }
    } catch (error) {
      lastError = error

      const messageText = String(error?.message || '')
      const isIntegrityConstraintError =
        messageText.includes('SQLSTATE[23000]') ||
        messageText.includes('Integrity constraint violation') ||
        messageText.includes('foreign key constraint fails')
      
      // Don't retry on certain errors
      if (error.code === 'CPANEL_API_BASE_URL_MISSING' || error.status === 401 || error.status === 403 || error.status === 404 || isIntegrityConstraintError) {
        throw error
      }

      // Check if it's a CORS error and don't log excessively
      const isCorsError = error.message?.includes('CORS') || error.message?.includes('blocked')
      
      // Log retry attempt (suppress for CORS errors after first attempt)
      if (attempt < MAX_RETRIES && (!isCorsError || attempt === 1)) {
        const delay = RETRY_DELAY_MS * attempt
        console.warn(`API request failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`, error.message)
        
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay))
      } else if (attempt < MAX_RETRIES) {
        // Still wait even if not logging
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt))
      }
    }
  }

  // If all retries failed, throw the last error with enhanced message
  const error = new Error(
    lastError?.message || 'Failed to connect to server after multiple attempts'
  )
  error.code = lastError?.code || 'REQUEST_FAILED'
  if (lastError?.status) {
    error.status = lastError.status
  }
  if (lastError?.payload) {
    error.payload = lastError.payload
  }
  error.originalError = lastError
  throw error
}

export const cpanelApi = {
  isConfigured: () => Boolean(API_BASE_URL),
  baseUrl: API_BASE_URL,

  getActiveConfig: async () => {
    const payload = await request('/config/active')
    const options = Array.isArray(payload?.options) ? payload.options : []

    const mappedOptions = options.map((option) => {
      const amountNumber = Number(option.amount)
      const roundedAmount = Number.isFinite(amountNumber) && amountNumber > 0 ? Math.round(amountNumber) : 600
      const includeFoodFromApi = option.include_food === 1 || option.include_food === '1' || option.include_food === true
      return {
        id: String(option.option_id || `amount-${roundedAmount}`),
        amount: roundedAmount,
        upiId: String(option.upi_id || ''),
        payeeName: String(option.payee_name || 'Refresko 2026'),
        note: String(option.note_text || `Refresko Registration ₹${roundedAmount}`),
        includeFood: roundedAmount === 600 ? true : includeFoodFromApi
      }
    })

    const active = payload?.active || null
    const activeOptionId = active?.option_id
      ? String(active.option_id)
      : (mappedOptions[0]?.id || 'amount-600')

    return {
      activeOptionId,
      options: mappedOptions
    }
  },

  setPaymentConfig: async (config) => {
    const options = Array.isArray(config?.options) ? config.options : []
    const payload = {
      option_id: config?.activeOptionId || '',
      options: options.map((option) => ({
        id: option.id,
        amount: Number(option.amount) || 0,
        upiId: option.upiId || '',
        payeeName: option.payeeName || 'Refresko 2026',
        note: option.note || '',
        includeFood: Number(option.amount) === 600 ? true : Boolean(option.includeFood)
      }))
    }

    return request('/config/active', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
  },

  getStudentByCode: async (studentCode) => {
    if (!studentCode) {
      throw new Error('Student code is required')
    }
    return request('/students/get', {
      query: { student_code: studentCode }
    })
  },

  listStudents: async ({ search, status = 'all', limit = 500, offset = 0 } = {}) => {
    return request('/students/list', {
      query: { search, status, limit, offset }
    })
  },

  updateStudent: async (studentData) => {
    if (!studentData?.student_code) {
      throw new Error('Student code is required')
    }
    return request('/students/upsert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(studentData)
    })
  },

  listPayments: async ({ status, search, limit = 200, offset = 0 } = {}) => {
    return request('/payments/list', {
      query: { status, search, limit, offset }
    })
  },

  submitPayment: async (formData) => {
    return request('/payments/submit', {
      method: 'POST',
      body: formData
    })
  },

  updatePaymentDecision: async ({ paymentId, decision }) => {
    return request('/payments/decision', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        payment_id: paymentId,
        decision
      })
    })
  },

  adminLogin: async ({ email, password }) => {
    return request('/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })
  },

  superAdminLogin: async ({ username, password }) => {
    return request('/super-admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    })
  },

  listAdmins: async () => {
    return request('/admin/list')
  },

  createAdmin: async ({ name, email, password, role = 'admin' }) => {
    return request('/admin/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password, role })
    })
  },

  updateAdmin: async ({ adminId, status, password, name }) => {
    return request('/admin/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        admin_id: adminId,
        status,
        password,
        name
      })
    })
  },

  deleteAdmin: async ({ adminId }) => {
    return request('/admin/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ admin_id: adminId })
    })
  },

  createStaffAccount: async ({
    name,
    username,
    password,
    role,
    departmentScope,
    yearScope,
    superAdminUsername,
    superAdminPassword
  }) => {
    const headers = {
      'Content-Type': 'application/json'
    }

    return request('/staff/create', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        username,
        password,
        role,
        department_scope: departmentScope,
        year_scope: yearScope,
        super_admin_username: superAdminUsername,
        super_admin_password: superAdminPassword
      })
    })
  },

  listStaffAccounts: async ({ superAdminUsername, superAdminPassword }) => {
    return request('/staff/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        super_admin_username: superAdminUsername,
        super_admin_password: superAdminPassword
      })
    })
  },

  updateStaffAccount: async ({
    staffId,
    name,
    username,
    role,
    departmentScope,
    yearScope,
    isActive,
    password,
    superAdminUsername,
    superAdminPassword
  }) => {
    return request('/staff/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        staff_id: staffId,
        name,
        username,
        role,
        department_scope: departmentScope,
        year_scope: yearScope,
        is_active: isActive,
        password,
        super_admin_username: superAdminUsername,
        super_admin_password: superAdminPassword
      })
    })
  },

  staffLogin: async ({ username, password }) => {
    return request('/staff/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    })
  },

  staffLogout: async (token) => {
    return request('/staff/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  },

  staffTransactions: async (token) => {
    return request('/staff/transactions', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  },

  markGateEntry: async ({ token, studentCode, qrData, day }) => {
    return request('/staff/gate-entry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        student_code: studentCode,
        qr_data: qrData,
        day
      })
    })
  },

  // Google Wallet Integration
  generateGoogleWalletPass: async (studentCode) => {
    if (!studentCode) {
      throw new Error('Student code is required')
    }
    return request('/google-wallet/generate', {
      query: { student_code: studentCode }
    })
  },

  getGoogleWalletStatus: async () => {
    return request('/google-wallet/status')
  }
}
