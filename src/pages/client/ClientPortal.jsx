import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

const STATUS_BADGE = {
  waiting:   { label:'Processing',  cls:'badge-gray' },
  picked:    { label:'Picked up',   cls:'badge-warning' },
  enroute:   { label:'On the way',  cls:'badge-info' },
  delivered: { label:'Delivered',   cls:'badge-success' },
};

export default function ClientPortal() {
  const { clientLogin } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [client, setClient] = useState(null);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tab, setTab] = useState('orders');
  const [proofOrder, setProofOrder] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await clientLogin(email, password);
    setLoading(false);
    if (result.success) {
      setClient(result.client);
    } else {
      setError('Invalid email or password.');
    }
  };

  useEffect(() => {
    if (!client) return;
    const load = async () => {
      try {
        const r1 = await fetch('/api/orders?client_id=' + client.id);
        const orders = await r1.json();
        setOrders(orders.map(o => ({
          id: o.id,
          date: new Date(o.date).toLocaleDateString('en-CA', {month:'short',day:'numeric',year:'numeric'}),
          address: o.address, boxes: o.boxes, amount: parseFloat(o.amount),
          status: o.status, driver: o.driver_name||'Driver',
          deliveredAt: o.delivered_at, hasProof: o.status==='delivered',
        })));
      } catch(e) {}
      try {
        const r2 = await fetch('/api/invoices?client_id=' + client.id);
        const invs = await r2.json();
        setInvoices(invs.map(i => ({
          id: i.id, dates: (i.date_from||'') + ' - ' + (i.date_to||''),
          amount: parseFloat(i.total||0), status: i.status, type: i.type, eft: i.eft_number,
        })));
      } catch(e) {}
    };
    load();
  }, [client]);

  const fmt = n => `$${parseFloat(n||0).toLocaleString('fr-CA',{minimumFractionDigits:2})}`;
  const delivered = orders.filter(o => o.status==='delivered').length;
  const thisWeek = orders.slice(0, 5);
  const totalBoxes = thisWeek.reduce((s,o) => s+o.boxes, 0);

  if (!client) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'var(--tn-dark)'}}>
      <div style={{position:'fixed',top:'-80px',right:'-80px',width:'300px',height:'300px',background:'var(--tn-red)',borderRadius:'50%',opacity:0.06,pointerEvents:'none'}}/>
      <div style={{position:'fixed',bottom:'-60px',left:'-60px',width:'200px',height:'200px',background:'var(--tn-gold)',borderRadius:'50%',opacity:0.08,pointerEvents:'none'}}/>
      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{background:'rgba(139,105,20,0.15)',border:'1px solid rgba(139,105,20,0.25)'}}>
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
              <input type="email" className="input" style={{background:'rgba(250,247,240,0.06)',borderColor:'rgba(139,105,20,0.2)',color:'var(--tn-cream)'}} placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
            </div>
            <div>
              <label className="label" style={{color:'rgba(250,247,240,0.4)'}}>Password</label>
              <input type="password" className="input" style={{background:'rgba(250,247,240,0.06)',borderColor:'rgba(139,105,20,0.2)',color:'var(--tn-cream)'}} placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required/>
            </div>
            {error && <p className="text-xs px-3 py-2 rounded-lg" style={{background:'rgba(192,57,43,0.15)',color:'#F87171'}}>{error}</p>}
            <button type="submit" disabled={loading} className="btn w-full justify-center py-3 mt-2" style={{background:'var(--tn-red)',color:'white',opacity:loading?0.7:1}}>
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs mt-4" style={{color:'rgba(250,247,240,0.15)'}}>Need access? Contact transporteurnationalmc@gmail.com</p>
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
              <p className="text-xs" style={{color:'rgba(250,247,240,0.35)'}}>Client portal</p>
              <p className="text-sm font-semibold" style={{color:'var(--tn-cream)'}}>{client.name}</p>
            </div>
          </div>
          <button onClick={() => setClient(null)} className="btn btn-sm" style={{background:'rgba(250,247,240,0.08)',color:'rgba(250,247,240,0.5)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            {label:'Orders this week', val:thisWeek.length, color:'var(--tn-red)'},
            {label:'Boxes this week',  val:totalBoxes,      color:'var(--tn-gold)'},
            {label:'Delivered',        val:delivered,       color:'#0F6E56'},
          ].map((s,i) => (
            <div key={i} className="card p-3 text-center">
              <div className="text-2xl font-semibold" style={{color:s.color}}>{s.val}</div>
              <div className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          {[['orders','Orders'],['invoices','Invoices']].map(([val,label]) => (
            <button key={val} onClick={() => setTab(val)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium"
              style={{background:tab===val?'var(--tn-red)':'white',color:tab===val?'white':'var(--tn-gold)',border:'0.5px solid var(--tn-border)'}}>
              {label}
            </button>
          ))}
        </div>

        {tab==='orders' && (
          <div className="space-y-2">
            {orders.length===0 && <div className="card p-8 text-center" style={{color:'var(--tn-gold)'}}><p className="text-3xl mb-2">📦</p><p className="text-sm">No orders yet</p></div>}
            {orders.map(order => {
              const b = STATUS_BADGE[order.status]||STATUS_BADGE.waiting;
              return (
                <div key={order.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-mono text-xs" style={{color:'var(--tn-gold)'}}>{order.id}</p>
                        <span className={`badge ${b.cls}`}>{b.label}</span>
                      </div>
                      <p className="text-sm font-medium truncate">{order.address}</p>
                      <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>{order.date} · {order.driver} · {order.boxes} box{order.boxes>1?'es':''}</p>
                    </div>
                    <p className="text-sm font-bold flex-shrink-0">{fmt(order.amount)}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2" style={{borderTop:'0.5px solid var(--tn-border)'}}>
                    {order.status==='enroute' && <a href={`/track/${order.id}`} className="btn btn-sm" style={{background:'var(--tn-red)',color:'white'}}>🚚 Track live</a>}
                    {order.hasProof && <button onClick={() => setProofOrder(order)} className="btn btn-outline btn-sm">📋 View proof</button>}
                    {order.status==='delivered' && <p className="text-xs ml-auto" style={{color:'#0F6E56'}}>✓ Delivered {order.deliveredAt}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab==='invoices' && (
          <div className="space-y-2">
            {invoices.length===0 && <div className="card p-8 text-center" style={{color:'var(--tn-gold)'}}><p className="text-3xl mb-2">🧾</p><p className="text-sm">No invoices yet</p></div>}
            {invoices.map(inv => (
              <div key={inv.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-mono text-sm font-semibold">#{inv.id}</p>
                      <span className={`badge ${inv.status==='paid'?'badge-success':inv.status==='overdue'?'badge-danger':'badge-warning'}`}>{inv.status}</span>
                      <span className="badge badge-gray">{inv.type==='contract'?'Contract':'Local'}</span>
                    </div>
                    <p className="text-xs" style={{color:'var(--tn-gold)'}}>{inv.dates}</p>
                    {inv.eft && <p className="text-xs mt-0.5" style={{color:'#0F6E56'}}>EFT #{inv.eft}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{fmt(inv.amount)}</p>
                    <button className="btn btn-outline btn-sm mt-1 text-xs">⬇ PDF</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {proofOrder && (
        <div className="fixed inset-0 flex items-end z-50" style={{background:'rgba(26,18,8,0.6)'}} onClick={() => setProofOrder(null)}>
          <div className="w-full rounded-t-2xl p-5 max-w-2xl mx-auto" style={{background:'var(--tn-cream)'}} onClick={e=>e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{background:'var(--tn-border-strong)'}}/>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Proof of delivery</h2>
              <button onClick={() => setProofOrder(null)} className="text-xl leading-none" style={{color:'var(--tn-gold)'}}>×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[{label:'Order ID',val:proofOrder.id,mono:true},{label:'Delivered',val:proofOrder.date},{label:'Driver',val:proofOrder.driver},{label:'Boxes',val:`${proofOrder.boxes} box${proofOrder.boxes>1?'es':''}`}].map((item,i) => (
                <div key={i} className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                  <p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.label}</p>
                  <p className={`font-medium text-sm mt-0.5 ${item.mono?'font-mono text-xs':''}`}>{item.val}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl h-28 flex flex-col items-center justify-center gap-2" style={{background:'linear-gradient(135deg,#1a3a1a,#2d5a2d)'}}>
                <span className="text-3xl">📷</span><span className="text-white text-xs opacity-70">Delivery photo</span>
                <span className="badge badge-success text-xs">Captured</span>
              </div>
              <div className="rounded-xl h-28 flex flex-col items-center justify-center gap-2" style={{background:'var(--tn-warm)',border:'0.5px solid var(--tn-border)'}}>
                <span className="text-3xl">✍️</span><span className="text-xs" style={{color:'var(--tn-gold)'}}>Signature</span>
                <span className="badge badge-success text-xs">Captured</span>
              </div>
            </div>
            <p className="text-xs text-center" style={{color:'var(--tn-gold)'}}>🔒 Stored securely · Only visible to you</p>
          </div>
        </div>
      )}
    </div>
  );
}
