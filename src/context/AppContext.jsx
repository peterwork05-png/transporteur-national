import { createContext, useContext, useState, useCallback } from 'react';
import { SAMPLE_ORDERS, SAMPLE_INVOICES } from '../data/store';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState(SAMPLE_ORDERS);
  const [invoices, setInvoices] = useState(SAMPLE_INVOICES);
  const [ontarioRoute, setOntarioRoute] = useState({ started: false, done: false, holiday: false, startTime: null, stopStatus: new Array(15).fill(null), arrivals: [] });
  const [quebecRoute, setQuebecRoute] = useState({ started: false, done: false, holiday: false, startTime: null, stopStatus: new Array(10).fill(null), arrivals: [] });

  const login = useCallback((role, name) => setUser({ role, name, initials: name.split(' ').map(n => n[0]).join('') }), []);
  const logout = useCallback(() => setUser(null), []);

  const updateOrderStatus = useCallback((id, status, extra = {}) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status, ...extra } : o));
  }, []);

  const addInvoice = useCallback((inv) => {
    setInvoices(prev => [inv, ...prev]);
  }, []);

  const markInvoicePaid = useCallback((ids, eft) => {
    setInvoices(prev => prev.map(inv => ids.includes(inv.id) ? { ...inv, status: 'paid', eft } : inv));
  }, []);

  return (
    <AppContext.Provider value={{
      user, login, logout,
      orders, updateOrderStatus,
      invoices, addInvoice, markInvoicePaid,
      ontarioRoute, setOntarioRoute,
      quebecRoute, setQuebecRoute,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
