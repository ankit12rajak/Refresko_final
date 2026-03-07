<?php

/**
 * Google Wallet API Routes
 * Handles generating and managing Google Wallet passes for students
 */

require_once __DIR__ . '/../lib/google_wallet.php';

/**
 * Generate Google Wallet pass for a student
 * GET /google-wallet/generate?student_code=XXX
 */
function google_wallet_generate(): void
{
    $studentCode = trim((string)($_GET['student_code'] ?? ''));
    
    if (empty($studentCode)) {
        json_response([
            'success' => false,
            'message' => 'Student code is required',
            'error' => 'Student code is required'
        ], 400);
        return;
    }
    
    // Build normalized student code variants to avoid slash/backslash and casing mismatches.
    $normalizedInput = strtoupper(trim($studentCode));
    $variants = array_values(array_unique([
        $normalizedInput,
        str_replace('\\', '/', $normalizedInput),
        str_replace('/', '\\', $normalizedInput),
    ]));

    // Get latest student data from database for any matching code variant.
    $pdo = db();
    $variantPlaceholders = [];
    $variantParams = [];
    foreach ($variants as $index => $variantCode) {
        $key = ':code_' . $index;
        $variantPlaceholders[] = $key;
        $variantParams[$key] = $variantCode;
    }

    $studentSql = 'SELECT *
                   FROM student_details
                   WHERE UPPER(TRIM(student_code)) IN (' . implode(',', $variantPlaceholders) . ')
                   ORDER BY profile_completed DESC, id DESC
                   LIMIT 1';
    $stmt = $pdo->prepare($studentSql);
    $stmt->execute($variantParams);
    $student = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$student) {
        json_response([
            'success' => false,
            'message' => 'Student not found',
            'error' => 'Student not found'
        ], 404);
        return;
    }
    
    // Accept common status/value variations coming from legacy rows.
    $paymentApproved = strtolower(trim((string)($student['payment_approved'] ?? 'pending')));
    $approvedValues = ['approved', 'success', 'paid', 'verified'];

    $rawGatePass = $student['gate_pass_created'] ?? 0;
    $gatePassCreated = in_array(strtolower(trim((string)$rawGatePass)), ['1', 'true', 'yes'], true);

    // Prefer the latest payment state when available because it is the source of truth.
    $latestPaymentSql = 'SELECT status, payment_approved
                         FROM payments
                         WHERE UPPER(TRIM(student_code)) IN (' . implode(',', $variantPlaceholders) . ')
                         ORDER BY id DESC
                         LIMIT 1';
    $latestPaymentStmt = $pdo->prepare($latestPaymentSql);
    $latestPaymentStmt->execute($variantParams);
    $latestPayment = $latestPaymentStmt->fetch(PDO::FETCH_ASSOC);

    if ($latestPayment) {
        $latestPaymentApproved = strtolower(trim((string)($latestPayment['payment_approved'] ?? 'pending')));
        $latestStatus = strtolower(trim((string)($latestPayment['status'] ?? 'pending')));
        $paymentMarkedApproved = in_array($latestPaymentApproved, $approvedValues, true)
            || in_array($latestStatus, ['completed', 'approved', 'paid', 'success'], true);

        if ($paymentMarkedApproved) {
            $paymentApproved = 'approved';
            $gatePassCreated = true;
        }
    }
    
    if (!in_array($paymentApproved, $approvedValues, true) || !$gatePassCreated) {
        json_response([
            'success' => false,
            'message' => 'Gate pass not available. Payment must be approved first.',
            'error' => 'Gate pass not available. Payment must be approved first.',
            'payment_approved' => $paymentApproved,
            'gate_pass_created' => $rawGatePass,
            'lookup_variants' => $variants,
            'latest_payment' => $latestPayment ?: null
        ], 403);
        return;
    }
    
    // Initialize Google Wallet service
    $walletService = new GoogleWalletService();
    
    if (!$walletService->isConfigured()) {
        $details = $walletService->getLastError();
        json_response([
            'success' => false,
            'message' => 'Google Wallet is not configured on the server. Please contact administrator.',
            'error' => 'Google Wallet is not configured on the server. Please contact administrator.',
            'details' => $details !== '' ? $details : null
        ], 500);
        return;
    }
    
    // Ensure class is created (idempotent operation)
    $classCreated = $walletService->createOrUpdateClass();
    if (!$classCreated) {
        $details = $walletService->getLastError();
        json_response([
            'success' => false,
            'message' => 'Failed to initialize Google Wallet class. Please try again later.',
            'error' => 'Failed to initialize Google Wallet class. Please try again later.',
            'details' => $details !== '' ? $details : null
        ], 500);
        return;
    }
    
    // Create gate pass and get JWT
    $jwt = $walletService->createGatePass([
        'student_code' => $student['student_code'],
        'name' => $student['name'],
        'email' => $student['email'],
        'department' => $student['department'] ?? '',
        'year' => $student['year'] ?? ''
    ]);
    
    if (!$jwt) {
        $details = $walletService->getLastError();
        json_response([
            'success' => false,
            'message' => 'Failed to generate Google Wallet pass. Please try again later.',
            'error' => 'Failed to generate Google Wallet pass. Please try again later.',
            'details' => $details !== '' ? $details : null
        ], 500);
        return;
    }
    
    json_response([
        'success' => true,
        'jwt' => $jwt,
        'save_url' => "https://pay.google.com/gp/v/save/{$jwt}"
    ]);
}

/**
 * Check Google Wallet configuration status
 * GET /google-wallet/status
 */
function google_wallet_status(): void
{
    $walletService = new GoogleWalletService();
    $configured = $walletService->isConfigured();
    $details = $walletService->getLastError();
    
    json_response([
        'success' => true,
        'configured' => $configured,
        'message' => $configured 
            ? 'Google Wallet is properly configured' 
            : 'Google Wallet is not configured. Please add credentials.',
        'details' => $configured ? null : ($details !== '' ? $details : null)
    ]);
}
