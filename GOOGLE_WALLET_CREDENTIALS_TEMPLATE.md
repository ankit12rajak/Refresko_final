# Google Wallet Credentials Template

**IMPORTANT**: This is a template. Replace all values with your actual credentials from Google Cloud Console.

## DO NOT COMMIT THIS FILE TO VERSION CONTROL

Add this file to `.gitignore`:
```
google-wallet-credentials.json
*.json
```

## credentials.json Structure

Save this file as `google-wallet-credentials.json` on your server:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "your-private-key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com"
}
```

## How to Get This File

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Navigate to **IAM & Admin** > **Service Accounts**
4. Click on your service account
5. Go to **Keys** tab
6. Click **Add Key** > **Create New Key**
7. Choose **JSON** format
8. Download the file

## Configuration

After downloading the file:

1. Upload it to your server (outside public directory)
2. Set proper permissions:
   ```bash
   chmod 600 google-wallet-credentials.json
   ```
3. Update the path in `cpanel_backend_api/config/google_wallet.php`
4. Or set environment variable:
   ```bash
   export GOOGLE_WALLET_SERVICE_ACCOUNT_FILE="/path/to/google-wallet-credentials.json"
   ```

## Security Checklist

- [ ] File stored outside public web directory
- [ ] File permissions set to 600 (read/write owner only)
- [ ] File path added to `.gitignore`
- [ ] Environment variable set (optional)
- [ ] Backup stored securely
- [ ] Regular key rotation scheduled

## Testing

Test if credentials are loaded correctly:

```bash
curl http://refresko.skf.edu.in/api/google-wallet/status
```

Expected response:
```json
{
  "success": true,
  "configured": true,
  "message": "Google Wallet is properly configured"
}
```
