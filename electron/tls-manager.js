const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

/**
 * TLS Certificate Manager
 * Handles generation, storage, and validation of self-signed TLS certificates
 * for secure local communication between frontend and backend
 */
class TLSManager {
  constructor(userDataPath) {
    this.userDataPath = userDataPath;
    this.certDir = path.join(userDataPath, 'certs');
    this.certPath = path.join(this.certDir, 'cert.pem');
    this.keyPath = path.join(this.certDir, 'key.pem');
  }

  /**
   * Ensure the certificate directory exists
   */
  ensureCertDirectory() {
    if (!fs.existsSync(this.certDir)) {
      fs.mkdirSync(this.certDir, { recursive: true });
    }
  }

  /**
   * Generate a self-signed TLS certificate
   * @returns {Promise<{cert: string, key: string}>} PEM-encoded certificate and private key
   */
  async generateCertificate() {
    return new Promise((resolve, reject) => {
      try {
        // Generate a key pair
        const keys = forge.pki.rsa.generateKeyPair(2048);

        // Create a certificate
        const cert = forge.pki.createCertificate();
        cert.publicKey = keys.publicKey;
        cert.serialNumber = '01';
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

        // Set certificate attributes
        const attrs = [
          { name: 'commonName', value: 'localhost' },
          { name: 'countryName', value: 'US' },
          { shortName: 'ST', value: 'State' },
          { name: 'localityName', value: 'City' },
          { name: 'organizationName', value: 'SIGMA' },
          { shortName: 'OU', value: 'Development' }
        ];

        cert.setSubject(attrs);
        cert.setIssuer(attrs);

        // Add extensions for localhost
        cert.setExtensions([
          {
            name: 'basicConstraints',
            cA: true
          },
          {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true
          },
          {
            name: 'extKeyUsage',
            serverAuth: true,
            clientAuth: true,
            codeSigning: true,
            emailProtection: true,
            timeStamping: true
          },
          {
            name: 'subjectAltName',
            altNames: [
              {
                type: 2, // DNS
                value: 'localhost'
              },
              {
                type: 7, // IP
                ip: '127.0.0.1'
              },
              {
                type: 7, // IP
                ip: '::1'
              }
            ]
          }
        ]);

        // Self-sign the certificate
        cert.sign(keys.privateKey, forge.md.sha256.create());

        // Convert to PEM format
        const certPem = forge.pki.certificateToPem(cert);
        const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

        resolve({ cert: certPem, key: keyPem });
      } catch (error) {
        reject(new Error(`Failed to generate certificate: ${error.message}`));
      }
    });
  }

  /**
   * Save certificate and key to disk
   * @param {string} cert - PEM-encoded certificate
   * @param {string} key - PEM-encoded private key
   */
  saveCertificate(cert, key) {
    this.ensureCertDirectory();
    
    try {
      fs.writeFileSync(this.certPath, cert, 'utf8');
      fs.writeFileSync(this.keyPath, key, 'utf8');
      
      // Set restrictive permissions on the key file (Unix-like systems)
      if (process.platform !== 'win32') {
        fs.chmodSync(this.keyPath, 0o600);
      }
    } catch (error) {
      throw new Error(`Failed to save certificate: ${error.message}`);
    }
  }

  /**
   * Load certificate and key from disk
   * @returns {{cert: string, key: string}} PEM-encoded certificate and private key
   */
  loadCertificate() {
    try {
      const cert = fs.readFileSync(this.certPath, 'utf8');
      const key = fs.readFileSync(this.keyPath, 'utf8');
      return { cert, key };
    } catch (error) {
      throw new Error(`Failed to load certificate: ${error.message}`);
    }
  }

  /**
   * Check if certificate files exist
   * @returns {boolean} True if both certificate and key files exist
   */
  certificateExists() {
    return fs.existsSync(this.certPath) && fs.existsSync(this.keyPath);
  }

  /**
   * Validate certificate is valid for localhost
   * @param {string} certPem - PEM-encoded certificate
   * @returns {boolean} True if certificate is valid
   */
  validateCertificate(certPem) {
    try {
      const cert = forge.pki.certificateFromPem(certPem);
      
      // Check if certificate is expired
      const now = new Date();
      if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
        return false;
      }

      // Check if certificate is for localhost
      const subject = cert.subject.attributes.find(attr => attr.name === 'commonName');
      if (!subject || subject.value !== 'localhost') {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Certificate validation error:', error);
      return false;
    }
  }

  /**
   * Get certificate file paths
   * @returns {{certPath: string, keyPath: string}} Paths to certificate and key files
   */
  getCertificatePaths() {
    return {
      certPath: this.certPath,
      keyPath: this.keyPath
    };
  }

  /**
   * Initialize TLS certificates - generate if needed, validate if exists
   * @returns {Promise<{certPath: string, keyPath: string}>} Paths to certificate files
   */
  async initialize() {
    try {
      // Check if certificate exists
      if (this.certificateExists()) {
        console.log('Loading existing TLS certificate...');
        const { cert } = this.loadCertificate();
        
        // Validate the certificate
        if (this.validateCertificate(cert)) {
          console.log('Existing certificate is valid');
          return this.getCertificatePaths();
        } else {
          console.log('Existing certificate is invalid or expired, regenerating...');
        }
      } else {
        console.log('No existing certificate found, generating new one...');
      }

      // Generate new certificate
      const { cert, key } = await this.generateCertificate();
      this.saveCertificate(cert, key);
      console.log('TLS certificate generated and saved successfully');
      
      return this.getCertificatePaths();
    } catch (error) {
      throw new Error(`TLS initialization failed: ${error.message}`);
    }
  }
}

module.exports = TLSManager;
