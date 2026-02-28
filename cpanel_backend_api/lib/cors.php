<?php

function normalize_origin(string $origin): string
{
    $origin = trim($origin);
    if ($origin === '') {
        return '';
    }

    $parts = parse_url($origin);
    if (!is_array($parts)) {
        return rtrim($origin, '/');
    }

    $scheme = strtolower((string)($parts['scheme'] ?? ''));
    $host   = strtolower((string)($parts['host']   ?? ''));
    $port   = isset($parts['port']) ? (int)$parts['port'] : null;

    if ($scheme === '' || $host === '') {
        return rtrim($origin, '/');
    }

    $normalized = $scheme . '://' . $host;
    if ($port !== null) {
        $normalized .= ':' . $port;
    }

    return $normalized;
}

/**
 * Returns true when the incoming origin should be allowed.
 *
 * Rules (checked in order):
 *  1. Exact match against the configured allow-list (after normalisation).
 *  2. Any *.skf.edu.in subdomain is always trusted (covers both refresko.skf.edu.in
 *     and api-refresko.skf.edu.in without requiring a config change for new sub-domains).
 *  3. localhost on any port is trusted (dev convenience).
 */
function is_origin_allowed(string $normalizedOrigin, array $normalizedAllowed): bool
{
    if ($normalizedOrigin === '') {
        return false;
    }

    // 1. Exact allowlist match
    if (in_array($normalizedOrigin, $normalizedAllowed, true)) {
        return true;
    }

    // 2. *.skf.edu.in (https or http)
    $parts = parse_url($normalizedOrigin);
    $host  = strtolower((string)($parts['host'] ?? ''));
    if (
        $host !== '' &&
        (substr($host, -strlen('.skf.edu.in')) === '.skf.edu.in' || $host === 'skf.edu.in')
    ) {
        return true;
    }

    // 3. localhost (any port) for local development
    if ($host === 'localhost' || $host === '127.0.0.1') {
        return true;
    }

    return false;
}

function apply_cors(): void
{
    $config  = require __DIR__ . '/../config/env.php';
    $allowed = $config['cors_allowed_origins'] ?? [];
    $origin  = isset($_SERVER['HTTP_ORIGIN']) ? trim((string)$_SERVER['HTTP_ORIGIN']) : '';

    $normalizedOrigin  = normalize_origin($origin);
    $normalizedAllowed = array_values(array_unique(array_filter(
        array_map(static fn($item) => normalize_origin((string)$item),
            is_array($allowed) ? $allowed : [])
    )));

    if (is_origin_allowed($normalizedOrigin, $normalizedAllowed)) {
        header("Access-Control-Allow-Origin: {$normalizedOrigin}");
    }

    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-SUPERADMIN-TOKEN');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? '')) === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
