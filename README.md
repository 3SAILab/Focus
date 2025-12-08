# SIGMA - AI Image Generation Desktop Application

SIGMA is a cross-platform desktop application for AI-powered image generation, built with Electron, React, and Go. The application provides a secure, local-first experience with encrypted communication between frontend and backend.

## Features

- 🎨 AI-powered image generation using Google Gemini API
- 🖼️ Image-to-image transformation with reference images
- 📐 Multiple aspect ratios and quality settings
- 📜 Generation history with detailed tracking
- 🔒 Secure local HTTPS communication with self-signed certificates
- 🖥️ Cross-platform support (Windows, macOS, Linux)
- 💾 Local data storage with SQLite

## Architecture

SIGMA uses a three-tier architecture:

1. **Electron Container**: Manages application lifecycle, window management, and IPC communication
2. **React Frontend**: User interface built with React 19, TypeScript, and TailwindCSS
3. **Go Backend**: RESTful API server with Gin framework, providing HTTPS endpoints

### Technology Stack

**Frontend**
- React 19.x + TypeScript 5.x
- Vite 7.x (build tool)
- TailwindCSS 4.x (styling)
- Axios (HTTP client)

**Backend**
- Go 1.21+
- Gin Web Framework
- GORM + SQLite (database)
- crypto/tls (HTTPS support)

**Desktop**
- Electron 33.x
- electron-builder 25.x (packaging)

## Prerequisites

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Go** 1.21 or higher
- **Git**

### Platform-Specific Requirements

**Windows**
- Windows 10 or higher
- Command Prompt or PowerShell

**macOS**
- macOS 10.15 (Catalina) or higher
- Xcode Command Line Tools

**Linux**
- Common build tools (gcc, make)
- FUSE (for running AppImage)

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd sigma
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure API Key

The application requires a Google Gemini API key. You can set it:

- Through the application UI (recommended for end users)
- Via environment variable: `GEMINI_API_KEY=your_key_here`
- In `backend/.env` file

### 4. Run in Development Mode

```bash
npm run dev
```

This will:
- Start the Vite development server for the frontend
- Launch the Go backend with hot reload
- Open the Electron application with DevTools enabled

## Development

### Project Structure

```
sigma/
├── electron/           # Electron main process and preload scripts
│   ├── main.js        # Main process entry point
│   ├── preload.js     # Preload script for secure IPC
│   └── tls-manager.js # TLS certificate management
├── frontend/          # React frontend application
│   ├── src/
│   │   ├── api/       # API client
│   │   ├── components/# React components
│   │   ├── views/     # Page views
│   │   └── types/     # TypeScript definitions
│   └── dist/          # Built frontend (generated)
├── backend/           # Go backend server
│   ├── main.go        # Server entry point
│   ├── handlers/      # HTTP handlers
│   ├── models/        # Database models
│   ├── config/        # Configuration
│   └── server/        # TLS server setup
├── assets/            # Application icons
└── dist/              # Build output (generated)
```

### Development Scripts

```bash
# Run in development mode
npm run dev

# Build frontend only
npm run build:frontend

# Build backend only (Windows)
npm run build:backend:win

# Build backend only (macOS)
npm run build:backend:mac

# Build backend only (Linux)
npm run build:backend:linux

# Build everything
npm run build

# Package Electron app
npm run build:electron

# Run tests
npm test
```

### Frontend Development

The frontend uses Vite for fast development with hot module replacement:

```bash
cd frontend
npm install
npm run dev
```

Access the frontend at `http://localhost:5173` (or the port shown in terminal).

### Backend Development

The backend is a Go application that can be run standalone:

```bash
cd backend
go run main.go
```

The backend will start on `https://localhost:8080` with auto-generated TLS certificates.

### Testing

**Frontend Tests**
```bash
cd frontend
npm test
```

**Backend Tests**
```bash
cd backend
go test ./...
```

**Electron Tests**
```bash
npm test
```

## Building and Packaging

For detailed build instructions, see [BUILD.md](BUILD.md).

### Quick Build

```bash
# Build for current platform
npm run build

# Output will be in the 'release' directory
```

### Platform-Specific Builds

**Windows**
```bash
npm run build:backend:win
npm run build:electron
# Output: release/SIGMA Setup 1.0.0.exe
```

**macOS**
```bash
npm run build:backend:mac
npm run build:electron
# Output: release/SIGMA-1.0.0.dmg
```

**Linux**
```bash
npm run build:backend:linux
npm run build:electron
# Output: release/SIGMA-1.0.0.AppImage
```

## Configuration

### Application Icons

Replace the placeholder icons in the `assets/` directory with your own:

- `assets/icon.ico` (Windows)
- `assets/icon.icns` (macOS)
- `assets/icon.png` (Linux)

See [assets/README.md](assets/README.md) for detailed icon preparation instructions.

### Application Metadata

Edit `package.json` to customize:

```json
{
  "name": "your-app-name",
  "version": "1.0.0",
  "description": "Your app description",
  "build": {
    "appId": "com.yourcompany.yourapp",
    "productName": "Your App Name"
  }
}
```

### Backend Configuration

Backend configuration is managed through environment variables:

- `PORT`: Backend server port (default: 8080)
- `GEMINI_API_KEY`: Google Gemini API key
- `DB_PATH`: Database file path (auto-configured in production)
- `UPLOAD_DIR`: Upload directory path (auto-configured in production)
- `OUTPUT_DIR`: Output directory path (auto-configured in production)
- `TLS_CERT_FILE`: TLS certificate path (auto-generated)
- `TLS_KEY_FILE`: TLS key path (auto-generated)

## Security

### Local HTTPS Communication

SIGMA uses HTTPS for all frontend-backend communication, even though it's local:

- Self-signed TLS certificates are automatically generated on first run
- Certificates are stored in the user data directory
- Frontend trusts the local certificates automatically
- This prevents local network sniffing of sensitive data (API keys, prompts)

### Data Storage

All user data is stored locally:

- **Windows**: `%APPDATA%\SIGMA`
- **macOS**: `~/Library/Application Support/SIGMA`
- **Linux**: `~/.config/SIGMA`

This includes:
- SQLite database (`history.db`)
- Uploaded images (`uploads/`)
- Generated images (`output/`)
- TLS certificates (`certs/`)

### API Key Security

- API keys are never hardcoded in the application
- Keys are stored in the backend configuration
- Communication is encrypted via HTTPS
- Keys are not exposed to the renderer process

## Troubleshooting

### Application Won't Start

1. Check if port 8080 is available
2. Look for error logs in the console
3. Try deleting the user data directory and restarting
4. Ensure all dependencies are installed: `npm install`

### Backend Connection Errors

1. Check if the backend process is running (Task Manager/Activity Monitor)
2. Verify TLS certificates exist in the user data directory
3. Try regenerating certificates by deleting the `certs/` folder
4. Check firewall settings

### Build Failures

1. Ensure all prerequisites are installed (Node.js, Go, etc.)
2. Clear build cache: `rm -rf dist release`
3. Reinstall dependencies: `npm install`
4. Check [BUILD.md](BUILD.md) for platform-specific issues

### Icon Not Showing

1. Verify icon files exist in `assets/` directory
2. Clear build cache and rebuild
3. On macOS, clear icon cache: `sudo rm -rf /Library/Caches/com.apple.iconservices.store`

For more troubleshooting tips, see [BUILD.md](BUILD.md#常见问题).

## Development Mode

The application supports two modes:

### Development Mode

- Connects to Vite dev server for hot reload
- DevTools enabled by default
- Backend runs with verbose logging
- Useful for rapid development

Enable with:
```bash
npm run dev
```

### Production Mode

- Loads built frontend from `frontend/dist`
- DevTools disabled
- Optimized performance
- Used in packaged applications

See [DEVELOPMENT_MODE.md](DEVELOPMENT_MODE.md) for more details.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit your changes: `git commit -am 'Add new feature'`
6. Push to the branch: `git push origin feature/my-feature`
7. Submit a pull request

### Code Style

- **Frontend**: Follow ESLint configuration
- **Backend**: Follow Go standard formatting (`go fmt`)
- **Commits**: Use conventional commit messages

## License

[Your License Here]

## Acknowledgments

- [Electron](https://www.electronjs.org/) - Desktop application framework
- [React](https://react.dev/) - Frontend UI library
- [Go](https://go.dev/) - Backend programming language
- [Gin](https://gin-gonic.com/) - Go web framework
- [Google Gemini](https://ai.google.dev/) - AI image generation API

## Support

For issues, questions, or contributions:

- 📧 Email: [your-email@example.com]
- 🐛 Issues: [GitHub Issues](https://github.com/your-repo/issues)
- 📖 Documentation: [Wiki](https://github.com/your-repo/wiki)

---

**Built with ❤️ using Electron, React, and Go**
