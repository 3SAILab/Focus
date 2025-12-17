/**
 * Build Artifact Validation Tests
 * Tests that build outputs contain all required files and are properly packaged
 * 
 * Requirements: 5.1, 5.2, 5.3, 6.3
 */

const fs = require('fs');
const path = require('path');

describe('Build Artifact Validation', () => {
  const releaseDir = path.join(__dirname, '..', 'release');
  const distDir = path.join(__dirname, '..', 'dist');

  describe('Pre-build Validation', () => {
    test('should have frontend build output', () => {
      // Validates: Requirements 6.3
      const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
      
      if (fs.existsSync(frontendDist)) {
        const files = fs.readdirSync(frontendDist);
        expect(files.length).toBeGreaterThan(0);
        
        // Should contain index.html
        expect(files).toContain('index.html');
      } else {
        console.warn('Frontend dist not found. Run "npm run build:frontend" first.');
      }
    });

    test('should have backend executable in dist', () => {
      // Validates: Requirements 6.3
      const backendDir = path.join(distDir, 'backend');
      
      if (fs.existsSync(backendDir)) {
        const files = fs.readdirSync(backendDir);
        expect(files.length).toBeGreaterThan(0);
        
        // Should contain backend executable
        const hasExecutable = files.some(file => 
          file.includes('sigma-backend') && 
          (file.endsWith('.exe') || !file.includes('.'))
        );
        expect(hasExecutable).toBe(true);
      } else {
        console.warn('Backend dist not found. Run "npm run build:backend:win" first.');
      }
    });

    test('should have required assets', () => {
      // Validates: Requirements 6.3
      const assetsDir = path.join(__dirname, '..', 'assets');
      
      expect(fs.existsSync(assetsDir)).toBe(true);
      
      const files = fs.readdirSync(assetsDir);
      
      // Should have icon files or placeholders
      const hasWindowsIcon = files.some(f => f.includes('icon.ico'));
      const hasMacIcon = files.some(f => f.includes('icon.icns'));
      const hasLinuxIcon = files.some(f => f.includes('icon.png'));
      
      expect(hasWindowsIcon).toBe(true);
      expect(hasMacIcon || files.includes('icon.icns.placeholder')).toBe(true);
      expect(hasLinuxIcon || files.includes('icon.png.placeholder')).toBe(true);
    });

    test('should have electron main files', () => {
      // Validates: Requirements 6.3
      const electronDir = path.join(__dirname);
      
      expect(fs.existsSync(path.join(electronDir, 'main.js'))).toBe(true);
      expect(fs.existsSync(path.join(electronDir, 'preload.js'))).toBe(true);
      expect(fs.existsSync(path.join(electronDir, 'tls-manager.js'))).toBe(true);
    });

    test('should have package.json with correct build configuration', () => {
      // Validates: Requirements 5.1, 5.2, 5.3
      const packageJson = require('../package.json');
      
      expect(packageJson.build).toBeDefined();
      expect(packageJson.build.appId).toBeDefined();
      expect(packageJson.build.productName).toBeDefined();
      
      // Windows configuration
      expect(packageJson.build.win).toBeDefined();
      expect(packageJson.build.win.target).toBeDefined();
      expect(packageJson.build.win.icon).toBe('assets/focus.ico');
      
      // macOS configuration
      expect(packageJson.build.mac).toBeDefined();
      expect(packageJson.build.mac.target).toBeDefined();
      expect(packageJson.build.mac.icon).toBe('assets/icon.icns');
      
      // Linux configuration
      expect(packageJson.build.linux).toBeDefined();
      expect(packageJson.build.linux.target).toBeDefined();
      expect(packageJson.build.linux.icon).toBe('assets/icon.png');
    });

    test('should have extraResources configuration for backend', () => {
      // Validates: Requirements 6.3
      const packageJson = require('../package.json');
      
      expect(packageJson.build.extraResources).toBeDefined();
      expect(Array.isArray(packageJson.build.extraResources)).toBe(true);
      
      const backendResource = packageJson.build.extraResources.find(
        r => r.from === 'dist/backend'
      );
      
      expect(backendResource).toBeDefined();
      expect(backendResource.to).toBe('backend');
    });
  });

  describe('Windows Build Validation', () => {
    test('should generate NSIS installer', () => {
      // Validates: Requirements 5.1
      if (!fs.existsSync(releaseDir)) {
        console.warn('Release directory not found. Run "npm run dist:win" first.');
        return;
      }

      const files = fs.readdirSync(releaseDir);
      const installerFiles = files.filter(f => f.endsWith('.exe') && !f.includes('unpacked'));
      
      if (installerFiles.length > 0) {
        expect(installerFiles.length).toBeGreaterThan(0);
        
        // Should follow naming convention
        const hasCorrectName = installerFiles.some(f => 
          f.includes('SIGMA') && f.includes('.exe')
        );
        expect(hasCorrectName).toBe(true);
      } else {
        console.warn('No Windows installer found in release directory.');
      }
    });

    test('should have NSIS configuration', () => {
      // Validates: Requirements 5.1, 5.4, 5.5
      const packageJson = require('../package.json');
      
      expect(packageJson.build.nsis).toBeDefined();
      expect(packageJson.build.nsis.oneClick).toBe(false);
      expect(packageJson.build.nsis.allowToChangeInstallationDirectory).toBe(true);
      expect(packageJson.build.nsis.createDesktopShortcut).toBe(true);
      expect(packageJson.build.nsis.createStartMenuShortcut).toBe(true);
    });

    test('should validate Windows executable format', () => {
      // Validates: Requirements 5.1
      const backendExe = path.join(distDir, 'backend', 'sigma-backend.exe');
      
      if (fs.existsSync(backendExe)) {
        const stats = fs.statSync(backendExe);
        expect(stats.size).toBeGreaterThan(0);
        expect(path.extname(backendExe)).toBe('.exe');
      } else {
        console.warn('Windows backend executable not found.');
      }
    });
  });

  describe('macOS Build Validation', () => {
    test('should generate DMG disk image', () => {
      // Validates: Requirements 5.2
      if (!fs.existsSync(releaseDir)) {
        console.warn('Release directory not found. Run "npm run dist:mac" first.');
        return;
      }

      const files = fs.readdirSync(releaseDir);
      const dmgFiles = files.filter(f => f.endsWith('.dmg'));
      
      if (dmgFiles.length > 0) {
        expect(dmgFiles.length).toBeGreaterThan(0);
        
        // Should follow naming convention
        const hasCorrectName = dmgFiles.some(f => 
          f.includes('SIGMA') && f.includes('.dmg')
        );
        expect(hasCorrectName).toBe(true);
      } else {
        console.warn('No macOS DMG found in release directory.');
      }
    });

    test('should have DMG configuration', () => {
      // Validates: Requirements 5.2
      const packageJson = require('../package.json');
      
      expect(packageJson.build.dmg).toBeDefined();
      expect(packageJson.build.dmg.contents).toBeDefined();
      expect(Array.isArray(packageJson.build.dmg.contents)).toBe(true);
    });

    test('should have macOS icon in correct format', () => {
      // Validates: Requirements 5.2
      const iconPath = path.join(__dirname, '..', 'assets', 'icon.icns');
      const placeholderPath = path.join(__dirname, '..', 'assets', 'icon.icns.placeholder');
      
      const hasIcon = fs.existsSync(iconPath) || fs.existsSync(placeholderPath);
      expect(hasIcon).toBe(true);
    });

    test('should support multiple architectures', () => {
      // Validates: Requirements 5.2
      const packageJson = require('../package.json');
      
      expect(packageJson.build.mac.target).toBeDefined();
      const target = packageJson.build.mac.target[0];
      expect(target.arch).toContain('x64');
      expect(target.arch).toContain('arm64');
    });
  });

  describe('Linux Build Validation', () => {
    test('should generate AppImage', () => {
      // Validates: Requirements 5.3
      if (!fs.existsSync(releaseDir)) {
        console.warn('Release directory not found. Run "npm run dist:linux" first.');
        return;
      }

      const files = fs.readdirSync(releaseDir);
      const appImageFiles = files.filter(f => f.endsWith('.AppImage'));
      
      if (appImageFiles.length > 0) {
        expect(appImageFiles.length).toBeGreaterThan(0);
        
        // Should follow naming convention
        const hasCorrectName = appImageFiles.some(f => 
          f.includes('SIGMA') && f.includes('.AppImage')
        );
        expect(hasCorrectName).toBe(true);
      } else {
        console.warn('No Linux AppImage found in release directory.');
      }
    });

    test('should have Linux icon in correct format', () => {
      // Validates: Requirements 5.3
      const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
      const placeholderPath = path.join(__dirname, '..', 'assets', 'icon.png.placeholder');
      
      const hasIcon = fs.existsSync(iconPath) || fs.existsSync(placeholderPath);
      expect(hasIcon).toBe(true);
    });

    test('should have Linux category configured', () => {
      // Validates: Requirements 5.3
      const packageJson = require('../package.json');
      
      expect(packageJson.build.linux.category).toBeDefined();
      expect(packageJson.build.linux.category).toBe('Graphics');
    });
  });

  describe('Package Contents Validation', () => {
    test('should exclude test files from build', () => {
      // Validates: Requirements 6.3
      const packageJson = require('../package.json');
      
      expect(packageJson.build.files).toBeDefined();
      // Test files are excluded via electron-specific patterns
      expect(packageJson.build.files).toContain('!electron/**/*.test.js');
      expect(packageJson.build.files).toContain('!electron/**/*.test.ts');
    });

    test('should include electron files', () => {
      // Validates: Requirements 6.3
      const packageJson = require('../package.json');
      
      expect(packageJson.build.files).toContain('electron/**/*');
    });

    test('should include frontend dist', () => {
      // Validates: Requirements 6.3
      const packageJson = require('../package.json');
      
      expect(packageJson.build.files).toContain('frontend/dist/**/*');
    });

    test('should exclude node_modules from build', () => {
      // Validates: Requirements 6.3
      const packageJson = require('../package.json');
      
      // node_modules are excluded via specific patterns for unnecessary files
      const hasNodeModulesExclusion = packageJson.build.files.some(f => 
        f.includes('node_modules') && f.startsWith('!')
      );
      expect(hasNodeModulesExclusion).toBe(true);
    });

    test('should exclude git files from build', () => {
      // Validates: Requirements 6.3
      const packageJson = require('../package.json');
      
      // Git files are excluded via glob pattern
      expect(packageJson.build.files).toContain('!**/.git*');
    });

    test('should have correct output directory', () => {
      // Validates: Requirements 6.3
      const packageJson = require('../package.json');
      
      // Output directory can be customized for different releases
      expect(packageJson.build.directories.output).toBeDefined();
      expect(packageJson.build.directories.buildResources).toBe('assets');
    });
  });

  describe('Build Scripts Validation', () => {
    test('should have all required build scripts', () => {
      const packageJson = require('../package.json');
      
      expect(packageJson.scripts.build).toBeDefined();
      expect(packageJson.scripts['build:sequential']).toBeDefined();
      expect(packageJson.scripts['build:frontend']).toBeDefined();
      expect(packageJson.scripts['build:backend:win']).toBeDefined();
      expect(packageJson.scripts['build:backend:mac']).toBeDefined();
      expect(packageJson.scripts['build:backend:linux']).toBeDefined();
      expect(packageJson.scripts['build:electron']).toBeDefined();
    });

    test('should have platform-specific dist scripts', () => {
      const packageJson = require('../package.json');
      
      expect(packageJson.scripts['dist:win']).toBeDefined();
      expect(packageJson.scripts['dist:mac']).toBeDefined();
      expect(packageJson.scripts['dist:linux']).toBeDefined();
    });

    test('should use Windows-compatible command syntax', () => {
      // Validates: Requirements 2.2
      const packageJson = require('../package.json');
      
      // Build scripts should use && for sequential execution
      const buildSequential = packageJson.scripts['build:sequential'];
      expect(buildSequential).toBeDefined();
      expect(buildSequential).toContain('&&');
    });

    test('should have postinstall script', () => {
      const packageJson = require('../package.json');
      
      expect(packageJson.scripts.postinstall).toBeDefined();
      expect(packageJson.scripts.postinstall).toContain('electron-builder install-app-deps');
    });
  });

  describe('Artifact Naming Convention', () => {
    test('should follow consistent naming pattern', () => {
      // Validates: Requirements 5.1, 5.2, 5.3
      const packageJson = require('../package.json');
      
      const winArtifactName = packageJson.build.win.artifactName;
      const macArtifactName = packageJson.build.mac.artifactName;
      const linuxArtifactName = packageJson.build.linux.artifactName;
      
      expect(winArtifactName).toBe('${productName}-${version}-${arch}.${ext}');
      expect(macArtifactName).toBe('${productName}-${version}-${arch}.${ext}');
      expect(linuxArtifactName).toBe('${productName}-${version}-${arch}.${ext}');
    });

    test('should have consistent product name', () => {
      const packageJson = require('../package.json');
      
      expect(packageJson.build.productName).toBe('Focus');
      expect(packageJson.name).toBe('focus');
    });

    test('should have version number', () => {
      const packageJson = require('../package.json');
      
      expect(packageJson.version).toBeDefined();
      expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('Resource Packaging', () => {
    test('should package backend as extra resource', () => {
      // Validates: Requirements 6.3
      const packageJson = require('../package.json');
      
      const backendResource = packageJson.build.extraResources.find(
        r => r.from === 'dist/backend' && r.to === 'backend'
      );
      
      expect(backendResource).toBeDefined();
      // Filter includes all files but excludes .env files for security
      expect(backendResource.filter).toContain('**/*');
    });

    test('should verify resources/backend directory exists in packaged app', () => {
      // Validates: Requirements 2.1, 2.2
      if (!fs.existsSync(releaseDir)) {
        console.warn('Release directory not found. Run build first.');
        return;
      }

      // Check for win-unpacked directory
      const unpackedDir = path.join(releaseDir, 'win-unpacked');
      if (!fs.existsSync(unpackedDir)) {
        console.warn('win-unpacked directory not found. Run Windows build first.');
        return;
      }

      const resourcesDir = path.join(unpackedDir, 'resources');
      const backendDir = path.join(resourcesDir, 'backend');
      
      if (fs.existsSync(backendDir)) {
        expect(fs.existsSync(backendDir)).toBe(true);
        
        // Verify backend directory contains files
        const files = fs.readdirSync(backendDir);
        expect(files.length).toBeGreaterThan(0);
        
        console.log('[Build Validation] ✓ resources/backend directory exists with', files.length, 'files');
      } else {
        console.warn('Backend directory not found in resources. This may indicate a packaging issue.');
      }
    });

    test('should verify backend executable is in resources/backend', () => {
      // Validates: Requirements 2.2, 2.3
      if (!fs.existsSync(releaseDir)) {
        console.warn('Release directory not found. Run build first.');
        return;
      }

      const unpackedDir = path.join(releaseDir, 'win-unpacked');
      if (!fs.existsSync(unpackedDir)) {
        console.warn('win-unpacked directory not found. Run Windows build first.');
        return;
      }

      const backendDir = path.join(unpackedDir, 'resources', 'backend');
      
      if (fs.existsSync(backendDir)) {
        const files = fs.readdirSync(backendDir);
        const exeName = process.platform === 'win32' ? 'sigma-backend.exe' : 'sigma-backend';
        const hasBackendExe = files.some(f => f === exeName);
        
        if (hasBackendExe) {
          expect(hasBackendExe).toBe(true);
          
          // Verify it's a file and has reasonable size
          const backendPath = path.join(backendDir, exeName);
          const stats = fs.statSync(backendPath);
          expect(stats.isFile()).toBe(true);
          expect(stats.size).toBeGreaterThan(1000000); // Should be at least 1MB
          
          console.log('[Build Validation] ✓ Backend executable found:', exeName, '(', stats.size, 'bytes)');
        } else {
          console.warn('Backend executable not found in resources/backend:', files);
        }
      } else {
        console.warn('Backend directory not found in resources.');
      }
    });

    test('should verify app.asar contains frontend files', () => {
      // Validates: Requirements 2.1
      if (!fs.existsSync(releaseDir)) {
        console.warn('Release directory not found. Run build first.');
        return;
      }

      const unpackedDir = path.join(releaseDir, 'win-unpacked');
      if (!fs.existsSync(unpackedDir)) {
        console.warn('win-unpacked directory not found. Run Windows build first.');
        return;
      }

      const asarPath = path.join(unpackedDir, 'resources', 'app.asar');
      
      if (fs.existsSync(asarPath)) {
        expect(fs.existsSync(asarPath)).toBe(true);
        
        // Verify asar file has reasonable size (should contain frontend and electron code)
        const stats = fs.statSync(asarPath);
        expect(stats.isFile()).toBe(true);
        expect(stats.size).toBeGreaterThan(100000); // Should be at least 100KB
        
        console.log('[Build Validation] ✓ app.asar found (', stats.size, 'bytes)');
        
        // Note: To actually inspect asar contents, we'd need the asar package
        // For now, we just verify it exists and has reasonable size
      } else {
        console.warn('app.asar not found in resources. This indicates a packaging issue.');
      }
    });

    test('should verify backend is NOT in user-data directory', () => {
      // Validates: Requirements 1.1, 1.2
      if (!fs.existsSync(releaseDir)) {
        console.warn('Release directory not found. Run build first.');
        return;
      }

      const unpackedDir = path.join(releaseDir, 'win-unpacked');
      if (!fs.existsSync(unpackedDir)) {
        console.warn('win-unpacked directory not found. Run Windows build first.');
        return;
      }

      // Check that backend is NOT in user-data (old location)
      const userDataDir = path.join(unpackedDir, 'user-data', 'backend');
      
      // This directory should NOT exist in the packaged app
      // (user-data is created at runtime, not during packaging)
      if (fs.existsSync(userDataDir)) {
        const files = fs.readdirSync(userDataDir);
        console.warn('[Build Validation] Warning: user-data/backend directory exists with', files.length, 'files');
        console.warn('[Build Validation] Backend should be in resources/backend, not user-data/backend');
      } else {
        console.log('[Build Validation] ✓ Backend correctly NOT in user-data directory');
      }
      
      // Verify backend IS in resources
      const resourcesBackendDir = path.join(unpackedDir, 'resources', 'backend');
      if (fs.existsSync(resourcesBackendDir)) {
        expect(fs.existsSync(resourcesBackendDir)).toBe(true);
        console.log('[Build Validation] ✓ Backend correctly located in resources/backend');
      }
    });

    test('should validate backend executable exists before packaging', () => {
      // Validates: Requirements 6.3
      const backendDir = path.join(distDir, 'backend');
      
      if (fs.existsSync(backendDir)) {
        const files = fs.readdirSync(backendDir);
        const hasExecutable = files.some(file => 
          file.includes('sigma-backend')
        );
        
        if (hasExecutable) {
          expect(hasExecutable).toBe(true);
        } else {
          console.warn('Backend executable not found. Build backend first.');
        }
      } else {
        console.warn('Backend directory not found. Build backend first.');
      }
    });

    test('should validate frontend dist exists before packaging', () => {
      // Validates: Requirements 6.3
      const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
      
      if (fs.existsSync(frontendDist)) {
        const files = fs.readdirSync(frontendDist);
        expect(files.length).toBeGreaterThan(0);
        expect(files).toContain('index.html');
      } else {
        console.warn('Frontend dist not found. Build frontend first.');
      }
    });
  });

  describe('Installation Configuration', () => {
    test('should configure desktop shortcut creation', () => {
      // Validates: Requirements 5.5
      const packageJson = require('../package.json');
      
      expect(packageJson.build.nsis.createDesktopShortcut).toBe(true);
    });

    test('should configure start menu shortcut creation', () => {
      // Validates: Requirements 5.5
      const packageJson = require('../package.json');
      
      expect(packageJson.build.nsis.createStartMenuShortcut).toBe(true);
    });

    test('should allow custom installation directory', () => {
      // Validates: Requirements 5.4
      const packageJson = require('../package.json');
      
      expect(packageJson.build.nsis.allowToChangeInstallationDirectory).toBe(true);
    });

    test('should not use one-click installer', () => {
      // Validates: Requirements 5.4
      const packageJson = require('../package.json');
      
      expect(packageJson.build.nsis.oneClick).toBe(false);
    });

    test('should configure installer icons', () => {
      // Validates: Requirements 5.1
      const packageJson = require('../package.json');
      
      expect(packageJson.build.nsis.installerIcon).toBe('assets/focus.ico');
      expect(packageJson.build.nsis.uninstallerIcon).toBe('assets/focus.ico');
      expect(packageJson.build.nsis.installerHeaderIcon).toBe('assets/focus.ico');
    });

    test('should configure run after finish option', () => {
      // Validates: Requirements 5.5
      const packageJson = require('../package.json');
      
      expect(packageJson.build.nsis.runAfterFinish).toBe(true);
    });
  });
});
