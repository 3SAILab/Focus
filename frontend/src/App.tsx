// src/App.tsx

import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ToastProvider } from './context/ToastContext';
import { ConfigProvider } from './context/ConfigContext';
import { GlobalTaskProvider } from './context/GlobalTaskContext';
import { VersionProvider, useVersion } from './context/VersionContext';

// Inner component that conditionally renders based on version check
function AppContent() {
  const { canUseApp, isVersionChecked, status } = useVersion();

  // Show loading while checking version
  if (!isVersionChecked || status === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">正在检查版本...</p>
        </div>
      </div>
    );
  }

  // If version check failed or update required, modals will be shown by VersionProvider
  // Don't render the app content until version is up to date
  if (!canUseApp) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        {/* Empty container - modals are rendered by VersionProvider */}
      </div>
    );
  }

  // Version is up to date, render the app
  return (
    <GlobalTaskProvider>
      <ConfigProvider>
        <RouterProvider router={router} />
      </ConfigProvider>
    </GlobalTaskProvider>
  );
}

function App() {
  return (
    <ToastProvider>
      <VersionProvider>
        <AppContent />
      </VersionProvider>
    </ToastProvider>
  );
}

export default App;