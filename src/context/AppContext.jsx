import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SAMPLE_INVOICES } from '../data/store';

const AppContext = createContext(null);
const API = '/api';

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState(SAMPLE_INVOICES);
  const [drivers, setDrivers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ontarioRoute, setOntarioRouteState] = useState({ started: false, done: false, holiday: false, startTime: null, stopStatus: new Array(15).fill(null), arrivals: new Array(15).fill(null) });
  const [quebecRoute,  setQuebecRouteState]  = useState({ started: false, done: false, holiday: false, startTime: null, stopStatus: new Array(10).fill(null), arrivals: new Array(10).fill(null) });

  const saveRoute = useCallback(async (routeName, routeData) => {
    try {
      await fetch(`${API}/routes/${routeName}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeData),
      });
    } catch(e) { console.error('Save route error:', e); }
  }, []);

  const setOntarioRoute = useCallback((updater) => {
    setOntarioRouteState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveRoute('ontario', next);
      return next;
    });
  }, [saveRoute]);

  const setQuebecRoute = useCallback((updater) => {
    setQuebecRouteState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveRoute('quebec', next);
      return next;
    });
  }, [saveRoute]);

  const fetchRoutes = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/routes/progress`);
      const data = await res.json();
      if (data.ontario) setOntarioRouteState(data.ontario);
      if (data.quebec)  setQuebecRouteState(data.quebec);
    } catch(e) { console.error('Load routes error:', e); }
  }, []);

  const login = useCallback((role, name) => setUser({ role, name, initials: name.split(' ').map(n => n[0]).join('') }), []);
  const logout = useCallback(() => setUser(null), []);

  const fetchOrders = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`${API}/orders?date=${today}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.map(o => ({
          ...o,
          client: o.client_id,
          driver: o.driver_id,
          clientName: o.client_name || o.to_business_name || o.billing_name || o.client_id,
          driverName: o.driver_name,
          driverInitials: o.driver_initials,
          driverColor: o.driver_color,
          pickedUpAt: o.picked_up_at,
          onWayAt: o.on_way_at,
          deliveredAt: o.delivered_at,
          amount: parseFloat(o.amount || 0),
        })));
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/drivers`);
      if (res.ok) setDrivers(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch(`${API}/clients`);
      if (res.ok) setClients(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch(`${API}/invoices`);
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) setInvoices(data.map(i => ({
          ...i,
          id: i.id, type: i.type, client: i.client_id, route: i.route,
          dates: `${String(i.date_from||'').split('T')[0]} – ${String(i.date_to||'').split('T')[0]}`,
          date_from: i.date_from, date_to: i.date_to,
          amount: parseFloat(i.total || 0), days: i.days, status: i.status,
          eft: i.eft_number, client_name: i.client_name,
          pdf_url: i.pdf_url || null,
        })));
      }
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchDrivers();
    fetchClients();
    fetchInvoices();
    fetchRoutes();

    const iv = setInterval(() => fetchOrders(), 10000);
    return () => clearInterval(iv);
  }, []);

  const updateOrderStatus = useCallback(async (id, status, extra = {}) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status, ...extra } : o));
    try {
      await fetch(`${API}/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      });
    } catch (err) { console.error(err); }
  }, []);

  const verifyPin = useCallback(async (type, pin, driverId = null) => {
    try {
      const res = await fetch(`${API}/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, pin, id: driverId }),
      });
      return await res.json();
    } catch (err) { return { success: false }; }
  }, []);

  const clientLogin = useCallback(async (email, password) => {
    try {
      const res = await fetch(`${API}/auth/client-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return await res.json();
    } catch (err) { return { success: false, error: 'Connection error' }; }
  }, []);

  const addInvoice = useCallback(async (inv) => {
    try {
      const subtotal = inv.subtotal || (inv.amount / 1.14975);
      const res = await fetch(`${API}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:        inv.id || undefined,
          type:      inv.type,
          client_id: inv.client,
          route:     inv.route,
          date_from: inv.date_from || inv.dateFrom,
          date_to:   inv.date_to   || inv.dateTo,
          days:      inv.days,
          subtotal:  subtotal.toFixed(2),
          tps:       (subtotal * 0.05).toFixed(2),
          tvq:       (subtotal * 0.09975).toFixed(2),
          total:     inv.amount,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setInvoices(prev => [{ ...inv, id: saved.id }, ...prev]);
      }
    } catch (err) { setInvoices(prev => [inv, ...prev]); }
  }, []);

  const markInvoicePaid = useCallback(async (ids, eft) => {
    setInvoices(prev => prev.map(inv => ids.includes(inv.id) ? { ...inv, status: 'paid', eft } : inv));
    try {
      await Promise.all(ids.map(id =>
        fetch(`${API}/invoices/${id}/pay`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eft_number: eft }),
        })
      ));
    } catch (err) { console.error(err); }
  }, []);

  return (
    <AppContext.Provider value={{
      user, login, logout,
      orders, updateOrderStatus, fetchOrders, loading,
      drivers, fetchDrivers,
      clients, fetchClients,
      invoices, addInvoice, markInvoicePaid, fetchInvoices,
      ontarioRoute, setOntarioRoute,
      quebecRoute, setQuebecRoute,
      verifyPin, clientLogin,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
