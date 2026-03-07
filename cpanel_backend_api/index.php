<?php

require_once __DIR__ . '/lib/response.php';
require_once __DIR__ . '/lib/cors.php';
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/upload.php';
require_once __DIR__ . '/config/database.php';

require_once __DIR__ . '/routes/health.php';
require_once __DIR__ . '/routes/config.php';
require_once __DIR__ . '/routes/students.php';
require_once __DIR__ . '/routes/payments.php';
require_once __DIR__ . '/routes/admin.php';
require_once __DIR__ . '/routes/super_admin.php';
require_once __DIR__ . '/routes/staff.php';
require_once __DIR__ . '/routes/google_wallet.php';

apply_cors();

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if ($scriptDir !== '' && strpos($path, $scriptDir) === 0) {
    $path = substr($path, strlen($scriptDir));
}
$path = '/' . ltrim($path, '/');

// Support deployments that proxy requests with an /api prefix even when
// this app is served from the domain root (no physical "api" folder).
if ($path === '/api') {
    $path = '/';
} elseif (strpos($path, '/api/') === 0) {
    $path = substr($path, 4);
    $path = '/' . ltrim($path, '/');
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    if ($method === 'GET' && $path === '/') {
        json_response([
            'success' => true,
            'message' => 'Refresko API is running',
            'health' => '/health',
        ]);
    }

    if ($method === 'GET' && $path === '/health') {
        health_route();
    }

    if ($method === 'GET' && $path === '/config/active') {
        config_get_active();
    }

    if ($method === 'POST' && $path === '/config/active') {
        config_set_active();
    }

    if ($method === 'GET' && $path === '/students/get') {
        students_get_one();
    }

    if ($method === 'GET' && $path === '/students/list') {
        students_list();
    }

    if ($method === 'POST' && $path === '/students/upsert') {
        students_upsert_profile();
    }

    if ($method === 'GET' && $path === '/payments/list') {
        payments_list();
    }

    if ($method === 'POST' && $path === '/payments/submit') {
        payments_submit_with_upload();
    }

    if ($method === 'POST' && $path === '/payments/decision') {
        payments_update_status();
    }

    if ($method === 'POST' && $path === '/admin/login') {
        admin_login();
    }

    if ($method === 'POST' && $path === '/super-admin/login') {
        super_admin_login();
    }

    if ($method === 'POST' && $path === '/admin/create') {
        admin_create();
    }

    if ($method === 'GET' && $path === '/admin/list') {
        admin_list();
    }

    if ($method === 'POST' && $path === '/admin/update') {
        admin_update();
    }

    if ($method === 'POST' && $path === '/admin/delete') {
        admin_delete();
    }

    if ($method === 'POST' && $path === '/staff/create') {
        staff_create();
    }

    if ($method === 'POST' && $path === '/staff/list') {
        staff_list();
    }

    if ($method === 'POST' && $path === '/staff/update') {
        staff_update();
    }

    if ($method === 'POST' && $path === '/staff/login') {
        staff_login();
    }

    if ($method === 'POST' && $path === '/staff/logout') {
        staff_logout();
    }

    if ($method === 'GET' && $path === '/staff/transactions') {
        staff_transactions();
    }

    if ($method === 'POST' && $path === '/staff/gate-entry') {
        staff_mark_gate_entry();
    }

    if ($method === 'GET' && $path === '/google-wallet/generate') {
        google_wallet_generate();
    }

    if ($method === 'GET' && $path === '/google-wallet/status') {
        google_wallet_status();
    }

    json_response(['success' => false, 'message' => 'Route not found', 'route' => $path], 404);
} catch (Throwable $error) {
    json_response([
        'success' => false,
        'message' => 'Internal server error',
        'error' => $error->getMessage(),
    ], 500);
}
