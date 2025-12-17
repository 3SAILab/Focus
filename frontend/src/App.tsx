// src/App.tsx

import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ToastProvider } from './context/ToastContext';
import { ConfigProvider } from './context/ConfigContext';
import { GlobalTaskProvider } from './context/GlobalTaskContext';

function App() {
  return (
    <ToastProvider>
      <GlobalTaskProvider>
        <ConfigProvider>
          <RouterProvider router={router} />
        </ConfigProvider>
      </GlobalTaskProvider>
    </ToastProvider>
  );
}

export default App;