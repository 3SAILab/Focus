const TLSManager = require('./tls-manager');
const fs = require('fs');
const path = require('path');
const os = require('os');
const forge = require('node-forge');

describe('TLSManager', () => {
  let tlsManager;
  let testDataPath;

  beforeEach(() => {
    // Create a temporary directory for testing
    testDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-test-'));
    tlsManager = new TLSManager(testDataPath);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDataPath)) {
      fs.rmSync(testDataPath, { recursive: true, force: true });
    }
  });

  describe('Certificate Generation', () => {
    test('should generate a valid certificate and key pair', async () => {
      const { cert, key } = await tlsManager.generateCertificate();

      expect(cert).toBeDefined();
      expect(key).toBeDefined();
      expect(cert).toContain('-----BEGIN CERTIFICATE-----');
      expect(cert).toContain('-----END CERTIFICATE-----');
      expect(key).toContain('-----BEGIN RSA PRIVATE KEY-----');
      expect(key).toContain('-----END RSA PRIVATE KEY-----');
    });

    test('should generate certificate with localhost as common name', async () => {
      const { cert } = await tlsManager.generateCertificate();
      const certificate = forge.pki.certificateFromPem(cert);
      
      const commonName = certificate.subject.attributes.find(
        attr => attr.name === 'commonName'
      );
      
      expect(commonName).toBeDefined();
      expect(commonName.value).toBe('localhost');
    });

    test('should generate certificate with subject alternative names', async () => {
      const { cert } = await tlsManager.generateCertificate();
      const certificate = forge.pki.certificateFromPem(cert);
      
      const sanExtension = certificate.extensions.find(
        ext => ext.name === 'subjectAltName'
      );
      
      expect(sanExtension).toBeDefined();
      expect(sanExtension.altNames).toBeDefined();
      
      const hasLocalhost = sanExtension.altNames.some(
        alt => alt.type === 2 && alt.value === 'localhost'
      );
      const hasIPv4 = sanExtension.altNames.some(
        alt => alt.type === 7 && alt.ip === '127.0.0.1'
      );
      
      expect(hasLocalhost).toBe(true);
      expect(hasIPv4).toBe(true);
    });

    test('should generate certificate valid for one year', async () => {
      const { cert } = await tlsManager.generateCertificate();
      const certificate = forge.pki.certificateFromPem(cert);
      
      const notBefore = certificate.validity.notBefore;
      const notAfter = certificate.validity.notAfter;
      
      const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
      const validityPeriod = notAfter.getTime() - notBefore.getTime();
      
      // Allow some tolerance (within 1 day)
      expect(validityPeriod).toBeGreaterThanOrEqual(oneYearInMs - 24 * 60 * 60 * 1000);
      expect(validityPeriod).toBeLessThanOrEqual(oneYearInMs + 24 * 60 * 60 * 1000);
    });
  });

  describe('Certificate Save and Load', () => {
    test('should save certificate and key to disk', async () => {
      const { cert, key } = await tlsManager.generateCertificate();
      
      tlsManager.saveCertificate(cert, key);
      
      const { certPath, keyPath } = tlsManager.getCertificatePaths();
      
      expect(fs.existsSync(certPath)).toBe(true);
      expect(fs.existsSync(keyPath)).toBe(true);
    });

    test('should load saved certificate and key', async () => {
      const { cert: originalCert, key: originalKey } = await tlsManager.generateCertificate();
      
      tlsManager.saveCertificate(originalCert, originalKey);
      
      const { cert: loadedCert, key: loadedKey } = tlsManager.loadCertificate();
      
      expect(loadedCert).toBe(originalCert);
      expect(loadedKey).toBe(originalKey);
    });

    test('should create certificate directory if it does not exist', async () => {
      const { cert, key } = await tlsManager.generateCertificate();
      
      const certDir = path.join(testDataPath, 'certs');
      expect(fs.existsSync(certDir)).toBe(false);
      
      tlsManager.saveCertificate(cert, key);
      
      expect(fs.existsSync(certDir)).toBe(true);
    });

    test('should throw error when loading non-existent certificate', () => {
      expect(() => {
        tlsManager.loadCertificate();
      }).toThrow('Failed to load certificate');
    });

    test('should correctly report certificate existence', async () => {
      expect(tlsManager.certificateExists()).toBe(false);
      
      const { cert, key } = await tlsManager.generateCertificate();
      tlsManager.saveCertificate(cert, key);
      
      expect(tlsManager.certificateExists()).toBe(true);
    });
  });

  describe('Certificate Validation', () => {
    test('should validate a valid certificate', async () => {
      const { cert } = await tlsManager.generateCertificate();
      
      const isValid = tlsManager.validateCertificate(cert);
      
      expect(isValid).toBe(true);
    });

    test('should reject expired certificate', () => {
      // Create an expired certificate
      const keys = forge.pki.rsa.generateKeyPair(2048);
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01';
      
      // Set validity to past dates
      cert.validity.notBefore = new Date('2020-01-01');
      cert.validity.notAfter = new Date('2021-01-01');
      
      const attrs = [{ name: 'commonName', value: 'localhost' }];
      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      cert.sign(keys.privateKey, forge.md.sha256.create());
      
      const certPem = forge.pki.certificateToPem(cert);
      
      const isValid = tlsManager.validateCertificate(certPem);
      
      expect(isValid).toBe(false);
    });

    test('should reject certificate with wrong common name', () => {
      const keys = forge.pki.rsa.generateKeyPair(2048);
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01';
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
      
      const attrs = [{ name: 'commonName', value: 'example.com' }];
      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      cert.sign(keys.privateKey, forge.md.sha256.create());
      
      const certPem = forge.pki.certificateToPem(cert);
      
      const isValid = tlsManager.validateCertificate(certPem);
      
      expect(isValid).toBe(false);
    });

    test('should reject invalid certificate PEM', () => {
      const isValid = tlsManager.validateCertificate('invalid-pem-data');
      
      expect(isValid).toBe(false);
    });
  });

  describe('Initialize', () => {
    test('should generate and save certificate on first initialization', async () => {
      expect(tlsManager.certificateExists()).toBe(false);
      
      const paths = await tlsManager.initialize();
      
      expect(tlsManager.certificateExists()).toBe(true);
      expect(paths.certPath).toBeDefined();
      expect(paths.keyPath).toBeDefined();
      expect(fs.existsSync(paths.certPath)).toBe(true);
      expect(fs.existsSync(paths.keyPath)).toBe(true);
    });

    test('should reuse valid existing certificate', async () => {
      // First initialization
      await tlsManager.initialize();
      const { cert: firstCert } = tlsManager.loadCertificate();
      
      // Second initialization
      await tlsManager.initialize();
      const { cert: secondCert } = tlsManager.loadCertificate();
      
      // Should be the same certificate
      expect(secondCert).toBe(firstCert);
    });

    test('should regenerate invalid certificate', async () => {
      // Create an expired certificate
      const keys = forge.pki.rsa.generateKeyPair(2048);
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01';
      cert.validity.notBefore = new Date('2020-01-01');
      cert.validity.notAfter = new Date('2021-01-01');
      
      const attrs = [{ name: 'commonName', value: 'localhost' }];
      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      cert.sign(keys.privateKey, forge.md.sha256.create());
      
      const expiredCertPem = forge.pki.certificateToPem(cert);
      const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
      
      // Save expired certificate
      tlsManager.saveCertificate(expiredCertPem, keyPem);
      
      // Initialize should regenerate
      await tlsManager.initialize();
      
      const { cert: newCert } = tlsManager.loadCertificate();
      
      // Should be a different (valid) certificate
      expect(newCert).not.toBe(expiredCertPem);
      expect(tlsManager.validateCertificate(newCert)).toBe(true);
    });
  });

  describe('Get Certificate Paths', () => {
    test('should return correct certificate paths', () => {
      const paths = tlsManager.getCertificatePaths();
      
      expect(paths.certPath).toBe(path.join(testDataPath, 'certs', 'cert.pem'));
      expect(paths.keyPath).toBe(path.join(testDataPath, 'certs', 'key.pem'));
    });
  });
});
