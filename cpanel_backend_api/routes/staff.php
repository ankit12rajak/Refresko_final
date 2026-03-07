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

function resolve_student_code_from_hash(string $hash): string
{
    $normalizedHash = strtolower(trim($hash));
    if ($normalizedHash === '' || preg_match('/^[a-f0-9]{32}$/', $normalizedHash) !== 1) {
        return '';
    }

    try {
        $pdo = db();
        $stmt = $pdo->prepare('SELECT student_code FROM student_details WHERE md5(upper(trim(student_code))) = ? LIMIT 1');
        $stmt->execute([$normalizedHash]);
        $row = $stmt->fetch();
        $candidate = strtoupper(trim((string)($row['student_code'] ?? '')));
        return $candidate;
    } catch (Throwable $error) {
        error_log('staff hash lookup error: ' . $error->getMessage());
        return '';
    }
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

        $hashCandidates = [
            $decoded['Student_Code_Hash'] ?? null,
            $decoded['student_code_hash'] ?? null,
            $decoded['Details_Hash']['student_code'] ?? null,
            $decoded['details_hash']['student_code'] ?? null,
            $decoded['Hashes']['student_code'] ?? null,
            $decoded['hashes']['student_code'] ?? null,
        ];

        foreach ($hashCandidates as $hashCandidate) {
            $resolved = resolve_student_code_from_hash((string)$hashCandidate);
            if ($resolved !== '') {
                return $resolved;
            }
        }
    }

    $resolvedFromRaw = resolve_student_code_from_hash($rawQr);
    if ($resolvedFromRaw !== '') {
        return $resolvedFromRaw;
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
        if (preg_match('/((?:19|20)\d{2})/', $raw, $yearMatch) === 1) {
            $candidateYear = (int)$yearMatch[1];
            $maxReasonableYear = (int)gmdate('Y') + 1;
            if ($candidateYear >= 1990 && $candidateYear <= $maxReasonableYear) {
                $admissionYear = $candidateYear;
            }
        }
    }

    if ($admissionYear === null) {
        if (preg_match('/^\D*(\d{2})[A-Za-z]/', $raw, $shortYearMatch) === 1) {
            $yy = (int)$shortYearMatch[1];
            $currentYear = (int)gmdate('Y');
            $candidateYear = 2000 + $yy;

            if ($candidateYear > ($currentYear + 1)) {
                $candidateYear -= 100;
            }

            if ($candidateYear >= 1990 && $candidateYear <= ($currentYear + 1)) {
                $admissionYear = $candidateYear;
            }
        }
    }

    if ($department === '') {
        if (preg_match('/(?:19|20)\d{2}\s*[-_\/]?\s*([A-Za-z]{2,12})/', $raw, $deptMatch) === 1) {
            $department = $deptMatch[1];
        } elseif (preg_match('/^\D*\d{2}\s*[-_\/]?\s*([A-Za-z]{2,12})/', $raw, $deptMatch) === 1) {
            $department = $deptMatch[1];
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

function staff_list(): void
{
    $payload = get_json_input();

    $pdo = db();
    ensure_staff_schema($pdo);
    require_super_admin_for_staff_create($pdo, $payload);

    $hasScopeColumns = staff_scope_columns_available($pdo);

    if ($hasScopeColumns) {
        $stmt = $pdo->prepare('SELECT id,
                                      full_name,
                                      username,
                                      role,
                                      department_scope,
                                      year_scope,
                                      is_active,
                                      created_at,
                                      updated_at
                               FROM event_staff_users
                               ORDER BY created_at DESC, id DESC');
    } else {
        $stmt = $pdo->prepare("SELECT id,
                                      full_name,
                                      username,
                                      role,
                                      '' AS department_scope,
                                      '' AS year_scope,
                                      is_active,
                                      created_at,
                                      updated_at
                               FROM event_staff_users
                               ORDER BY created_at DESC, id DESC");
    }

    $stmt->execute();
    $rows = $stmt->fetchAll();

    $accounts = array_map(static function (array $row): array {
        return [
            'id' => (int)($row['id'] ?? 0),
            'name' => (string)($row['full_name'] ?? ''),
            'username' => (string)($row['username'] ?? ''),
            'role' => (string)($row['role'] ?? ''),
            'department_scope' => (string)($row['department_scope'] ?? ''),
            'year_scope' => (string)($row['year_scope'] ?? ''),
            'is_active' => (int)($row['is_active'] ?? 0),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }, is_array($rows) ? $rows : []);

    json_response([
        'success' => true,
        'accounts' => $accounts,
    ]);
}

function staff_update(): void
{
    $payload = get_json_input();
    require_fields($payload, ['staff_id']);

    $staffId = (int)($payload['staff_id'] ?? 0);
    if ($staffId <= 0) {
        json_response(['success' => false, 'message' => 'Valid staff_id is required'], 422);
    }

    $pdo = db();
    ensure_staff_schema($pdo);
    $superAdmin = require_super_admin_for_staff_create($pdo, $payload);

    $hasScopeColumns = staff_scope_columns_available($pdo);

    if ($hasScopeColumns) {
        $find = $pdo->prepare('SELECT id, full_name, username, role, department_scope, year_scope, is_active
                               FROM event_staff_users
                               WHERE id = :id
                               LIMIT 1');
    } else {
        $find = $pdo->prepare("SELECT id, full_name, username, role, '' AS department_scope, '' AS year_scope, is_active
                               FROM event_staff_users
                               WHERE id = :id
                               LIMIT 1");
    }
    $find->execute([':id' => $staffId]);
    $existing = $find->fetch();

    if (!$existing) {
        json_response(['success' => false, 'message' => 'Staff account not found'], 404);
    }

    $nextName = array_key_exists('name', $payload)
        ? trim((string)$payload['name'])
        : (string)($existing['full_name'] ?? '');
    $nextUsername = array_key_exists('username', $payload)
        ? strtolower(trim((string)$payload['username']))
        : strtolower((string)($existing['username'] ?? ''));
    $nextRole = array_key_exists('role', $payload)
        ? strtolower(trim((string)$payload['role']))
        : strtolower((string)($existing['role'] ?? ''));
    $nextIsActive = array_key_exists('is_active', $payload)
        ? ((int)$payload['is_active'] === 1 ? 1 : 0)
        : (int)($existing['is_active'] ?? 1);

    if (!in_array($nextRole, ['cr', 'volunteer'], true)) {
        json_response(['success' => false, 'message' => 'role must be cr or volunteer'], 422);
    }

    if ($nextName === '' || $nextUsername === '') {
        json_response(['success' => false, 'message' => 'name and username cannot be empty'], 422);
    }

    $nextDepartmentScope = array_key_exists('department_scope', $payload)
        ? trim((string)$payload['department_scope'])
        : trim((string)($existing['department_scope'] ?? ''));
    $nextYearScope = array_key_exists('year_scope', $payload)
        ? trim((string)$payload['year_scope'])
        : trim((string)($existing['year_scope'] ?? ''));

    if ($nextRole === 'volunteer') {
        $nextDepartmentScope = '';
        $nextYearScope = '';
    }

    if ($nextRole === 'cr' && ($nextDepartmentScope === '' || $nextYearScope === '')) {
        json_response(['success' => false, 'message' => 'department_scope and year_scope are required for CR'], 422);
    }

    if ($nextRole === 'cr' && !$hasScopeColumns) {
        json_response([
            'success' => false,
            'message' => 'Database migration required: add department_scope and year_scope columns before assigning CR scope.'
        ], 500);
    }

    $password = array_key_exists('password', $payload)
        ? trim((string)$payload['password'])
        : '';
    if ($password !== '' && strlen($password) < 6) {
        json_response(['success' => false, 'message' => 'Password must be at least 6 characters'], 422);
    }

    $sqlParts = [
        'full_name = :full_name',
        'username = :username',
        'role = :role',
        'is_active = :is_active',
    ];
    $params = [
        ':full_name' => $nextName,
        ':username' => $nextUsername,
        ':role' => $nextRole,
        ':is_active' => $nextIsActive,
        ':id' => $staffId,
    ];

    if ($hasScopeColumns) {
        $sqlParts[] = 'department_scope = :department_scope';
        $sqlParts[] = 'year_scope = :year_scope';
        $params[':department_scope'] = $nextDepartmentScope !== '' ? $nextDepartmentScope : null;
        $params[':year_scope'] = $nextYearScope !== '' ? $nextYearScope : null;
    }

    if ($password !== '') {
        $sqlParts[] = 'password_hash = :password_hash';
        $params[':password_hash'] = password_hash($password, PASSWORD_BCRYPT);
    }

    $updateSql = 'UPDATE event_staff_users SET ' . implode(', ', $sqlParts) . ' WHERE id = :id LIMIT 1';
    $updateStmt = $pdo->prepare($updateSql);

    try {
        $updateStmt->execute($params);
    } catch (Throwable $error) {
        if ((string)$error->getCode() === '23000') {
            json_response(['success' => false, 'message' => 'Username already exists'], 409);
        }

        json_response([
            'success' => false,
            'message' => 'Unable to update staff account: ' . $error->getMessage(),
        ], 500);
    }

    log_event('staff_update', 'event_staff_user', (string)$staffId, [
        'name' => $nextName,
        'username' => $nextUsername,
        'role' => $nextRole,
        'department_scope' => $nextDepartmentScope,
        'year_scope' => $nextYearScope,
        'is_active' => $nextIsActive,
        'password_changed' => $password !== '',
    ], (string)($superAdmin['username'] ?? 'superadmin'));

    json_response([
        'success' => true,
        'message' => 'Staff account updated successfully',
    ]);
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

    $studentsSql = 'SELECT student_code,
                           name,
                           phone,
                           department,
                           year,
                           payment_completion,
                           payment_approved,
                           updated_at,
                           id
                    FROM student_details
                    WHERE TRIM(COALESCE(student_code, "")) <> ""';
    $studentsParams = [];

    if ($staffRole === 'cr') {
        if ($departmentScope === '' || $yearScope === '') {
            json_response(['success' => false, 'message' => 'CR scope is not configured'], 403);
        }

        $scopeDepartmentUpper = normalize_scope_text($departmentScope);
        $studentsSql .= ' AND (UPPER(TRIM(department)) = :department_scope OR department IS NULL OR TRIM(department) = "")';
        $studentsParams[':department_scope'] = $scopeDepartmentUpper;
    }

    $studentsSql .= ' ORDER BY updated_at DESC, id DESC LIMIT 5000';
    $studentsStmt = $pdo->prepare($studentsSql);
    foreach ($studentsParams as $key => $value) {
        $studentsStmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $studentsStmt->execute();
    $students = $studentsStmt->fetchAll();
    if (!is_array($students)) {
        $students = [];
    }

    if ($staffRole === 'cr') {
        $students = array_values(array_filter($students, static function (array $row) use ($departmentScope, $yearScope): bool {
            return row_matches_cr_scope([
                'student_code' => (string)($row['student_code'] ?? ''),
                'department' => (string)($row['department'] ?? ''),
                'year' => (string)($row['year'] ?? ''),
            ], $departmentScope, $yearScope);
        }));
    }

    $scopedStudentCodeSet = [];
    foreach ($students as $studentRow) {
        $code = strtoupper(trim((string)($studentRow['student_code'] ?? '')));
        if ($code !== '') {
            $scopedStudentCodeSet[$code] = true;
        }
    }

    $paidCodesStmt = $pdo->prepare('SELECT DISTINCT UPPER(TRIM(student_code)) AS student_code
                                    FROM payments
                                    WHERE student_code IS NOT NULL
                                      AND TRIM(student_code) <> ""');
    $paidCodesStmt->execute();
    $paidCodeRows = $paidCodesStmt->fetchAll();

    $paidCodeSet = [];
    if (is_array($paidCodeRows)) {
        foreach ($paidCodeRows as $paidRow) {
            $paidCode = strtoupper(trim((string)($paidRow['student_code'] ?? '')));
            if ($paidCode !== '') {
                $paidCodeSet[$paidCode] = true;
            }
        }
    }

    $pendingStudents = array_values(array_filter($students, static function (array $row) use ($paidCodeSet): bool {
        $code = strtoupper(trim((string)($row['student_code'] ?? '')));
        if ($code === '') {
            return false;
        }
        return !isset($paidCodeSet[$code]);
    }));

    $paymentsSql = 'SELECT p.payment_id,
                           p.transaction_id,
                           p.utr_no,
                           p.student_code,
                           p.student_name,
                           p.department,
                           p.year,
                           p.amount,
                           p.status,
                           p.payment_approved,
                           p.created_at,
                           COALESCE(sd.phone, "") AS phone
                    FROM payments p
                    LEFT JOIN student_details sd ON UPPER(TRIM(sd.student_code)) = UPPER(TRIM(p.student_code))
                    ORDER BY p.id DESC
                    LIMIT 5000';
    $paymentsStmt = $pdo->prepare($paymentsSql);
    $paymentsStmt->execute();
    $payments = $paymentsStmt->fetchAll();
    if (!is_array($payments)) {
        $payments = [];
    }

    $payments = array_values(array_filter($payments, static function (array $row) use ($scopedStudentCodeSet): bool {
        $code = strtoupper(trim((string)($row['student_code'] ?? '')));
        if ($code === '') {
            return false;
        }
        return isset($scopedStudentCodeSet[$code]);
    }));

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
