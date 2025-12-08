import { createHashRouter, Navigate } from 'react-router-dom';
import Layout from '../layout/Layout';
import Create from '../views/Create';
import History from '../views/History';
import HistoryDetail from '../views/HistoryDetail';
import WhiteBackground from '../views/WhiteBackground';
import ClothingChange from '../views/ClothingChange';


// 使用 HashRouter 以支持 Electron 的 file:// 协议
export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Navigate to="/create" replace />,
      },
      {
        path: 'create',
        element: <Create />,
      },
      {
        path: 'white-background',
        element: <WhiteBackground />,
      },
      {
        path: 'clothing-change',
        element: <ClothingChange />,
      },
      {
        path: 'history',
        element: <History />,
      },
      {
        path: 'history/:date',
        element: <HistoryDetail />,
      },
    ],
  },
]);

