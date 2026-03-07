<?php

/**
 * Google Wallet API Integration Library
 * Handles creating and managing event ticket passes in Google Wallet
 */

class GoogleWalletService
{
    private $config;
    private $credentials;
    private $issuerId;
    private $lastError = '';
    
    public function __construct()
    {
        $this->config = require __DIR__ . '/../config/google_wallet.php';
        $this->loadCredentials();
    }
    
    /**
     * Load service account credentials from JSON file
     */
    private function loadCredentials(): void
    {
        $credFile = $this->config['service_account_file'];
        
        if (!file_exists($credFile)) {
            $this->setError("Google Wallet credentials file not found: {$credFile}");
            $this->credentials = null;
            return;
        }
        
        $json = file_get_contents($credFile);
        $this->credentials = json_decode($json, true);
        
        if (!$this->credentials) {
            $this->setError('Failed to parse Google Wallet credentials JSON');
            $this->credentials = null;
            return;
        }

        if (empty($this->credentials['client_email']) || empty($this->credentials['private_key'])) {
            $this->setError('Google Wallet credentials JSON is missing required keys (client_email/private_key)');
            $this->credentials = null;
            return;
        }
        
        // Extract issuer ID from service account email if not configured
        if (empty($this->config['issuer_id']) && isset($this->credentials['client_email'])) {
            // Extract numeric ID from email format: service-account@project-id-123456.iam.gserviceaccount.com
            if (preg_match('/(\d{3,})/', $this->credentials['client_email'], $matches)) {
                $this->issuerId = $matches[1];
            }
        } else {
            $this->issuerId = $this->config['issuer_id'];
        }

        $this->issuerId = trim((string)$this->issuerId);
        if ($this->issuerId === '' || !preg_match('/^\d{6,}$/', $this->issuerId)) {
            $this->setError('Invalid Google Wallet issuer_id. It must be numeric (example: 3388000000012345678).');
        }
    }
    
    /**
     * Check if Google Wallet is properly configured
     */
    public function isConfigured(): bool
    {
        return $this->credentials !== null && !empty($this->issuerId) && preg_match('/^\d{6,}$/', $this->issuerId) === 1;
    }

    public function getLastError(): string
    {
        return $this->lastError;
    }

    private function setError(string $message): void
    {
        $this->lastError = $message;
        error_log($message);
    }
    
    /**
     * Generate JWT token for authentication
     */
    private function generateJWT(): ?string
    {
        if (!$this->isConfigured()) {
            if ($this->lastError === '') {
                $this->setError('Google Wallet is not configured correctly');
            }
            return null;
        }
        
        $now = time();
        $expiration = $now + 3600; // 1 hour
        
        $header = [
            'alg' => 'RS256',
            'typ' => 'JWT'
        ];
        
        $payload = [
            'iss' => $this->credentials['client_email'],
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $expiration,
            'scope' => 'https://www.googleapis.com/auth/wallet_object.issuer'
        ];
        
        $headerEncoded = $this->base64UrlEncode(json_encode($header));
        $payloadEncoded = $this->base64UrlEncode(json_encode($payload));
        
        $signatureInput = "{$headerEncoded}.{$payloadEncoded}";
        
        $privateKey = openssl_pkey_get_private($this->credentials['private_key']);
        if (!$privateKey) {
            $this->setError('Failed to load private key for JWT signing');
            return null;
        }
        
        openssl_sign($signatureInput, $signature, $privateKey, OPENSSL_ALGO_SHA256);
        openssl_free_key($privateKey);
        
        $signatureEncoded = $this->base64UrlEncode($signature);
        
        return "{$signatureInput}.{$signatureEncoded}";
    }
    
    /**
     * Get access token from Google OAuth
     */
    private function getAccessToken(): ?string
    {
        $jwt = $this->generateJWT();
        if (!$jwt) {
            return null;
        }
        
        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query([
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $jwt
            ]),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/x-www-form-urlencoded'
            ]
        ]);
        
        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false) {
            $this->setError('Google OAuth token request failed: ' . $curlError);
            return null;
        }
        
        if ($httpCode !== 200) {
            $this->setError("Failed to get access token. HTTP {$httpCode}: {$this->extractApiError($response)}");
            return null;
        }
        
        $data = json_decode($response, true);
        return $data['access_token'] ?? null;
    }
    
    /**
     * Create or update event ticket class
     */
    public function createOrUpdateClass(): bool
    {
        if (!$this->isConfigured()) {
            if ($this->lastError === '') {
                $this->setError('Google Wallet is not configured');
            }
            return false;
        }
        
        $accessToken = $this->getAccessToken();
        if (!$accessToken) {
            return false;
        }
        
        $classId = "{$this->issuerId}.{$this->sanitizeIdentifierSegment($this->config['class_id'])}";
        
        $venueName = trim((string)($this->config['event_venue_name'] ?? $this->config['event_venue'] ?? ''));
        $venueAddress = trim((string)($this->config['event_venue_address'] ?? ''));
        $startDateTime = trim((string)($this->config['event_start_datetime'] ?? '2026-03-27T09:00:00+05:30'));
        $endDateTime = trim((string)($this->config['event_end_datetime'] ?? '2026-03-28T22:00:00+05:30'));

        $classData = [
            'id' => $classId,
            'issuerName' => $this->config['organization_name'],
            'eventName' => [
                'defaultValue' => [
                    'language' => 'en-US',
                    'value' => $this->config['event_name']
                ]
            ],
            'dateTime' => [
                'start' => $startDateTime,
                'end' => $endDateTime
            ],
            'reviewStatus' => 'UNDER_REVIEW',
            'hexBackgroundColor' => '#4285f4'
        ];

        // Google requires either place_id or both venue name and address.
        if ($venueName !== '' && $venueAddress !== '') {
            $classData['venue'] = [
                'name' => [
                    'defaultValue' => [
                        'language' => 'en-US',
                        'value' => $venueName
                    ]
                ],
                'address' => [
                    'defaultValue' => [
                        'language' => 'en-US',
                        'value' => $venueAddress
                    ]
                ]
            ];
        }

        // Optional images should only be sent when they are valid public HTTPS URLs.
        if ($this->isValidImageUrl($this->config['organization_logo_url'] ?? '')) {
            $classData['logo'] = [
                'sourceUri' => [
                    'uri' => $this->config['organization_logo_url']
                ]
            ];
        }

        if ($this->isValidImageUrl($this->config['event_logo_url'] ?? '')) {
            $classData['heroImage'] = [
                'sourceUri' => [
                    'uri' => $this->config['event_logo_url']
                ]
            ];
        }
        
        // Try to get existing class first
        $url = "{$this->config['api_base_url']}/eventTicketClass/{$classId}";
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                "Authorization: Bearer {$accessToken}",
                'Content-Type: application/json'
            ]
        ]);
        
        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false) {
            $this->setError('Failed to query existing Google Wallet class: ' . $curlError);
            return false;
        }
        
        // If class already exists, treat this as initialized.
        // Updating an approved/active class can fail due immutable fields and reviewStatus rules.
        if ($httpCode >= 200 && $httpCode < 300) {
            return true;
        }

        // Fall back to create when lookup is blocked by permissions/intermittent errors.
        // If class already exists, Google returns 409 which we treat as success.
        $url = "{$this->config['api_base_url']}/eventTicketClass";

        // Create class only when it does not exist.
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($classData),
            CURLOPT_HTTPHEADER => [
                "Authorization: Bearer {$accessToken}",
                'Content-Type: application/json'
            ]
        ]);
        
        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false) {
            $this->setError('Failed to create/update class (network): ' . $curlError);
            return false;
        }

        if ($httpCode === 409) {
            return true;
        }

        if ($this->isPermissionDeniedResponse($httpCode, $response)) {
            // Some issuer setups allow Save-to-Wallet JWT but block REST class mutation.
            // Continue and let object creation/JWT flow proceed.
            return true;
        }
        
        if ($httpCode < 200 || $httpCode >= 300) {
            $this->setError("Failed to create/update class. HTTP {$httpCode}: {$this->extractApiError($response)}");
            return false;
        }
        
        return true;
    }
    
    /**
     * Create a gate pass for a student
     */
    public function createGatePass(array $studentData): ?string
    {
        if (!$this->isConfigured()) {
            if ($this->lastError === '') {
                $this->setError('Google Wallet is not configured');
            }
            return null;
        }
        
        $accessToken = $this->getAccessToken();
        if (!$accessToken) {
            return null;
        }
        
        $classId = "{$this->issuerId}.{$this->sanitizeIdentifierSegment($this->config['class_id'])}";
        $objectId = "{$this->issuerId}.{$this->sanitizeIdentifierSegment((string)$studentData['student_code'])}";
        
        $objectData = [
            'id' => $objectId,
            'classId' => $classId,
            'state' => 'ACTIVE',
            'barcode' => [
                'type' => 'QR_CODE',
                'value' => json_encode([
                    'studentId' => $studentData['student_code'],
                    'name' => $studentData['name'],
                    'department' => $studentData['department'] ?? '',
                    'year' => $studentData['year'] ?? '',
                    'passCode' => "SKF-PASS-{$studentData['student_code']}-REFRESKO2026",
                    'event' => 'Refresko 2026'
                ])
            ],
            'ticketHolderName' => $studentData['name'],
            'ticketNumber' => $studentData['student_code'],
            'seatInfo' => [
                'seat' => [
                    'defaultValue' => [
                        'language' => 'en-US',
                        'value' => $studentData['department'] ?? 'General'
                    ]
                ],
                'row' => [
                    'defaultValue' => [
                        'language' => 'en-US',
                        'value' => $studentData['year'] ?? ''
                    ]
                ]
            ],
            'textModulesData' => [
                [
                    'header' => 'Student ID',
                    'body' => $studentData['student_code'],
                    'id' => 'student_id'
                ],
                [
                    'header' => 'Department',
                    'body' => $studentData['department'] ?? 'N/A',
                    'id' => 'department'
                ],
                [
                    'header' => 'Year',
                    'body' => $studentData['year'] ?? 'N/A',
                    'id' => 'year'
                ],
                [
                    'header' => 'Valid For',
                    'body' => 'All Days - March 27th & 28th, 2026',
                    'id' => 'validity'
                ]
            ]
        ];
        
        // Check if object already exists
        $url = "{$this->config['api_base_url']}/eventTicketObject/{$objectId}";
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                "Authorization: Bearer {$accessToken}",
                'Content-Type: application/json'
            ]
        ]);
        
        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false) {
            $this->setError('Failed to query existing Google Wallet object: ' . $curlError);
            return null;
        }
        
        // If object already exists, skip update and return a new Save-to-Wallet JWT.
        if ($httpCode >= 200 && $httpCode < 300) {
            return $this->generateAddToWalletJWT($objectId);
        }

        // Fall back to POST creation for both missing and lookup-failed cases.
        // This helps when object lookup is forbidden but create still works.
        $url = "{$this->config['api_base_url']}/eventTicketObject";

        // Create the object
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($objectData),
            CURLOPT_HTTPHEADER => [
                "Authorization: Bearer {$accessToken}",
                'Content-Type: application/json'
            ]
        ]);
        
        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false) {
            $this->setError('Failed to create/update gate pass object (network): ' . $curlError);
            return null;
        }

        // Object already exists - continue with JWT generation.
        if ($httpCode === 409) {
            return $this->generateAddToWalletJWT($objectId);
        }

        if ($this->isPermissionDeniedResponse($httpCode, $response)) {
            // Fallback: include a full object in the JWT so Google Wallet can create
            // it at save time when REST object APIs are not permitted for this account.
            return $this->generateAddToWalletJWT($objectId, $objectData);
        }
        
        if ($httpCode < 200 || $httpCode >= 300) {
            $this->setError("Failed to create gate pass object. HTTP {$httpCode}: {$this->extractApiError($response)}");
            return null;
        }
        
        // Generate "Add to Google Wallet" JWT
        return $this->generateAddToWalletJWT($objectId);
    }
    
    /**
     * Generate JWT for "Add to Google Wallet" button
     */
    private function generateAddToWalletJWT(string $objectId, ?array $objectData = null): ?string
    {
        if (!$this->isConfigured()) {
            if ($this->lastError === '') {
                $this->setError('Google Wallet is not configured');
            }
            return null;
        }
        
        $now = time();
        
        $header = [
            'alg' => 'RS256',
            'typ' => 'JWT'
        ];
        
        $walletObjectsPayload = $objectData !== null
            ? [$objectData]
            : [[ 'id' => $objectId ]];

        $payload = [
            'iss' => $this->credentials['client_email'],
            'aud' => 'google',
            'typ' => 'savetowallet',
            'iat' => $now,
            'origins' => [], // Add your domain here if needed
            'payload' => [
                'eventTicketObjects' => $walletObjectsPayload
            ]
        ];
        
        $headerEncoded = $this->base64UrlEncode(json_encode($header));
        $payloadEncoded = $this->base64UrlEncode(json_encode($payload));
        
        $signatureInput = "{$headerEncoded}.{$payloadEncoded}";
        
        $privateKey = openssl_pkey_get_private($this->credentials['private_key']);
        if (!$privateKey) {
            $this->setError('Failed to load private key for JWT signing');
            return null;
        }
        
        openssl_sign($signatureInput, $signature, $privateKey, OPENSSL_ALGO_SHA256);
        openssl_free_key($privateKey);
        
        $signatureEncoded = $this->base64UrlEncode($signature);
        
        return "{$signatureInput}.{$signatureEncoded}";
    }
    
    /**
     * Base64 URL encode
     */
    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function sanitizeIdentifierSegment(string $value): string
    {
        $sanitized = preg_replace('/[^A-Za-z0-9._-]/', '_', trim($value));
        return $sanitized === '' ? 'default' : $sanitized;
    }

    private function isValidImageUrl(string $url): bool
    {
        $trimmed = trim($url);
        if ($trimmed === '') {
            return false;
        }

        if (stripos($trimmed, 'https://') !== 0) {
            return false;
        }

        if (stripos($trimmed, 'yourdomain.com') !== false) {
            return false;
        }

        return filter_var($trimmed, FILTER_VALIDATE_URL) !== false;
    }

    private function extractApiError(string $response): string
    {
        $decoded = json_decode($response, true);
        $message = $decoded['error']['message'] ?? null;
        if (is_string($message) && trim($message) !== '') {
            return $message;
        }

        return $response;
    }

    private function isPermissionDeniedResponse(int $httpCode, string $response): bool
    {
        if ($httpCode !== 403) {
            return false;
        }

        $errorText = strtolower($this->extractApiError($response));
        return strpos($errorText, 'permission denied') !== false
            || strpos($errorText, 'insufficient permissions') !== false
            || strpos($errorText, 'forbidden') !== false;
    }
}
