import { useState, useEffect, useCallback } from 'react';

const STATUS_BADGE = {
  waiting:   { label:'Processing',  cls:'badge-gray' },
  picked:    { label:'Picked up',   cls:'badge-warning' },
  enroute:   { label:'En route',    cls:'badge-info' },
  delivered: { label:'Delivered',   cls:'badge-success' },
};

const PERIODS = [
  { val:'today', label:'Today' },
  { val:'7days', label:'Last 7 days' },
  { val:'month', label:'This month' },
  { val:'all',   label:'All time' },
];

const fmt = n => `$${parseFloat(n||0).toLocaleString('fr-CA',{minimumFractionDigits:2})}`;

export default function ClientPortal() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [client,   setClient]   = useState(null);
  const [tab,      setTab]      = useState('orders');
  const [period,   setPeriod]   = useState('7days');
  const [invFilter,setInvFilter]= useState('all');
  const [search,   setSearch]   = useState('');
  const [orders,   setOrders]   = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/client-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) setClient(data.client);
      else setError('Invalid email or password.');
    } catch(e) { setError('Connection error.'); }
    setLoading(false);
  };

  const fetchOrders = useCallback(async () => {
    if (!client) return;
    setOrdersLoading(true);
    try {
      const res = await fetch(`/api/client/orders?client_group=${client.client_group}&period=${period}`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch(e) {}
    setOrdersLoading(false);
  }, [client, period]);

  const fetchInvoices = useCallback(async () => {
    if (!client) return;
    try {
      const res = await fetch(`/api/client/invoices?client_group=${client.client_group}&status=${invFilter}`);
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data : []);
    } catch(e) {}
  }, [client, invFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { if (tab === 'invoices') fetchInvoices(); }, [tab, fetchInvoices]);

  const filteredOrders = orders.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return o.id?.toLowerCase().includes(s) ||
           o.address?.toLowerCase().includes(s) ||
           o.to_associate_name?.toLowerCase().includes(s) ||
           o.store_number?.toLowerCase().includes(s) ||
           o.po_number?.toLowerCase().includes(s);
  });

  const isFinance  = client?.role === 'finance';
  const delivered  = orders.filter(o => o.status === 'delivered').length;
  const inProgress = orders.filter(o => o.status !== 'delivered').length;
  const totalValue = orders.reduce((s,o) => s + parseFloat(o.amount||0), 0);

  if (!client) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'var(--tn-dark)'}}>
      <div style={{position:'fixed',top:'-80px',right:'-80px',width:'300px',height:'300px',background:'var(--tn-red)',borderRadius:'50%',opacity:0.06,pointerEvents:'none'}}/>
      <div style={{position:'fixed',bottom:'-60px',left:'-60px',width:'200px',height:'200px',background:'var(--tn-gold)',borderRadius:'50%',opacity:0.08,pointerEvents:'none'}}/>
      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{background:'rgba(139,105,20,0.15)',border:'1px solid rgba(139,105,20,0.25)'}}>
            <span className="text-4xl">🦅</span>
          </div>
          <h1 className="text-2xl font-semibold" style={{color:'var(--tn-cream)'}}>Client Portal</h1>
          <p className="text-sm mt-1" style={{color:'rgba(250,247,240,0.35)'}}>Transporteur National MC INC.</p>
        </div>
        <div className="rounded-2xl p-5" style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
          <p className="text-xs uppercase tracking-wider mb-4" style={{color:'rgba(250,247,240,0.3)'}}>Sign in to your account</p>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="label" style={{color:'rgba(250,247,240,0.4)'}}>Email</label>
              <input type="email" className="input"
                style={{background:'rgba(250,247,240,0.06)',borderColor:'rgba(139,105,20,0.2)',color:'var(--tn-cream)'}}
                placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
            </div>
            <div>
              <label className="label" style={{color:'rgba(250,247,240,0.4)'}}>Password</label>
              <input type="password" className="input"
                style={{background:'rgba(250,247,240,0.06)',borderColor:'rgba(139,105,20,0.2)',color:'var(--tn-cream)'}}
                placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required/>
            </div>
            {error && <p className="text-xs px-3 py-2 rounded-lg" style={{background:'rgba(192,57,43,0.15)',color:'#F87171'}}>{error}</p>}
            <button type="submit" disabled={loading} className="btn w-full justify-center py-3 mt-2"
              style={{background:'var(--tn-red)',color:'white',opacity:loading?0.7:1}}>
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs mt-4" style={{color:'rgba(250,247,240,0.15)'}}>
          Need access? Contact transporteurnationalmc@gmail.com
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{background:'var(--tn-cream)'}}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{background:'var(--tn-dark)',borderBottom:'0.5px solid rgba(139,105,20,0.2)'}}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xl" style={{background:'rgba(139,105,20,0.15)'}}>🦅</div>
            <div>
              <p className="text-xs" style={{color:'rgba(250,247,240,0.35)'}}>
                {isFinance ? '💳 Finance access' : '📦 Operations access'}
              </p>
              <p className="text-sm font-semibold" style={{color:'var(--tn-cream)'}}>{client.name}</p>
            </div>
          </div>
          <button onClick={() => setClient(null)} className="btn btn-sm"
            style={{background:'rgba(250,247,240,0.08)',color:'rgba(250,247,240,0.5)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            {label:'Delivered',   val:delivered,       color:'#0F6E56'},
            {label:'In progress', val:inProgress,      color:'var(--tn-gold)'},
            {label:'Total value', val:fmt(totalValue), color:'var(--tn-red)'},
          ].map((s,i)=>(
            <div key={i} className="card p-3 text-center">
              <div className="text-lg font-semibold" style={{color:s.color}}>{s.val}</div>
              <div className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={()=>setTab('orders')}
            className="px-4 py-1.5 rounded-lg text-sm font-medium"
            style={{background:tab==='orders'?'var(--tn-red)':'white',color:tab==='orders'?'white':'var(--tn-gold)',border:'0.5px solid var(--tn-border)'}}>
            Orders
          </button>
          {isFinance && (
            <button onClick={()=>setTab('invoices')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium"
              style={{background:tab==='invoices'?'var(--tn-red)':'white',color:tab==='invoices'?'white':'var(--tn-gold)',border:'0.5px solid var(--tn-border)'}}>
              Invoices
            </button>
          )}
        </div>

        {tab==='orders' && (
          <>
            <div className="flex gap-1 mb-3 p-1 rounded-xl overflow-x-auto" style={{background:'var(--tn-warm)'}}>
              {PERIODS.map(p=>(
                <button key={p.val} onClick={()=>setPeriod(p.val)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0"
                  style={{
                    background:period===p.val?'white':'transparent',
                    color:period===p.val?'var(--tn-dark)':'var(--tn-gold)',
                    boxShadow:period===p.val?'0 1px 3px rgba(0,0,0,0.1)':'none',
                  }}>
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mb-3">
              <input className="input" placeholder="🔍 Search by address, PO#, store, name..."
                value={search} onChange={e=>setSearch(e.target.value)} />
            </div>

            {ordersLoading ? (
              <div className="text-center py-8" style={{color:'var(--tn-gold)'}}>Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-3xl mb-2">📦</p>
                <p className="font-medium">No orders found</p>
                <p className="text-sm mt-1" style={{color:'var(--tn-gold)'}}>Try a different time period or search term</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOrders.map(order => {
                  const b = STATUS_BADGE[order.status] || STATUS_BADGE.waiting;
                  return (
                    <div key={order.id} className="card p-4 cursor-pointer" onClick={()=>setSelected(order)}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-mono text-xs" style={{color:'var(--tn-gold)'}}>{order.id}</p>
                            <span className={`badge ${b.cls}`}>{b.label}</span>
                          </div>
                          <p className="text-sm font-medium truncate">{order.address}</p>
                          <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>
                            {String(order.date||'').split('T')[0]}
                            {order.store_number && ` · ${order.store_number}`}
                            {order.boxes && ` · ${order.boxes} box${order.boxes>1?'es':''}`}
                          </p>
                          {order.to_associate_name && <p className="text-xs" style={{color:'var(--tn-gold)'}}>To: {order.to_associate_name}</p>}
                        </div>
                        <p className="text-sm font-bold flex-shrink-0">{fmt(order.amount)}</p>
                      </div>
                      {order.status==='delivered' && (
                        <div className="flex items-center gap-1 mt-1 pt-1" style={{borderTop:'0.5px solid var(--tn-border)'}}>
                          <span className="text-xs" style={{color:'#0F6E56'}}>✓ {order.delivered_at}</span>
                          {order.driver_name && <span className="text-xs" style={{color:'var(--tn-gold)'}}>· {order.driver_name}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab==='invoices' && isFinance && (
          <>
            <div className="flex gap-2 mb-4 flex-wrap">
              {[['all','All'],['pending','Pending'],['paid','Paid'],['overdue','Overdue']].map(([val,label])=>(
                <button key={val} onClick={()=>setInvFilter(val)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{background:invFilter===val?'var(--tn-red)':'white',color:invFilter===val?'white':'var(--tn-gold)',border:'0.5px solid var(--tn-border)'}}>
                  {label}
                </button>
              ))}
            </div>
            {invoices.length===0 ? (
              <div className="card p-8 text-center">
                <p className="text-3xl mb-2">🧾</p>
                <p className="font-medium">No invoices found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map(inv=>(
                  <div key={inv.id} className="card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-mono text-sm font-bold" style={{color:'var(--tn-red)'}}>#{inv.id}</p>
                          <span className={`badge ${inv.status==='paid'?'badge-success':inv.status==='overdue'?'badge-danger':'badge-warning'}`}>
                            {inv.status?.charAt(0).toUpperCase()+inv.status?.slice(1)}
                          </span>
                        </div>
                        <p className="text-xs" style={{color:'var(--tn-gold)'}}>{inv.date_from||''} – {inv.date_to||''}</p>
                        <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>
                          {inv.type==='contract'?`Contract · ${inv.route} route`:'Local deliveries'}
                        </p>
                        {inv.eft_number && <p className="text-xs mt-0.5" style={{color:'#0F6E56'}}>EFT #{inv.eft_number}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{fmt(inv.total||inv.amount)}</p>
                        {inv.pdf_url
                          ? <a href={inv.pdf_url} target="_blank" rel="noreferrer"
                              className="btn btn-outline btn-sm mt-1 text-xs" onClick={e=>e.stopPropagation()}>
                              ⬇ View PDF
                            </a>
                          : <span className="text-xs mt-1 block" style={{color:'var(--tn-gold)'}}>PDF pending</span>
                        }
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 flex items-end z-50" style={{background:'rgba(26,18,8,0.6)'}} onClick={()=>setSelected(null)}>
          <div className="w-full rounded-t-2xl max-w-2xl mx-auto max-h-[85vh] overflow-y-auto"
            style={{background:'var(--tn-cream)'}} onClick={e=>e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-3" style={{background:'var(--tn-border-strong)'}}/>
            <div className="px-5 pb-6 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-xs" style={{color:'var(--tn-gold)'}}>{selected.id}</p>
                  <h2 className="font-semibold">Order details</h2>
                </div>
                <span className={`badge ${STATUS_BADGE[selected.status]?.cls||'badge-gray'}`}>
                  {STATUS_BADGE[selected.status]?.label||selected.status}
                </span>
              </div>

              <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs mb-1" style={{color:'var(--tn-gold)'}}>Delivery address</p>
                <p className="font-medium text-sm">{selected.address}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  {label:'Date',      val:String(selected.date||'').split('T')[0]},
                  {label:'Boxes',     val:`${selected.boxes} boxes`},
                  {label:'Amount',    val:fmt(selected.amount)},
                  {label:'Driver',    val:selected.driver_name||'—'},
                  selected.store_number && {label:'Store',      val:selected.store_number},
                  selected.po_number    && {label:'PO #',       val:selected.po_number},
                  selected.to_associate_name && {label:'Recipient', val:selected.to_associate_name},
                  selected.requested_delivery_time && {label:'Deliver by', val:selected.requested_delivery_time},
                ].filter(Boolean).map((item,i)=>(
                  <div key={i} className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                    <p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.label}</p>
                    <p className="font-medium text-sm mt-0.5">{item.val}</p>
                  </div>
                ))}
              </div>

              {selected.notes && (
                <div className="rounded-xl p-3" style={{background:'#FEF3C7',border:'0.5px solid #D97706'}}>
                  <p className="text-xs mb-1 font-medium" style={{color:'#92400E'}}>📝 Notes</p>
                  <p className="text-sm" style={{color:'#92400E'}}>
                    {selected.notes.startsWith('Notes:')?selected.notes.split('|')[0].replace('Notes:','').trim():selected.notes}
                  </p>
                </div>
              )}

              {selected.status==='delivered' && (
                <div className="grid grid-cols-2 gap-3">
                  {[{icon:'📷',label:'Delivery photo'},{icon:'✍️',label:'Signature',sub:selected.recipient_name}].map((item,i)=>(
                    <div key={i} className="rounded-xl p-3 flex items-center gap-2" style={{background:'#E8F5EF'}}>
                      <span>{item.icon}</span>
                      <div>
                        <p className="text-xs font-medium" style={{color:'#0F6E56'}}>{item.label}</p>
                        <p className="text-xs" style={{color:'#0F6E56'}}>{item.sub||'Captured'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={()=>setSelected(null)} className="btn w-full justify-center"
                style={{background:'var(--tn-red)',color:'white'}}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
