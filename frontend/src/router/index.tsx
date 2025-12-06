import { createBrowserRouter, Navigate } from 'react-router-dom';
import Layout from '../layout/Layout';
import Create from '../views/Create';
import History from '../views/History';
import HistoryDetail from '../views/HistoryDetail';

export const router = createBrowserRouter([
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

