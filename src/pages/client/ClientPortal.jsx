import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const STATUS_BADGE = {
  waiting:   { label:'Processing',         cls:'badge-gray' },
  accepted:  { label:'Accepted',           cls:'badge-info' },
  picked:    { label:'Picked up',          cls:'badge-warning' },
  enroute:   { label:'En route',           cls:'badge-info' },
  delivered: { label:'Delivered',          cls:'badge-success' },
  attempted: { label:'Attempted delivery', cls:'badge-danger' },
};

const REMEMBER_KEY = 'tn_client_remember';

export default function ClientPortal() {
  const navigate = useNavigate();

  // Auth state
  const [loggedIn,  setLoggedIn]  = useState(false);
  const [client,    setClient]    = useState(null);
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [remember,  setRemember]  = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoad,  setAuthLoad]  = useState(false);

  // Orders & invoices
  const [orders,   setOrders]   = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tab,      setTab]      = useState('orders');
  const [period,   setPeriod]   = useState('month');
  const [loading,  setLoading]  = useState(false);
  const [selected, setSelected] = useState(null);

  // Change password
  const [showChangePwd,  setShowChangePwd]  = useState(false);
  const [newPassword,    setNewPassword]    = useState('');
  const [confirmPassword,setConfirmPassword]= useState('');
  const [pwdError,       setPwdError]       = useState('');
  const [pwdSuccess,     setPwdSuccess]     = useState(false);
  const [savingPwd,      setSavingPwd]      = useState(false);

  const handleChangePassword = async () => {
    setPwdError('');
    if (newPassword.length < 6) return setPwdError('Password must be at least 6 characters');
    if (newPassword !== confirmPassword) return setPwdError('Passwords do not match');
    setSavingPwd(true);
    try {
      const res  = await fetch('/api/auth/client-change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: client.email, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setPwdSuccess(true);
        if (remember) {
          localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: client.email, password: newPassword }));
        }
        setTimeout(() => { setShowChangePwd(false); setPwdSuccess(false); setNewPassword(''); setConfirmPassword(''); }, 2000);
      } else {
        setPwdError(data.error || 'Error changing password');
      }
    } catch(e) { setPwdError('Connection error'); }
    setSavingPwd(false);
  };

  // Load remembered credentials on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const { email: e, password: p } = JSON.parse(saved);
        if (e && p) {
          setEmail(e);
          setPassword(p);
          setRemember(true);
          // Auto login
          handleLogin(e, p);
        }
      }
    } catch(err) {}
  }, []);

  const handleLogin = async (e, p) => {
    const loginEmail    = e || email;
    const loginPassword = p || password;
    if (!loginEmail || !loginPassword) return;
    setAuthLoad(true);
    setAuthError('');
    try {
      const res  = await fetch('/api/clients/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setClient(data.client);
        setLoggedIn(true);
        if (remember || p) {
          localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: loginEmail, password: loginPassword }));
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } else {
        setAuthError('Invalid email or password');
      }
    } catch(err) {
      setAuthError('Connection error. Please try again.');
    }
    setAuthLoad(false);
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setClient(null);
    setOrders([]);
    setInvoices([]);
    if (!remember) {
      localStorage.removeItem(REMEMBER_KEY);
      setEmail('');
      setPassword('');
    }
  };

  const fetchOrders = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const url = `/api/client/orders?client_group=${client.client_group || client.id}&period=${period}`;
      const res  = await fetch(url);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch(err) { console.error(err); }
    setLoading(false);
  }, [client, period]);

  const fetchInvoices = useCallback(async () => {
    if (!client || client.role !== 'finance') return;
    try {
      const res  = await fetch(`/api/client/invoices?client_group=${client.client_group || client.id}`);
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data : []);
    } catch(err) { console.error(err); }
  }, [client]);

  useEffect(() => {
    if (loggedIn) {
      fetchOrders();
      fetchInvoices();
    }
  }, [loggedIn, fetchOrders, fetchInvoices]);

  const fmt = n => `$${parseFloat(n||0).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{background:'var(--tn-dark)'}}>
        <div style={{position:'fixed',top:'-80px',right:'-80px',width:'300px',height:'300px',background:'var(--tn-red)',borderRadius:'50%',opacity:0.06,pointerEvents:'none'}}/>
        <div style={{position:'fixed',bottom:'-60px',left:'-60px',width:'200px',height:'200px',background:'var(--tn-gold)',borderRadius:'50%',opacity:0.08,pointerEvents:'none'}}/>
        <div className="w-full max-w-sm relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{background:'rgba(139,105,20,0.15)',border:'1px solid rgba(139,105,20,0.25)'}}>
              <span className="text-4xl">🏢</span>
            </div>
            <h1 className="text-2xl font-semibold" style={{color:'var(--tn-cream)'}}>Client Portal</h1>
            <p className="text-sm mt-1" style={{color:'rgba(250,247,240,0.35)'}}>Transporteur National MC INC.</p>
          </div>
          <div className="rounded-2xl p-6" style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
            <div className="space-y-3">
              <div>
                <label className="label" style={{color:'rgba(250,247,240,0.5)'}}>Email</label>
                <input type="email" className="input" placeholder="your@email.com"
                  autoComplete="email"
                  value={email} onChange={e=>setEmail(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&handleLogin()}
                  style={{background:'rgba(250,247,240,0.07)',border:'0.5px solid rgba(139,105,20,0.3)',color:'var(--tn-cream)'}}/>
              </div>
              <div>
                <label className="label" style={{color:'rgba(250,247,240,0.5)'}}>Password</label>
                <input type="password" className="input" placeholder="••••••••"
                  autoComplete="current-password"
                  value={password} onChange={e=>setPassword(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&handleLogin()}
                  style={{background:'rgba(250,247,240,0.07)',border:'0.5px solid rgba(139,105,20,0.3)',color:'var(--tn-cream)'}}/>
              </div>
              {/* Remember me */}
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="remember" checked={remember} onChange={e=>setRemember(e.target.checked)}
                  style={{accentColor:'var(--tn-red)',width:'16px',height:'16px',cursor:'pointer'}}/>
                <label htmlFor="remember" className="text-sm cursor-pointer" style={{color:'rgba(250,247,240,0.5)'}}>
                  Stay signed in
                </label>
              </div>
              {authError && (
                <div className="rounded-xl p-3" style={{background:'rgba(192,57,43,0.15)',border:'0.5px solid rgba(192,57,43,0.3)'}}>
                  <p className="text-sm" style={{color:'#F87171'}}>{authError}</p>
                </div>
              )}
              <button onClick={() => handleLogin()} disabled={authLoad || !email || !password}
                className="btn w-full justify-center mt-2"
                style={{background:'var(--tn-red)',color:'white',opacity:authLoad||!email||!password?0.6:1}}>
                {authLoad ? '⏳ Signing in...' : 'Sign in'}
              </button>
            </div>
          </div>
          <button onClick={() => navigate('/')} className="w-full text-center mt-4 text-sm"
            style={{color:'rgba(250,247,240,0.3)'}}>← Back to home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{background:'var(--tn-cream)'}}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4" style={{background:'var(--tn-dark)',borderBottom:'0.5px solid rgba(139,105,20,0.2)', paddingTop:'max(12px, env(safe-area-inset-top))', paddingBottom:'12px'}}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-sm flex items-center gap-1"
              style={{color:'rgba(250,247,240,0.4)'}}>← Back</button>
            <div>
              <p className="text-xs" style={{color:'rgba(250,247,240,0.4)'}}>{client?.name}</p>
              <p className="text-sm font-medium" style={{color:'var(--tn-cream)'}}>Client Portal</p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-sm"
            style={{background:'rgba(250,247,240,0.08)',color:'rgba(250,247,240,0.5)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
            Sign out
          </button>
          <button onClick={() => setShowChangePwd(true)} className="btn btn-sm"
            style={{background:'rgba(250,247,240,0.08)',color:'rgba(250,247,240,0.5)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
            🔑
          </button>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('orders')}
            className="px-4 py-1.5 rounded-lg text-sm font-medium"
            style={{background:tab==='orders'?'var(--tn-red)':'white', color:tab==='orders'?'white':'var(--tn-gold)', border:'0.5px solid var(--tn-border)'}}>
            📦 Orders
          </button>
          {client?.role === 'finance' && (
            <button onClick={() => setTab('invoices')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium"
              style={{background:tab==='invoices'?'var(--tn-red)':'white', color:tab==='invoices'?'white':'var(--tn-gold)', border:'0.5px solid var(--tn-border)'}}>
              📄 Invoices
            </button>
          )}
        </div>

        {tab === 'orders' && (
          <>
            {/* Period filter */}
            <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{background:'var(--tn-warm)',width:'fit-content'}}>
              {[['today','Today'],['month','This month'],['all','All orders']].map(([val,label]) => (
                <button key={val} onClick={() => setPeriod(val)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{background:period===val?'white':'transparent', color:period===val?'var(--tn-dark)':'var(--tn-gold)', boxShadow:period===val?'0 1px 3px rgba(0,0,0,0.1)':'none'}}>
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-8" style={{color:'var(--tn-gold)'}}>Loading orders...</div>
            ) : orders.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-3xl mb-2">📦</p>
                <p className="font-medium">No orders found</p>
                <p className="text-sm mt-1" style={{color:'var(--tn-gold)'}}>No orders for this period</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map(order => {
                  const b = STATUS_BADGE[order.status] || STATUS_BADGE.waiting;
                  return (
                    <div key={order.id} className="card p-4 cursor-pointer" onClick={() => setSelected(order)}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs mb-1" style={{color:'var(--tn-red)'}}>{order.id}</p>
                          <p className="font-semibold text-sm truncate">{order.to_business_name || order.address}</p>
                          <p className="text-xs mt-0.5 truncate" style={{color:'var(--tn-gold)'}}>{order.address}</p>
                        </div>
                        <span className={`badge ${b.cls} flex-shrink-0`}>{b.label}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2" style={{borderTop:'0.5px solid var(--tn-border)'}}>
                        <p className="text-xs" style={{color:'var(--tn-gold)'}}>{String(order.date||'').split('T')[0]}</p>
                        <div className="flex items-center gap-2">
                          {(order.status === 'enroute' || order.status === 'picked') && (
                            <button onClick={e=>{ e.stopPropagation(); navigate(`/track/${order.id}`); }}
                              className="btn btn-sm text-xs" style={{background:'#185FA5',color:'white'}}>
                              🗺️ Track live
                            </button>
                          )}
                          {order.status === 'delivered' && order.photo_url && (
                            <a href={`/api/orders/${order.id}/proof-pdf`} target="_blank" rel="noreferrer"
                              onClick={e=>e.stopPropagation()}
                              className="btn btn-sm text-xs" style={{background:'#0F6E56',color:'white'}}>
                              ⬇ Proof
                            </a>
                          )}
                          <p className="text-xs font-semibold">${parseFloat(order.amount||0).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'invoices' && client?.role === 'finance' && (
          <div className="space-y-3">
            {invoices.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-3xl mb-2">📄</p>
                <p className="font-medium">No invoices found</p>
              </div>
            ) : invoices.map(inv => (
              <div key={inv.id} className="card p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-mono text-sm font-bold" style={{color:'var(--tn-red)'}}>#{inv.id}</p>
                    <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>
                      {String(inv.date_from||'').split('T')[0]} – {String(inv.date_to||'').split('T')[0]}
                    </p>
                  </div>
                  <span className={`badge ${inv.status==='paid'?'badge-success':inv.status==='overdue'?'badge-danger':'badge-warning'}`}>
                    {inv.status?.charAt(0).toUpperCase()+inv.status?.slice(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2" style={{borderTop:'0.5px solid var(--tn-border)'}}>
                  <p className="font-semibold text-sm">{fmt(inv.amount || inv.total)}</p>
                  {inv.pdf_url && (
                    <a href={inv.pdf_url} target="_blank" rel="noreferrer"
                      className="btn btn-sm text-xs" style={{background:'var(--tn-red)',color:'white'}}>
                      ⬇ Download PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order detail modal */}
      {selected && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{background:'rgba(26,18,8,0.6)'}} onClick={() => setSelected(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto"
            style={{background:'var(--tn-cream)'}} onClick={e=>e.stopPropagation()}>
            <div className="px-6 flex items-center justify-between sticky top-0"
              style={{background:'var(--tn-dark)', paddingTop:'max(16px, env(safe-area-inset-top))', paddingBottom:'16px'}}>
              <div>
                <p className="font-mono text-xs" style={{color:'rgba(250,247,240,0.4)'}}>{selected.id}</p>
                <p className="font-semibold" style={{color:'var(--tn-cream)'}}>Order details</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${STATUS_BADGE[selected.status]?.cls||'badge-gray'}`}>
                  {STATUS_BADGE[selected.status]?.label||selected.status}
                </span>
                <button onClick={() => setSelected(null)} className="text-xl" style={{color:'rgba(250,247,240,0.4)'}}>×</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{color:'var(--tn-red)'}}>🚚 Delivery details</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label:'Address',      val: selected.address },
                    { label:'Business',     val: selected.to_business_name },
                    { label:'Date',         val: String(selected.date||'').split('T')[0] },
                    { label:'Boxes',        val: selected.boxes },
                    { label:'PO Number',    val: selected.po_number },
                    { label:'Deliver by',   val: selected.requested_delivery_time },
                    { label:'Dropoff date', val: selected.to_dropoff_date },
                  ].filter(i=>i.val).map((item,i)=>(
                    <div key={i} className={item.label==='Address'||item.label==='Business'?'col-span-2':''}>
                      <p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.label}</p>
                      <p className="font-semibold text-sm mt-0.5">{item.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selected.notes && (
                <div className="rounded-xl p-3" style={{background:'#FEF3C7',border:'0.5px solid #D97706'}}>
                  <p className="text-xs mb-1 font-medium" style={{color:'#92400E'}}>📝 Notes</p>
                  <p className="text-sm" style={{color:'#92400E'}}>{selected.notes}</p>
                </div>
              )}

              {selected.status === 'delivered' && (
                <div className="space-y-2">
                  {selected.photo_url && (
                    <div>
                      <p className="text-xs mb-1 font-medium" style={{color:'var(--tn-gold)'}}>📷 Delivery photo</p>
                      <img src={selected.photo_url} alt="Proof" className="w-full rounded-xl object-cover" style={{maxHeight:'200px'}}/>
                    </div>
                  )}
                  {selected.photo_url && (
                    <a href={`/api/orders/${selected.id}/proof-pdf`} target="_blank" rel="noreferrer"
                      className="btn w-full justify-center text-sm" style={{background:'#0F6E56',color:'white'}}>
                      ⬇ Download proof of delivery
                    </a>
                  )}
                </div>
              )}

              {(selected.status === 'enroute' || selected.status === 'picked') && (
                <button onClick={() => navigate(`/track/${selected.id}`)}
                  className="btn w-full justify-center" style={{background:'#185FA5',color:'white'}}>
                  🗺️ Track live
                </button>
              )}

              <button onClick={() => setSelected(null)}
                className="btn w-full justify-center" style={{background:'var(--tn-red)',color:'white'}}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change password modal */}
      {showChangePwd && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.6)'}}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" style={{background:'var(--tn-cream)'}}>
            <div className="px-5 py-4 flex items-center justify-between" style={{background:'var(--tn-dark)',borderRadius:'16px 16px 0 0'}}>
              <p className="font-semibold" style={{color:'var(--tn-cream)'}}>🔑 Change password</p>
              <button onClick={() => { setShowChangePwd(false); setNewPassword(''); setConfirmPassword(''); setPwdError(''); }}
                className="text-xl" style={{color:'rgba(250,247,240,0.4)'}}>×</button>
            </div>
            <div className="p-5 space-y-3">
              {pwdSuccess ? (
                <div className="text-center py-4">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="font-semibold">Password changed successfully!</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="label">New password</label>
                    <input type="password" className="input" placeholder="At least 6 characters"
                      value={newPassword} onChange={e=>setNewPassword(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Confirm new password</label>
                    <input type="password" className="input" placeholder="Repeat new password"
                      value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} />
                  </div>
                  {pwdError && (
                    <p className="text-xs px-3 py-2 rounded-lg" style={{background:'#FEE2E2',color:'#991B1B'}}>{pwdError}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setShowChangePwd(false); setNewPassword(''); setConfirmPassword(''); setPwdError(''); }}
                      className="btn btn-outline flex-1 justify-center">Cancel</button>
                    <button onClick={handleChangePassword} disabled={savingPwd || !newPassword || !confirmPassword}
                      className="btn flex-1 justify-center"
                      style={{background:'var(--tn-red)',color:'white',opacity:savingPwd||!newPassword||!confirmPassword?0.5:1}}>
                      {savingPwd ? '⏳ Saving...' : 'Save password'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
