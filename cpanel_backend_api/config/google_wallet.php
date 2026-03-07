<?php

/**
 * Google Wallet API Configuration
 * 
 * Setup Instructions:
 * 1. Go to https://console.cloud.google.com
 * 2. Enable Google Wallet API
 * 3. Create a Service Account
 * 4. Download the JSON key file
 * 5. Save the key file path in the GOOGLE_WALLET_SERVICE_ACCOUNT_FILE environment variable
 */

$issuerIdFromEnv = trim((string)(getenv('GOOGLE_WALLET_ISSUER_ID') ?: ''));
$issuerId = preg_match('/^\d{6,}$/', $issuerIdFromEnv) === 1
    ? $issuerIdFromEnv
    : '3388000000023092006';

return [
    // Path to your Google Service Account JSON key file
    // File is located in the API root directory
    'service_account_file' => getenv('GOOGLE_WALLET_SERVICE_ACCOUNT_FILE') ?: __DIR__ . '/../google-wallet-credentials.json',
    
    // Your Google Wallet Issuer ID (must be numeric, e.g. 3388000000012345678)
    'issuer_id' => $issuerId,
    
    // Your Google Cloud Project issuer email (from the JSON credentials file)
    'issuer_email' => getenv('GOOGLE_WALLET_ISSUER_EMAIL') ?: 'refresko-google-wallet@your-project.iam.gserviceaccount.com',
    
    // Class ID suffix for event tickets (final class ID = <issuer_id>.<class_id>)
    'class_id' => 'refresko_26_event_ticket_v1',
    
    // API endpoints
    'api_base_url' => 'https://walletobjects.googleapis.com/walletobjects/v1',
    
    // Event details
    'event_name' => "Refresko '26",
    'event_venue_name' => 'SKF College Campus',
    'event_venue_address' => '1 Khan Road, Mankundu, Chandannagar, West Bengal, India',
    'event_start_datetime' => '2026-03-27T09:00:00+05:30',
    'event_end_datetime' => '2026-03-28T22:00:00+05:30',
    'event_venue' => 'SKF, 1 Khan Road, Mankundu, Chandannagar, West Bengal',
    'event_dates' => 'March 27-28, 2026',
    'event_logo_url' => 'https://refresko.skf.edu.in/refresko.png',
    
    // Organization details
    'organization_name' => 'Refresko',
    'organization_logo_url' => 'https://refresko.skf.edu.in/refresko.png',
];
