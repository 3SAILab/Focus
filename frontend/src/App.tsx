// src/App.tsx

import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ToastProvider } from './context/ToastContext';
import { ConfigProvider } from './context/ConfigContext';

function App() {
  return (
    <ToastProvider>
      <ConfigProvider>
        <RouterProvider router={router} />
      </ConfigProvider>
    </ToastProvider>
  );
}

export default App;