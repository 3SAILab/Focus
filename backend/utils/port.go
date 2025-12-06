package utils

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"runtime"
)

// IsPortAvailable checks if a port is available for binding
func IsPortAvailable(port int) bool {
	addr := fmt.Sprintf(":%d", port)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return false
	}
	listener.Close()
	return true
}

// FindAvailablePort searches for an available port starting from startPort
// maxAttempts: maximum number of ports to try
// Returns: available port number, error if no port found
func FindAvailablePort(startPort int, maxAttempts int) (int, error) {
	for i := 0; i < maxAttempts; i++ {
		port := startPort + i
		if IsPortAvailable(port) {
			return port, nil
		}
	}
	return 0, fmt.Errorf("no available port found after %d attempts starting from port %d", maxAttempts, startPort)
}

// GetPortFilePath returns the full path to a port file based on OS
func GetPortFilePath(filename string) string {
	var tempDir string
	
	switch runtime.GOOS {
	case "windows":
		tempDir = os.Getenv("TEMP")
		if tempDir == "" {
			tempDir = os.Getenv("TMP")
		}
		if tempDir == "" {
			tempDir = "C:\\Windows\\Temp"
		}
	default: // linux, darwin, etc.
		tempDir = "/tmp"
	}
	
	return filepath.Join(tempDir, filename)
}

// WritePortFile writes a port number to a file
func WritePortFile(port int, filename string) error {
	filePath := GetPortFilePath(filename)
	content := fmt.Sprintf("%d", port)
	
	// Write atomically by writing to temp file first, then renaming
	tempPath := filePath + ".tmp"
	err := os.WriteFile(tempPath, []byte(content), 0644)
	if err != nil {
		return fmt.Errorf("failed to write port file: %w", err)
	}
	
	err = os.Rename(tempPath, filePath)
	if err != nil {
		os.Remove(tempPath) // Clean up temp file on error
		return fmt.Errorf("failed to rename port file: %w", err)
	}
	
	return nil
}

// ReadPortFile reads a port number from a file
func ReadPortFile(filename string) (int, error) {
	filePath := GetPortFilePath(filename)
	
	content, err := os.ReadFile(filePath)
	if err != nil {
		return 0, fmt.Errorf("failed to read port file: %w", err)
	}
	
	portStr := strings.TrimSpace(string(content))
	port, err := strconv.Atoi(portStr)
	if err != nil {
		return 0, fmt.Errorf("invalid port number in file: %w", err)
	}
	
	// Validate port range
	if port < 1 || port > 65535 {
		return 0, fmt.Errorf("port number out of valid range (1-65535): %d", port)
	}
	
	return port, nil
}
