<?php

function staff_table_has_column(PDO $pdo, string $tableName, string $columnName): bool
{
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $tableName) || !preg_match('/^[a-zA-Z0-9_]+$/', $columnName)) {
        return false;
    }

    $sql = sprintf('SHOW COLUMNS FROM `%s` LIKE %s', $tableName, $pdo->quote($columnName));
    $stmt = $pdo->query($sql);
    return $stmt ? (bool)$stmt->fetch() : false;
}

function staff_scope_columns_available(PDO $pdo): bool
{
    return staff_table_has_column($pdo, 'event_staff_users', 'department_scope')
        && staff_table_has_column($pdo, 'event_staff_users', 'year_scope');
}

function ensure_staff_schema(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS event_staff_users (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(120) NOT NULL,
        username VARCHAR(120) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('cr','volunteer') NOT NULL,
        department_scope VARCHAR(120) NULL,
        year_scope VARCHAR(30) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        auth_token VARCHAR(128) NULL,
        token_expires_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff_role (role),
        INDEX idx_staff_auth_token (auth_token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $day1At = $pdo->query("SHOW COLUMNS FROM student_details LIKE 'day1_entry_at'")->fetch();
    if (!$day1At) {
        $pdo->exec("ALTER TABLE student_details ADD COLUMN day1_entry_at DATETIME NULL AFTER gate_pass_created");
    }

    $day1By = $pdo->query("SHOW COLUMNS FROM student_details LIKE 'day1_entry_by'")->fetch();
    if (!$day1By) {
        $pdo->exec("ALTER TABLE student_details ADD COLUMN day1_entry_by VARCHAR(120) NULL AFTER day1_entry_at");
    }

    $day2At = $pdo->query("SHOW COLUMNS FROM student_details LIKE 'day2_entry_at'")->fetch();
    if (!$day2At) {
        $pdo->exec("ALTER TABLE student_details ADD COLUMN day2_entry_at DATETIME NULL AFTER day1_entry_by");
    }

    $day2By = $pdo->query("SHOW COLUMNS FROM student_details LIKE 'day2_entry_by'")->fetch();
    if (!$day2By) {
        $pdo->exec("ALTER TABLE student_details ADD COLUMN day2_entry_by VARCHAR(120) NULL AFTER day2_entry_at");
    }

    try {
        $deptScope = $pdo->query("SHOW COLUMNS FROM event_staff_users LIKE 'department_scope'")->fetch();
        if (!$deptScope) {
            $pdo->exec("ALTER TABLE event_staff_users ADD COLUMN department_scope VARCHAR(120) NULL AFTER role");
        }

        $yearScope = $pdo->query("SHOW COLUMNS FROM event_staff_users LIKE 'year_scope'")->fetch();
        if (!$yearScope) {
            $pdo->exec("ALTER TABLE event_staff_users ADD COLUMN year_scope VARCHAR(30) NULL AFTER department_scope");
        }
    } catch (Throwable $error) {
        error_log('staff schema migration warning (scope columns): ' . $error->getMessage());
    }
}

function extract_bearer_token(): string
{
    $authHeader = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if ($authHeader === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        $authHeader = (string)($headers['Authorization'] ?? $headers['authorization'] ?? '');
    }

    if (preg_match('/Bearer\s+(.+)/i', $authHeader, $matches) === 1) {
        return trim((string)$matches[1]);
    }

    return '';
}

function parse_staff_student_code(?string $studentCode, ?string $qrData): string
{
    $code = strtoupper(trim((string)$studentCode));
    if ($code !== '') {
        return $code;
    }

    $rawQr = trim((string)$qrData);
    if ($rawQr === '') {
        return '';
    }

    $decoded = json_decode($rawQr, true);
    if (is_array($decoded)) {
        $candidates = [
            $decoded['Student_Code'] ?? null,
            $decoded['student_code'] ?? null,
            $decoded['studentId'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            $normalized = strtoupper(trim((string)$candidate));
            if ($normalized !== '') {
                return $normalized;
            }
        }
    }

    return strtoupper($rawQr);
}

function normalize_scope_text(string $value): string
{
    return strtoupper(trim($value));
}

function extract_student_code_parts(string $studentCode): array
{
    $raw = trim($studentCode);
    if ($raw === '') {
        return [
            'admission_year' => null,
            'department' => '',
        ];
    }

    $parts = preg_split('/[\\\/\-_\s]+/', $raw);
    if (!is_array($parts)) {
        $parts = [];
    }

    $admissionYear = null;
    $department = '';

    foreach ($parts as $index => $part) {
        $segment = trim((string)$part);
        if ($segment === '') {
            continue;
        }

        if ($admissionYear === null && preg_match('/^(19|20)\d{2}$/', $segment) === 1) {
            $admissionYear = (int)$segment;

            $nextSegment = trim((string)($parts[$index + 1] ?? ''));
            if ($nextSegment !== '' && preg_match('/^[A-Za-z][A-Za-z0-9\- ]*$/', $nextSegment) === 1) {
                $department = $nextSegment;
            }
        }
    }

    if ($admissionYear === null) {
        if (preg_match('/(?:^|[\\\/\-_\s])((?:19|20)\d{2})(?:$|[\\\/\-_\s])/', $raw, $yearMatch) === 1) {
            $admissionYear = (int)$yearMatch[1];
        }
    }

    if ($department === '') {
        foreach ($parts as $segment) {
            $token = trim((string)$segment);
            if ($token !== '' && preg_match('/^[A-Za-z]{2,10}$/', $token) === 1 && preg_match('/^(19|20)\d{2}$/', $token) !== 1) {
                $department = $token;
                break;
            }
        }
    }

    return [
        'admission_year' => $admissionYear,
        'department' => $department,
    ];
}

function infer_year_label_from_student_code(string $studentCode, ?int $referenceYear = null): string
{
    $parts = extract_student_code_parts($studentCode);
    $admissionYear = isset($parts['admission_year']) ? (int)$parts['admission_year'] : 0;
    if ($admissionYear <= 0) {
        return '';
    }

    $currentYear = $referenceYear ?: (int)gmdate('Y');
    $delta = $currentYear - $admissionYear;

    if ($delta <= 0) {
        $yearNumber = 1;
    } else {
        $yearNumber = min(6, $delta);
    }

    if ($yearNumber === 1) return '1st Year';
    if ($yearNumber === 2) return '2nd Year';
    if ($yearNumber === 3) return '3rd Year';
    return $yearNumber . 'th Year';
}

function infer_year_number_from_student_code(string $studentCode, ?int $referenceYear = null): int
{
    $parts = extract_student_code_parts($studentCode);
    $admissionYear = isset($parts['admission_year']) ? (int)$parts['admission_year'] : 0;
    if ($admissionYear <= 0) {
        return 0;
    }

    $currentYear = $referenceYear ?: (int)gmdate('Y');
    $delta = $currentYear - $admissionYear;

    if ($delta <= 0) {
        return 1;
    }

    return min(6, $delta);
}

function infer_admission_year_from_student_code(string $studentCode): int
{
    $parts = extract_student_code_parts($studentCode);
    $admissionYear = isset($parts['admission_year']) ? (int)$parts['admission_year'] : 0;
    return $admissionYear > 0 ? $admissionYear : 0;
}

function normalize_year_number(string $value): int
{
    $normalized = strtoupper(trim($value));
    if ($normalized === '') {
        return 0;
    }

    if (preg_match('/\b([1-9])\b/', $normalized, $m) === 1) {
        return (int)$m[1];
    }

    if (preg_match('/\b([1-9])(ST|ND|RD|TH)\b/', $normalized, $m) === 1) {
        return (int)$m[1];
    }

    if (strpos($normalized, 'FIRST') !== false) return 1;
    if (strpos($normalized, 'SECOND') !== false) return 2;
    if (strpos($normalized, 'THIRD') !== false) return 3;
    if (strpos($normalized, 'FOURTH') !== false) return 4;
    if (strpos($normalized, 'FIFTH') !== false) return 5;
    if (strpos($normalized, 'SIXTH') !== false) return 6;

    return 0;
}

function row_matches_cr_scope(array $row, string $departmentScope, string $yearScope): bool
{
    $studentCode = trim((string)($row['student_code'] ?? ''));

    $scopeDepartmentNormalized = normalize_scope_text($departmentScope);
    $scopeYearNumber = normalize_year_number($yearScope);

    $rowDepartment = trim((string)($row['department'] ?? ''));
    $rowYear = trim((string)($row['year'] ?? ''));

    $derived = extract_student_code_parts($studentCode);
    $derivedDepartment = trim((string)($derived['department'] ?? ''));
    $derivedYearLabel = infer_year_label_from_student_code($studentCode);
    $derivedYearNumber = infer_year_number_from_student_code($studentCode);

    $effectiveDepartment = $derivedDepartment !== '' ? $derivedDepartment : $rowDepartment;
    $effectiveYear = $derivedYearLabel !== '' ? $derivedYearLabel : $rowYear;

    $departmentMatches = normalize_scope_text($effectiveDepartment) === $scopeDepartmentNormalized;

    $rowYearNumber = normalize_year_number($rowYear);
    $effectiveYearNumber = $derivedYearNumber > 0
        ? $derivedYearNumber
        : ($rowYearNumber > 0 ? $rowYearNumber : normalize_year_number($effectiveYear));
    $yearMatches = $scopeYearNumber > 0
        ? $effectiveYearNumber === $scopeYearNumber
        : true;

    return $departmentMatches && $yearMatches;
}

function get_authenticated_staff(PDO $pdo, array $allowedRoles = []): array
{
    ensure_staff_schema($pdo);

    $hasScopeColumns = staff_scope_columns_available($pdo);

    $token = extract_bearer_token();
    if ($token === '') {
        json_response(['success' => false, 'message' => 'Unauthorized: missing token'], 401);
    }

    if ($hasScopeColumns) {
        $stmt = $pdo->prepare('SELECT id, full_name, username, role, department_scope, year_scope, is_active, token_expires_at
                               FROM event_staff_users
                               WHERE auth_token = :auth_token
                               LIMIT 1');
    } else {
        $stmt = $pdo->prepare("SELECT id, full_name, username, role, '' AS department_scope, '' AS year_scope, is_active, token_expires_at
                               FROM event_staff_users
                               WHERE auth_token = :auth_token
                               LIMIT 1");
    }
    $stmt->execute([':auth_token' => $token]);
    $staff = $stmt->fetch();

    if (!$staff || (int)$staff['is_active'] !== 1) {
        json_response(['success' => false, 'message' => 'Unauthorized: invalid token'], 401);
    }

    $expiresAt = trim((string)($staff['token_expires_at'] ?? ''));
    if ($expiresAt === '' || strtotime($expiresAt) < time()) {
        json_response(['success' => false, 'message' => 'Unauthorized: token expired'], 401);
    }

    $staffRole = strtolower(trim((string)$staff['role']));
    if ($allowedRoles && !in_array($staffRole, $allowedRoles, true)) {
        json_response(['success' => false, 'message' => 'Forbidden: insufficient role'], 403);
    }

    return $staff;
}

function require_super_admin_for_staff_create(PDO $pdo, array $payload): array
{
    require_fields($payload, ['super_admin_username', 'super_admin_password']);

    $identity = strtolower(trim((string)$payload['super_admin_username']));
    $password = (string)$payload['super_admin_password'];

    if ($identity === '' || $password === '') {
        json_response(['success' => false, 'message' => 'Super admin credentials are required'], 422);
    }

     $stmt = $pdo->prepare('SELECT id, username, email, full_name, password, is_active
                                    FROM super_admin_credentials
                                    WHERE LOWER(username) = :identity_username
                                        OR LOWER(email) = :identity_email
                                    LIMIT 1');
     $stmt->execute([
          ':identity_username' => $identity,
          ':identity_email' => $identity,
     ]);
    $superAdmin = $stmt->fetch();

    if (!$superAdmin || (int)($superAdmin['is_active'] ?? 0) !== 1) {
        json_response(['success' => false, 'message' => 'Only super admin can create staff accounts'], 403);
    }

    $storedPassword = (string)($superAdmin['password'] ?? '');
    $isValid = false;
    if (function_exists('verify_super_admin_password')) {
        $isValid = verify_super_admin_password($password, $storedPassword);
    } else {
        $isValid = password_verify($password, $storedPassword) || hash_equals(trim($storedPassword), $password);
    }

    if (!$isValid) {
        json_response(['success' => false, 'message' => 'Only super admin can create staff accounts'], 403);
    }

    return $superAdmin;
}

function staff_create(): void
{
    $payload = get_json_input();
    require_fields($payload, ['name', 'username', 'password', 'role']);

    $name = trim((string)$payload['name']);
    $username = strtolower(trim((string)$payload['username']));
    $password = (string)$payload['password'];
    $role = strtolower(trim((string)$payload['role']));
    $departmentScope = trim((string)($payload['department_scope'] ?? ''));
    $yearScope = trim((string)($payload['year_scope'] ?? ''));

    if (!in_array($role, ['cr', 'volunteer'], true)) {
        json_response(['success' => false, 'message' => 'role must be cr or volunteer'], 422);
    }
    if ($name === '' || $username === '') {
        json_response(['success' => false, 'message' => 'name and username cannot be empty'], 422);
    }
    if (strlen($password) < 6) {
        json_response(['success' => false, 'message' => 'Password must be at least 6 characters'], 422);
    }

    if ($role === 'cr' && ($departmentScope === '' || $yearScope === '')) {
        json_response(['success' => false, 'message' => 'department_scope and year_scope are required for CR'], 422);
    }

    if ($role === 'volunteer') {
        $departmentScope = '';
        $yearScope = '';
    }

    $pdo = db();
    ensure_staff_schema($pdo);
    $superAdmin = require_super_admin_for_staff_create($pdo, $payload);

    $hasScopeColumns = staff_scope_columns_available($pdo);

    if ($role === 'cr' && !$hasScopeColumns) {
        json_response([
            'success' => false,
            'message' => 'Database migration required: add department_scope and year_scope columns to event_staff_users before creating CR accounts.'
        ], 500);
    }

    if ($hasScopeColumns) {
        $stmt = $pdo->prepare('INSERT INTO event_staff_users (full_name, username, password_hash, role, department_scope, year_scope, is_active)
                               VALUES (:full_name, :username, :password_hash, :role, :department_scope, :year_scope, 1)');
    } else {
        $stmt = $pdo->prepare('INSERT INTO event_staff_users (full_name, username, password_hash, role, is_active)
                               VALUES (:full_name, :username, :password_hash, :role, 1)');
    }

    try {
        $params = [
            ':full_name' => $name,
            ':username' => $username,
            ':password_hash' => password_hash($password, PASSWORD_BCRYPT),
            ':role' => $role,
        ];

        if ($hasScopeColumns) {
            $params[':department_scope'] = $departmentScope !== '' ? $departmentScope : null;
            $params[':year_scope'] = $yearScope !== '' ? $yearScope : null;
        }

        $stmt->execute($params);
    } catch (Throwable $error) {
        if ((string)$error->getCode() === '23000') {
            json_response(['success' => false, 'message' => 'Username already exists'], 409);
        }
        json_response([
            'success' => false,
            'message' => 'Unable to create staff account: ' . $error->getMessage(),
        ], 500);
    }

    log_event('staff_create', 'event_staff_user', (string)$pdo->lastInsertId(), [
        'username' => $username,
        'role' => $role,
        'department_scope' => $departmentScope,
        'year_scope' => $yearScope,
    ], (string)($superAdmin['username'] ?? 'superadmin'));

    json_response(['success' => true, 'message' => 'Staff account created'], 201);
}

function staff_login(): void
{
    $payload = get_json_input();
    require_fields($payload, ['username', 'password']);

    $username = strtolower(trim((string)$payload['username']));
    $password = (string)$payload['password'];
    if ($username === '' || $password === '') {
        json_response(['success' => false, 'message' => 'username and password are required'], 422);
    }

    $pdo = db();
    ensure_staff_schema($pdo);

    $hasScopeColumns = staff_scope_columns_available($pdo);

    if ($hasScopeColumns) {
        $stmt = $pdo->prepare('SELECT id, full_name, username, password_hash, role, department_scope, year_scope, is_active
                               FROM event_staff_users
                               WHERE LOWER(username) = :username
                               LIMIT 1');
    } else {
        $stmt = $pdo->prepare("SELECT id, full_name, username, password_hash, role, '' AS department_scope, '' AS year_scope, is_active
                               FROM event_staff_users
                               WHERE LOWER(username) = :username
                               LIMIT 1");
    }
    $stmt->execute([':username' => $username]);
    $staff = $stmt->fetch();

    if (!$staff || (int)$staff['is_active'] !== 1 || !password_verify($password, (string)$staff['password_hash'])) {
        json_response(['success' => false, 'message' => 'Invalid credentials'], 401);
    }

    $token = bin2hex(random_bytes(24));
    $expiresAt = gmdate('Y-m-d H:i:s', time() + (12 * 60 * 60));

    $update = $pdo->prepare('UPDATE event_staff_users
                             SET auth_token = :auth_token,
                                 token_expires_at = :token_expires_at
                             WHERE id = :id');
    $update->execute([
        ':auth_token' => $token,
        ':token_expires_at' => $expiresAt,
        ':id' => (int)$staff['id'],
    ]);

    json_response([
        'success' => true,
        'staff' => [
            'id' => (int)$staff['id'],
            'name' => (string)$staff['full_name'],
            'username' => (string)$staff['username'],
            'role' => (string)$staff['role'],
            'department_scope' => (string)($staff['department_scope'] ?? ''),
            'year_scope' => (string)($staff['year_scope'] ?? ''),
        ],
        'token' => $token,
        'expires_at' => $expiresAt,
    ]);
}

function staff_logout(): void
{
    $pdo = db();
    $staff = get_authenticated_staff($pdo, ['cr', 'volunteer']);

    $stmt = $pdo->prepare('UPDATE event_staff_users
                           SET auth_token = NULL,
                               token_expires_at = NULL
                           WHERE id = :id');
    $stmt->execute([':id' => (int)$staff['id']]);

    json_response(['success' => true, 'message' => 'Logged out']);
}

function staff_transactions(): void
{
    $pdo = db();
    $staff = get_authenticated_staff($pdo, ['cr', 'volunteer']);

    $staffRole = strtolower(trim((string)($staff['role'] ?? '')));
    $departmentScope = trim((string)($staff['department_scope'] ?? ''));
    $yearScope = trim((string)($staff['year_scope'] ?? ''));

    $paymentsSql = 'SELECT payment_id, transaction_id, utr_no, student_code, student_name, department, year, amount, status, payment_approved, created_at
                    FROM payments';
    $paymentsParams = [];

        $pendingSql = "SELECT student_code, name, department, year, payment_completion, payment_approved
                                     FROM student_details
                                     WHERE profile_completed = 0
                                         AND (
                                                payment_completion = 0
                                                OR payment_approved IS NULL
                                                OR TRIM(payment_approved) = ''
                                                OR LOWER(TRIM(payment_approved)) <> 'approved'
                                         )";
    $pendingParams = [];

    if ($staffRole === 'cr') {
        if ($departmentScope === '' || $yearScope === '') {
            json_response(['success' => false, 'message' => 'CR scope is not configured'], 403);
        }

        $scopeDepartmentUpper = normalize_scope_text($departmentScope);
        $paymentsSql .= ' WHERE (UPPER(TRIM(department)) = :department_scope OR department IS NULL OR TRIM(department) = "")';
        $paymentsParams[':department_scope'] = $scopeDepartmentUpper;

        $pendingSql .= ' AND (UPPER(TRIM(department)) = :department_scope OR department IS NULL OR TRIM(department) = "")';
        $pendingParams[':department_scope'] = $scopeDepartmentUpper;
    }

    $paymentsSql .= ' ORDER BY id DESC LIMIT 1000';
    $paymentsStmt = $pdo->prepare($paymentsSql);
    foreach ($paymentsParams as $key => $value) {
        $paymentsStmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $paymentsStmt->execute();
    $payments = $paymentsStmt->fetchAll();

    $pendingSql .= ' ORDER BY updated_at DESC, id DESC LIMIT 1000';
    $pendingStmt = $pdo->prepare($pendingSql);
    foreach ($pendingParams as $key => $value) {
        $pendingStmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $pendingStmt->execute();
    $pendingStudents = $pendingStmt->fetchAll();

    if ($staffRole === 'cr') {
        $payments = array_values(array_filter($payments, static function (array $row) use ($departmentScope, $yearScope): bool {
            return row_matches_cr_scope($row, $departmentScope, $yearScope);
        }));

        $pendingStudents = array_values(array_filter($pendingStudents, static function (array $row) use ($departmentScope, $yearScope): bool {
            return row_matches_cr_scope($row, $departmentScope, $yearScope);
        }));
    }

    $payments = array_map(static function (array $row): array {
        $studentCode = trim((string)($row['student_code'] ?? ''));
        $inferredYear = infer_year_label_from_student_code($studentCode);
        $inferredAdmissionYear = infer_admission_year_from_student_code($studentCode);
        if (trim((string)($row['year'] ?? '')) === '') {
            $row['year'] = $inferredYear;
        }
        if (trim((string)($row['department'] ?? '')) === '') {
            $parts = extract_student_code_parts($studentCode);
            $row['department'] = trim((string)($parts['department'] ?? ''));
        }
        $row['inferred_year'] = $inferredYear;
        $row['admission_year'] = $inferredAdmissionYear;
        return $row;
    }, $payments);

    $pendingStudents = array_map(static function (array $row): array {
        $studentCode = trim((string)($row['student_code'] ?? ''));
        $inferredYear = infer_year_label_from_student_code($studentCode);
        $inferredAdmissionYear = infer_admission_year_from_student_code($studentCode);
        if (trim((string)($row['year'] ?? '')) === '') {
            $row['year'] = $inferredYear;
        }
        if (trim((string)($row['department'] ?? '')) === '') {
            $parts = extract_student_code_parts($studentCode);
            $row['department'] = trim((string)($parts['department'] ?? ''));
        }
        $row['inferred_year'] = $inferredYear;
        $row['admission_year'] = $inferredAdmissionYear;
        return $row;
    }, $pendingStudents);

    $paidCount = 0;
    foreach ($payments as $payment) {
        $isPaid = in_array(strtolower((string)($payment['status'] ?? '')), ['pending', 'completed', 'declined'], true);
        if ($isPaid) {
            $paidCount++;
        }
    }

    json_response([
        'success' => true,
        'viewer_role' => $staff['role'],
        'access_scope' => [
            'department' => $departmentScope,
            'year' => $yearScope,
        ],
        'summary' => [
            'submitted_payments' => count($payments),
            'pending_payment_students' => count($pendingStudents),
            'paid_count' => $paidCount,
        ],
        'transactions' => $payments,
        'pending_list' => $pendingStudents,
    ]);
}

function staff_mark_gate_entry(): void
{
    $payload = get_json_input();
    require_fields($payload, ['day']);

    $pdo = db();
    $staff = get_authenticated_staff($pdo, ['volunteer']);

    $day = strtolower(trim((string)$payload['day']));
    if (!in_array($day, ['day1', 'day2'], true)) {
        json_response(['success' => false, 'message' => 'day must be day1 or day2'], 422);
    }

    $studentCode = parse_staff_student_code($payload['student_code'] ?? null, $payload['qr_data'] ?? null);
    if ($studentCode === '') {
        json_response(['success' => false, 'message' => 'student_code or qr_data is required'], 422);
    }

    $entryAtColumn = $day === 'day1' ? 'day1_entry_at' : 'day2_entry_at';
    $entryByColumn = $day === 'day1' ? 'day1_entry_by' : 'day2_entry_by';

    $find = $pdo->prepare('SELECT student_code, name, payment_approved, gate_pass_created, day1_entry_at, day2_entry_at
                           FROM student_details
                           WHERE UPPER(TRIM(student_code)) = :student_code
                           ORDER BY id DESC
                           LIMIT 1');
    $find->execute([':student_code' => $studentCode]);
    $student = $find->fetch();

    if (!$student) {
        json_response(['success' => false, 'message' => 'Student not found'], 404);
    }

    $approvedState = strtolower(trim((string)($student['payment_approved'] ?? 'pending')));
    if ($approvedState !== 'approved' || (int)($student['gate_pass_created'] ?? 0) !== 1) {
        json_response(['success' => false, 'message' => 'Gate pass is not approved for this student'], 403);
    }

    $existingEntry = trim((string)($student[$entryAtColumn] ?? ''));
    if ($existingEntry !== '') {
        json_response([
            'success' => false,
            'message' => strtoupper($day) . ' entry already marked',
            'entry_at' => $existingEntry,
        ], 409);
    }

    $update = $pdo->prepare("UPDATE student_details
                             SET {$entryAtColumn} = :entry_at,
                                 {$entryByColumn} = :entry_by
                             WHERE UPPER(TRIM(student_code)) = :student_code
                               AND {$entryAtColumn} IS NULL");
    $entryTime = now_utc();
    $update->execute([
        ':entry_at' => $entryTime,
        ':entry_by' => (string)$staff['username'],
        ':student_code' => $studentCode,
    ]);

    if ($update->rowCount() === 0) {
        json_response(['success' => false, 'message' => strtoupper($day) . ' entry already exists'], 409);
    }

    json_response([
        'success' => true,
        'message' => strtoupper($day) . ' entry marked successfully',
        'entry' => [
            'student_code' => $studentCode,
            'student_name' => (string)($student['name'] ?? ''),
            'day' => $day,
            'entry_at' => $entryTime,
            'entry_by' => (string)$staff['username'],
        ],
    ]);
}
