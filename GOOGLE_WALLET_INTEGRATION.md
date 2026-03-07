# Google Wallet Integration Guide

## Overview

The Refresko event management system now supports **Google Wallet integration**, allowing students to save their gate passes directly to their Google Wallet app for easy, contactless entry at the event.

## Features

✅ **Digital Gate Pass** - Students can add their gate pass to Google Wallet  
✅ **QR Code Integration** - Gate pass includes scannable QR code with student info  
✅ **Event Ticket Format** - Uses official Google Wallet Event Ticket class  
✅ **Automatic Sync** - Updates are automatically reflected in the wallet  
✅ **Cross-Platform** - Works on Android devices with Google Wallet  

---

## Setup Instructions

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Note your **Project ID**

### Step 2: Enable Google Wallet API

1. In your Google Cloud project, navigate to **APIs & Services** > **Library**
2. Search for **"Google Wallet API"**
3. Click **Enable**

### Step 3: Create Service Account

1. Go to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Enter details:
   - **Name**: `refresko-google-wallet`
   - **Description**: `Service account for Google Wallet pass generation`
4. Click **Create and Continue**
5. Grant the role: **Service Account Token Creator**
6. Click **Done**

### Step 4: Generate Service Account Key

1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **Add Key** > **Create New Key**
4. Choose **JSON** format
5. Download the JSON key file
6. **IMPORTANT**: Keep this file secure and never commit it to version control

### Step 5: Get Issuer ID

1. Go to [Google Pay and Wallet Console](https://pay.google.com/business/console)
2. Sign in with the same Google account
3. Click on your business or create a new business profile
4. Note your **Issuer ID** (format: `BCR2DN5T63I7ZCDU`)

### Step 6: Configure Backend

1. Upload the JSON key file to your server (outside the public directory)
2. Update the configuration file:

**File**: `cpanel_backend_api/config/google_wallet.php`

```php
return [
    // Path to your Google Service Account JSON key file
    'service_account_file' => '/path/to/your/google-wallet-credentials.json',
    
    // Your Google Cloud Project issuer ID
    'issuer_id' => 'BCR2DN5T63I7ZCDU', // Replace with your Issuer ID
    
    // Event details (update with your actual URLs)
    'event_logo_url' => 'https://yourdomain.com/refresko-logo.png',
    'organization_logo_url' => 'https://yourdomain.com/college-logo.png',
];
```

**OR** use environment variables:

```bash
export GOOGLE_WALLET_SERVICE_ACCOUNT_FILE="/path/to/credentials.json"
export GOOGLE_WALLET_ISSUER_ID="BCR2DN5T63I7ZCDU"
```

### Step 7: Upload Logo Images

Upload the following images to your server and update URLs in config:

- **Event Logo** (refresko-logo.png): 660x660 pixels, PNG format
- **Organization Logo** (college-logo.png): 660x660 pixels, PNG format

---

## Usage for Students

### Adding Gate Pass to Google Wallet

1. **Login** to the student dashboard
2. Complete **payment** and wait for admin approval
3. Navigate to the **Gate Pass** section
4. Click the **"Add to Google Wallet"** button
5. A new window will open with Google Wallet
6. Click **"Save"** to add the pass to your wallet

### Viewing the Pass

- Open **Google Wallet** app on your Android phone
- Find the **Refresko 2026** pass
- Tap to view full details and QR code
- Show the QR code at the event entrance for scanning

### Pass Information Displayed

The Google Wallet pass includes:
- **Student Name**
- **Student ID**
- **Department**
- **Year**
- **Pass Code** (unique identifier)
- **QR Code** (for quick scanning)
- **Event Dates**: March 27-28, 2026
- **Venue**: SKF College Campus

---

## API Endpoints

### Generate Google Wallet Pass

**Endpoint**: `GET /google-wallet/generate?student_code=XXX`

**Parameters**:
- `student_code` (required): The student's unique identifier

**Response** (Success):
```json
{
  "success": true,
  "jwt": "eyJhbGciOiJSUzI1...",
  "save_url": "https://pay.google.com/gp/v/save/eyJhbGciOiJSUzI1..."
}
```

**Response** (Error):
```json
{
  "success": false,
  "error": "Gate pass not available. Payment must be approved first."
}
```

### Check Configuration Status

**Endpoint**: `GET /google-wallet/status`

**Response**:
```json
{
  "success": true,
  "configured": true,
  "message": "Google Wallet is properly configured"
}
```

---

## Troubleshooting

### Issue: "Google Wallet is not configured"

**Solution**: 
- Verify the JSON credentials file path is correct
- Ensure the file has proper read permissions
- Check that all required fields are present in the JSON file

### Issue: "Failed to generate pass"

**Solution**:
- Verify Google Wallet API is enabled in Google Cloud Console
- Check service account has correct permissions
- Ensure Issuer ID is correct and active
- Review server error logs for detailed error messages

### Issue: "Gate pass not available"

**Solution**:
- Student payment must be approved by admin first
- Check that `payment_approved = 'approved'` in database
- Verify `gate_pass_created = 1` in database

### Issue: Logo images not showing

**Solution**:
- Ensure logo URLs are publicly accessible (HTTPS required)
- Images must be exactly 660x660 pixels
- Use PNG format with transparent background
- URLs must not redirect

---

## Security Considerations

1. **Never commit** the service account JSON file to version control
2. **Store credentials** outside the public web directory
3. **Use environment variables** for sensitive configuration
4. **Restrict file permissions** on credentials file (chmod 600)
5. **Regularly rotate** service account keys
6. **Monitor API usage** in Google Cloud Console

---

## File Structure

```
cpanel_backend_api/
├── config/
│   └── google_wallet.php          # Configuration file
├── lib/
│   └── google_wallet.php          # Service class
├── routes/
│   └── google_wallet.php          # API routes
└── index.php                       # Main router (updated)

src/
├── lib/
│   └── cpanelApi.js               # Frontend API client (updated)
├── pages/
│   ├── SKFDashboard.jsx           # Dashboard with Google Wallet button
│   └── SKFDashboard.css           # Styles for button
└── ...
```

---

## Testing

### Backend Testing

Test the API endpoint:

```bash
curl "http://yourdomain.com/api/google-wallet/generate?student_code=BTECH/2022/CSE/0001"
```

Check configuration status:

```bash
curl "http://yourdomain.com/api/google-wallet/status"
```

### Frontend Testing

1. Login as a student with approved payment
2. Open browser developer console (F12)
3. Navigate to Gate Pass section
4. Click "Add to Google Wallet"
5. Check console for any errors
6. Verify the Google Wallet page opens

---

## Additional Resources

- [Google Wallet API Documentation](https://developers.google.com/wallet)
- [Event Ticket Class Reference](https://developers.google.com/wallet/tickets/events/use-cases)
- [Google Pay & Wallet Console](https://pay.google.com/business/console)
- [Service Account Authentication](https://cloud.google.com/iam/docs/service-accounts)

---

## Support

For issues or questions:
- Check server error logs at `cpanel_backend_api/error.log`
- Review Google Cloud Console > APIs & Services > Credentials
- Contact: Ankit Rajak (CSE 3rd Year): 7439498461

---

## Version History

### v1.0.0 (March 2026)
- Initial Google Wallet integration
- Event Ticket format implementation
- QR code support
- Student gate pass generation

---

**Last Updated**: March 5, 2026
