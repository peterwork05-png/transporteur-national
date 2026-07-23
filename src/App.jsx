import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Login from './pages/Login';
import AdminLayout from './pages/admin/AdminLayout';
import AdminToday from './pages/admin/AdminToday';
import AdminOrders from './pages/admin/AdminOrders';
import AdminRoutes from './pages/admin/AdminRoutes';
import AdminInvoices from './pages/admin/AdminInvoices';
import AdminPayments from './pages/admin/AdminPayments';
import AdminImport from './pages/admin/AdminImport';
import { AdminDrivers, AdminSettings } from './pages/admin/AdminMisc';
import DriverLocal from './pages/driver/DriverLocal';
import DriverRoute from './pages/driver/DriverRoute';
import ClientTracking from './pages/client/ClientTracking';
import ClientPortal from './pages/client/ClientPortal';
import TrackSearch from './pages/client/TrackSearch';
import AdminLiveMap from './pages/admin/AdminLiveMap';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminToday />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="routes" element={<AdminRoutes />} />
            <Route path="invoices" element={<AdminInvoices />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="drivers" element={<AdminDrivers />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="import" element={<AdminImport />} />
            <Route path="livemap" element={<AdminLiveMap />} />
          </Route>
          <Route path="/driver/local/:driverId" element={<DriverLocal />} />
          <Route path="/driver/local" element={<DriverLocal />} />
          <Route path="/driver/:route" element={<DriverRoute />} />
          <Route path="/track" element={<TrackSearch />} />
          <Route path="/track/:orderId" element={<ClientTracking />} />
          <Route path="/portal" element={<ClientPortal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

