# RDP Automation - Free Windows RDP Server Creator

🚀 **Automatically create free Windows RDP servers using GitHub Actions and multiple free tunneling providers!**

This web application provides a fully automated solution to deploy Windows RDP servers without any manual setup or payment requirements. Choose from multiple free tunneling providers and the system will:

1. Create a private GitHub repository
2. Set up GitHub Actions workflow for Windows RDP
3. Configure your chosen tunneling provider (localhost.run, Serveo, Pinggy, or Ngrok)
4. Deploy and provide connection details

## ✨ Features

- **Fully Automated**: No manual repository creation or configuration needed
- **Multiple Free Options**: Choose from localhost.run, Serveo, Pinggy, or Ngrok
- **No Payment Required**: Free tier options available without credit card verification
- **Secure**: Private repositories with encrypted secrets (when needed)
- **User-Friendly**: Step-by-step wizard interface with provider selection
- **Real-time Monitoring**: Live status updates during deployment

## 🛠️ Prerequisites

Before using this application, you need:

1. **GitHub Account** (free)
   - The app uses GitHub OAuth for authentication
   - No manual token creation needed!

2. **Tunneling Provider** (choose one):
   - **Serveo** (free, supports custom subdomains) ⭐ **RECOMMENDED**
   - **Pinggy** (free tier with unlimited bandwidth)
   - **Ngrok** (requires payment verification for TCP endpoints)
   - **localhost.run** (HTTP/HTTPS only - not suitable for RDP)

## 🚀 Getting Started

### For Users

1. Visit the deployed application
2. Click "Sign in with GitHub"
3. Authorize the application
4. **Choose your tunneling provider:**
   - **Serveo** (recommended - free with custom subdomain support)
   - **Pinggy** (free with unlimited bandwidth)
   - **Ngrok** (requires payment verification)
5. Configure your deployment settings
6. Click "Deploy RDP Server"
7. Wait for deployment (2-3 minutes)
8. Get your RDP connection details!

## 🌐 Tunneling Providers

### Serveo ⭐ **RECOMMENDED**
- **Cost**: Free
- **Setup**: No signup required
- **Features**: SSH-based tunneling, custom subdomain support
- **Best for**: Users who want custom subdomains

### Pinggy
- **Cost**: Free tier available
- **Setup**: No signup required for basic use
- **Features**: Unlimited bandwidth, advanced features, UDP support
- **Best for**: Users who need advanced features

### Ngrok
- **Cost**: Requires payment verification (no charges for basic usage)
- **Setup**: Account required, auth token needed
- **Features**: Advanced routing, custom domains, enterprise features
- **Best for**: Production use and advanced requirements

### localhost.run ❌ **NOT SUPPORTED**
- **Cost**: Free
- **Setup**: No signup required
- **Features**: HTTP/HTTPS tunneling only
- **Limitation**: Does not support TCP/RDP connections
- **Best for**: Web applications only (not suitable for RDP)

### For Developers

1. Clone this repository:
```bash
git clone <repository-url>
cd rdp-automation
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

4. Create a GitHub OAuth App:
   - Go to https://github.com/settings/applications/new
   - Set Authorization callback URL to: `http://localhost:3000/api/auth/callback/github`
   - Copy Client ID and Client Secret to `.env.local`

5. Generate NextAuth secret:
```bash
openssl rand -base64 32
```
Add this to `.env.local` as `NEXTAUTH_SECRET`

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

## 🔧 How It Works

1. **Repository Creation**: Creates a private GitHub repository with your specified name
2. **Workflow Setup**: Deploys a GitHub Actions workflow that:
   - Downloads and configures Ngrok
   - Enables Windows Remote Desktop
   - Sets up user credentials (runneradmin/P@ssw0rd!)
   - Creates Ngrok tunnel for RDP access
3. **Secret Management**: Securely stores your Ngrok token as a GitHub secret
4. **Monitoring**: Polls workflow status and extracts connection details

## 📋 RDP Connection Details

Once deployed, you'll receive:
- **Host**: Ngrok tunnel URL (e.g., 0.tcp.ngrok.io:12345)
- **Username**: runneradmin
- **Password**: P@ssw0rd!

## 🔒 Security Notes

- All repositories are created as private
- Tokens are encrypted using GitHub's secret encryption
- No credentials are stored on our servers
- Ngrok tunnels are temporary and session-based

## 🛡️ Limitations

- GitHub Actions free tier: 2,000 minutes/month
- Ngrok free tier: Limited concurrent tunnels
- RDP sessions are temporary (workflow duration)
- Windows Server 2022 environment

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## ⚠️ Disclaimer

This tool is for educational and development purposes. Please ensure you comply with GitHub's and Ngrok's terms of service. Use responsibly and only for legitimate purposes.
