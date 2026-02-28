<?php

function boolish_to_int($value): int
{
    if (is_bool($value)) {
        return $value ? 1 : 0;
    }

    if (is_int($value) || is_float($value)) {
        return ((int)$value) === 1 ? 1 : 0;
    }

    $normalized = strtolower(trim((string)$value));
    if (in_array($normalized, ['1', 'true', 'yes', 'y', 'on'], true)) {
        return 1;
    }

    if (in_array($normalized, ['0', 'false', 'no', 'n', 'off', 'null', ''], true)) {
        return 0;
    }

    return 0;
}

function normalize_payment_approved_state($value): string
{
    $normalized = strtolower(trim((string)$value));
    if (in_array($normalized, ['approved', 'declined', 'pending'], true)) {
        return $normalized;
    }
    return 'pending';
}

function students_list(): void
{
    $search = trim((string)($_GET['search'] ?? ''));
    $status = strtolower(trim((string)($_GET['status'] ?? 'all')));
    $limit = (int)($_GET['limit'] ?? 500);
    $offset = (int)($_GET['offset'] ?? 0);

    $limit = max(1, min(2000, $limit));
    $offset = max(0, $offset);

    $pdo = db();

    $where = [];
    $params = [];

    if ($status === 'active') {
        $where[] = 'profile_completed = 1';
    } elseif ($status === 'inactive') {
        $where[] = 'profile_completed = 0';
    }

    if ($search !== '') {
        $where[] = '(student_code LIKE :search OR name LIKE :search OR email LIKE :search OR phone LIKE :search OR department LIKE :search OR year LIKE :search)';
        $params[':search'] = '%' . $search . '%';
    }

    $countSql = 'SELECT COUNT(*) FROM student_details';
    if ($where) {
        $countSql .= ' WHERE ' . implode(' AND ', $where);
    }

    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $paramKey => $paramValue) {
        $countStmt->bindValue($paramKey, $paramValue, PDO::PARAM_STR);
    }
    $countStmt->execute();
    $total = (int)($countStmt->fetchColumn() ?: 0);

    $sql = 'SELECT id, student_code, name, email, phone, department, year, profile_completed, payment_completion, gate_pass_created, payment_approved, food_included, food_preference, created_at, updated_at
            FROM student_details';
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY id DESC LIMIT :limit OFFSET :offset';

    $stmt = $pdo->prepare($sql);
    foreach ($params as $paramKey => $paramValue) {
        $stmt->bindValue($paramKey, $paramValue, PDO::PARAM_STR);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll();

    $students = array_map(static function (array $row): array {
        $row['profile_completed'] = boolish_to_int($row['profile_completed'] ?? 0);
        $row['payment_completion'] = boolish_to_int($row['payment_completion'] ?? 0);
        $row['gate_pass_created'] = boolish_to_int($row['gate_pass_created'] ?? 0);
        $row['food_included'] = boolish_to_int($row['food_included'] ?? 0);
        $row['payment_approved'] = normalize_payment_approved_state($row['payment_approved'] ?? 'pending');
        return $row;
    }, $rows);

    json_response([
        'success' => true,
        'students' => $students,
        'total' => $total,
        'limit' => $limit,
        'offset' => $offset,
        'has_more' => ($offset + count($students)) < $total,
    ]);
}

function students_get_one(): void
{
    $studentCode = strtoupper(trim((string)($_GET['student_code'] ?? '')));
    if ($studentCode === '') {
        json_response(['success' => false, 'message' => 'student_code is required'], 422);
    }

    $pdo = db();
    $stmt = $pdo->prepare('SELECT *
                          FROM student_details
                          WHERE UPPER(TRIM(student_code)) = :student_code
                          ORDER BY profile_completed DESC, id DESC
                          LIMIT 1');
    $stmt->execute([':student_code' => $studentCode]);
    $student = $stmt->fetch();

    if (!$student) {
        json_response(['success' => false, 'message' => 'Student not found'], 404);
    }

    $student['profile_completed'] = boolish_to_int($student['profile_completed'] ?? 0);
    $student['payment_completion'] = boolish_to_int($student['payment_completion'] ?? 0);
    $student['gate_pass_created'] = boolish_to_int($student['gate_pass_created'] ?? 0);
    $student['food_included'] = boolish_to_int($student['food_included'] ?? 0);
    $student['payment_approved'] = normalize_payment_approved_state($student['payment_approved'] ?? 'pending');

    $latestPaymentStmt = $pdo->prepare('SELECT status, payment_approved
                                        FROM payments
                                        WHERE student_code = :student_code
                                        ORDER BY id DESC
                                        LIMIT 1');
    $latestPaymentStmt->execute([':student_code' => $studentCode]);
    $latestPayment = $latestPaymentStmt->fetch();

    if ($latestPayment) {
        $approvedState = normalize_payment_approved_state($latestPayment['payment_approved'] ?? 'pending');

        $isPaymentSubmitted = true;
        $isGatePassReady = $approvedState === 'approved';

        $student['payment_completion'] = $isPaymentSubmitted ? 1 : 0;
        $student['gate_pass_created'] = $isGatePassReady ? 1 : 0;
        $student['payment_approved'] = $approvedState;
    } else {
        $student['payment_completion'] = 0;
        $student['gate_pass_created'] = 0;
        $student['payment_approved'] = 'pending';
    }

    json_response(['success' => true, 'student' => $student]);
}

function students_upsert_profile(): void
{
    $payload = get_json_input();
    
    // student_code is always required; name and phone are required ONLY for full profile setup (profile_completed=true)
    require_fields($payload, ['student_code']);

    $studentCode = strtoupper(trim((string)$payload['student_code']));
    $originalStudentCode = strtoupper(trim((string)($payload['original_student_code'] ?? '')));
    $name = trim((string)($payload['name'] ?? ''));
    $isFullProfileSetup = boolish_to_int($payload['profile_completed'] ?? false) === 1;

    if ($studentCode === '') {
        json_response(['success' => false, 'message' => 'Invalid student profile payload: student_code required'], 422);
    }

    if ($isFullProfileSetup && $name === '') {
        json_response(['success' => false, 'message' => 'Invalid student profile payload: name required for profile setup'], 422);
    }

    $pdo = db();

    $email = strtolower(trim((string)($payload['email'] ?? '')));
    $phone = trim((string)($payload['phone'] ?? ''));
    $department = trim((string)($payload['department'] ?? ''));
    $year = trim((string)($payload['year'] ?? ''));
    $profileCompleted = boolish_to_int($payload['profile_completed'] ?? true);
    $paymentCompletion = boolish_to_int($payload['payment_completion'] ?? false);
    $gatePassCreated = boolish_to_int($payload['gate_pass_created'] ?? false);
    $paymentApproved = normalize_payment_approved_state($payload['payment_approved'] ?? 'pending');
    $foodIncluded = boolish_to_int($payload['food_included'] ?? false);
    $foodPreference = normalize_food_preference($payload['food_preference'] ?? null);

    $lookupCode = $originalStudentCode !== '' ? $originalStudentCode : $studentCode;
    $findExistingStmt = $pdo->prepare('SELECT id, name, email, phone, department, year FROM student_details WHERE UPPER(TRIM(student_code)) = :student_code LIMIT 1');
    $findExistingStmt->execute([':student_code' => $lookupCode]);
    $existingRow = $findExistingStmt->fetch();

    if (!$existingRow && $email !== '') {
        $findByEmailStmt = $pdo->prepare('SELECT id, student_code, name, email, phone, department, year
                                          FROM student_details
                                          WHERE LOWER(TRIM(email)) = :email
                                          ORDER BY id DESC
                                          LIMIT 1');
        $findByEmailStmt->execute([':email' => strtolower(trim($email))]);
        $existingByEmail = $findByEmailStmt->fetch();
        if ($existingByEmail) {
            $existingRow = $existingByEmail;
            $lookupCode = strtoupper(trim((string)($existingByEmail['student_code'] ?? $lookupCode)));
        }
    }

    if ($existingRow) {
        // Preserve existing values for fields not provided in the request (partial update support)
        if ($name === '') {
            $name = trim((string)($existingRow['name'] ?? $name));
        }
        if ($email === '') {
            $email = strtolower(trim((string)($existingRow['email'] ?? $email)));
        }
        if ($phone === '') {
            $phone = trim((string)($existingRow['phone'] ?? $phone));
        }
        if ($department === '') {
            $department = trim((string)($existingRow['department'] ?? $department));
        }
        if ($year === '') {
            $year = trim((string)($existingRow['year'] ?? $year));
        }

        // Fetch existing status flags and preserve if not explicitly provided
        $existingStatusStmt = $pdo->prepare('SELECT payment_completion, gate_pass_created, payment_approved, food_included, food_preference
                                             FROM student_details
                                             WHERE UPPER(TRIM(student_code)) = :student_code
                                             ORDER BY gate_pass_created DESC, payment_completion DESC, id DESC
                                             LIMIT 1');
        $existingStatusStmt->execute([':student_code' => $lookupCode]);
        $existingStatus = $existingStatusStmt->fetch();

        if ($existingStatus) {
            // Only override if explicitly provided in payload
            if (!isset($payload['payment_completion'])) {
                $paymentCompletion = boolish_to_int($existingStatus['payment_completion'] ?? 0);
            }
            if (!isset($payload['gate_pass_created'])) {
                $gatePassCreated = boolish_to_int($existingStatus['gate_pass_created'] ?? 0);
            }
            if (!isset($payload['payment_approved'])) {
                $paymentApproved = normalize_payment_approved_state($existingStatus['payment_approved'] ?? 'pending');
            }
            if (!isset($payload['food_included'])) {
                $foodIncluded = boolish_to_int($existingStatus['food_included'] ?? 0);
            }
            if (!isset($payload['food_preference'])) {
                $foodPreference = normalize_food_preference($existingStatus['food_preference'] ?? null);
            }
        }

        $updateStmt = $pdo->prepare('UPDATE student_details
                                     SET student_code = :student_code,
                                         name = :name,
                                         email = :email,
                                         phone = :phone,
                                         department = :department,
                                         year = :year,
                                         profile_completed = :profile_completed,
                                         payment_completion = :payment_completion,
                                         gate_pass_created = :gate_pass_created,
                                         payment_approved = :payment_approved,
                                         food_included = :food_included,
                                         food_preference = :food_preference
                                     WHERE UPPER(TRIM(student_code)) = :lookup_student_code');

        $updateStmt->execute([
            ':student_code' => $studentCode,
            ':name' => $name,
            ':email' => $email,
            ':phone' => $phone,
            ':department' => $department,
            ':year' => $year,
            ':profile_completed' => $profileCompleted,
            ':payment_completion' => $paymentCompletion,
            ':gate_pass_created' => $gatePassCreated,
            ':payment_approved' => $paymentApproved,
            ':food_included' => $foodIncluded,
            ':food_preference' => $foodPreference,
            ':lookup_student_code' => $lookupCode,
        ]);
    } else {
        json_response([
            'success' => false,
            'message' => 'Student record not found for update. Profile setup can only update an existing student row.'
        ], 404);
    }

    json_response(['success' => true, 'message' => 'Student profile saved']);
}