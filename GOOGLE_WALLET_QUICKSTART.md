# Quick Start: Google Wallet Integration

Get Google Wallet integration up and running in 10 minutes!

## Prerequisites
- Google Cloud account
- Admin access to Refresko backend
- Server with PHP support

## Step 1: Google Cloud Setup (5 minutes)

### Create Project & Service Account
```bash
# 1. Go to: https://console.cloud.google.com
# 2. Create new project: "Refresko-Wallet"
# 3. Enable Google Wallet API
# 4. Create Service Account
# 5. Download JSON credentials
```

### Get Issuer ID
```bash
# 1. Go to: https://pay.google.com/business/console
# 2. Create or select business profile
# 3. Copy your Issuer ID (format: BCR2DN5T63I7ZCDU)
```

## Step 2: Backend Configuration (3 minutes)

### Upload Credentials
```bash
# Upload JSON file to server (outside public folder)
scp google-wallet-credentials.json user@server:/var/credentials/
```

### Update Configuration

Edit: `cpanel_backend_api/config/google_wallet.php`

```php
return [
    'service_account_file' => '/var/credentials/google-wallet-credentials.json',
    'issuer_id' => 'BCR2DN5T63I7ZCDU', // YOUR ISSUER ID HERE
    'event_logo_url' => 'https://yourdomain.com/refresko-logo.png',
    'organization_logo_url' => 'https://yourdomain.com/college-logo.png',
];
```

## Step 3: Upload Logo Images (2 minutes)

Required images (660x660 PNG):
- `refresko-logo.png`
- `college-logo.png`

Upload to your domain and update URLs in config.

## Step 4: Test (2 minutes)

### Test Backend
```bash
curl "https://yourdomain.com/api/google-wallet/status"
```

Expected:
```json
{
  "success": true,
  "configured": true,
  "message": "Google Wallet is properly configured"
}
```

### Test Frontend
1. Login as student with approved payment
2. Go to Gate Pass section
3. Click "Add to Google Wallet"
4. Should open Google Wallet save page

## Troubleshooting Common Issues

### "Not configured" error
- Check JSON file path
- Verify file permissions: `chmod 600 credentials.json`
- Ensure issuer_id is correct

### "Failed to generate" error
- Verify Google Wallet API is enabled
- Check service account has correct permissions
- Review error logs

### Button not showing
- Clear browser cache
- Check payment is approved
- Verify gate_pass_created = 1 in database

## Files Created/Modified

✅ `cpanel_backend_api/config/google_wallet.php` - Configuration  
✅ `cpanel_backend_api/lib/google_wallet.php` - Service class  
✅ `cpanel_backend_api/routes/google_wallet.php` - API routes  
✅ `cpanel_backend_api/index.php` - Routes added  
✅ `src/lib/cpanelApi.js` - Frontend API methods  
✅ `src/pages/SKFDashboard.jsx` - Google Wallet button  
✅ `src/pages/SKFDashboard.css` - Button styles  

## Security Reminder

⚠️ **NEVER** commit `google-wallet-credentials.json` to git!

Add to `.gitignore`:
```
google-wallet-credentials.json
*-credentials.json
```

## Next Steps

1. Test with multiple students
2. Monitor API usage in Google Cloud Console
3. Set up key rotation schedule
4. Train staff on QR code scanning

## Support

Need help? Check the detailed guide: `GOOGLE_WALLET_INTEGRATION.md`

---

**Ready to go!** Students can now add their gate passes to Google Wallet! 🎉
