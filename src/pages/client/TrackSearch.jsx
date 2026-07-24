import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STATUS_LABEL = { waiting:'Processing', picked:'Picked up', enroute:'On the way', delivered:'Delivered' };
const STATUS_COLOR = { waiting:'badge-gray', picked:'badge-warning', enroute:'badge-info', delivered:'badge-success' };

export default function TrackSearch() {
  const navigate = useNavigate();

  const [client,   setClient]   = useState(null);
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loggingIn,setLoggingIn]= useState(false);
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginErr('');
    try {
      const res  = await fetch('/api/auth/client-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) setClient(data.client);
      else setLoginErr('Invalid email or password.');
    } catch(e) { setLoginErr('Connection error.'); }
    setLoggingIn(false);
  };

  const handleSearch = async () => {
    if (!query.trim() || !client) return;
    setLoading(true);
    setSearched(true);
    try {
      const res  = await fetch(`/api/orders/search?q=${encodeURIComponent(query.trim())}&client_group=${client.client_group}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch(e) { setResults([]); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen" style={{background:'var(--tn-dark)'}}>
      <div style={{position:'fixed',top:'-80px',right:'-80px',width:'300px',height:'300px',background:'var(--tn-red)',borderRadius:'50%',opacity:0.06,pointerEvents:'none'}}/>
      <div style={{position:'fixed',bottom:'-60px',left:'-60px',width:'200px',height:'200px',background:'var(--tn-gold)',borderRadius:'50%',opacity:0.08,pointerEvents:'none'}}/>

      <div className="max-w-lg mx-auto p-4 relative z-10">
        <div className="flex items-center gap-3 py-4 mb-6">
          <button onClick={() => navigate('/')} className="text-sm" style={{color:'rgba(250,247,240,0.4)'}}>← Back</button>
          <div className="flex items-center gap-2 ml-2">
            <span className="text-2xl">📦</span>
            <div>
              <p className="font-semibold" style={{color:'var(--tn-cream)'}}>Track an order</p>
              <p className="text-xs" style={{color:'rgba(250,247,240,0.35)'}}>Transporteur National MC INC.</p>
            </div>
          </div>
          {client && (
            <button onClick={() => { setClient(null); setResults(null); setSearched(false); setQuery(''); }}
              className="ml-auto text-xs px-3 py-1 rounded-lg"
              style={{background:'rgba(250,247,240,0.08)',color:'rgba(250,247,240,0.4)'}}>
              Sign out
            </button>
          )}
        </div>

        {!client ? (
          <div className="rounded-2xl p-5" style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
            <p className="text-sm font-medium mb-1" style={{color:'var(--tn-cream)'}}>Sign in to track your order</p>
            <p className="text-xs mb-4" style={{color:'rgba(250,247,240,0.35)'}}>Use your client portal credentials</p>
            <form onSubmit={handleLogin} className="space-y-3">
              <input type="email" className="w-full px-4 py-3 rounded-xl text-sm"
                style={{background:'rgba(250,247,240,0.06)',border:'0.5px solid rgba(139,105,20,0.25)',color:'var(--tn-cream)',outline:'none'}}
                placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
              <input type="password" className="w-full px-4 py-3 rounded-xl text-sm"
                style={{background:'rgba(250,247,240,0.06)',border:'0.5px solid rgba(139,105,20,0.25)',color:'var(--tn-cream)',outline:'none'}}
                placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
              {loginErr && <p className="text-xs px-3 py-2 rounded-lg" style={{background:'rgba(192,57,43,0.15)',color:'#F87171'}}>{loginErr}</p>}
              <button type="submit" disabled={loggingIn}
                className="w-full py-3 rounded-xl font-medium text-sm"
                style={{background:'var(--tn-red)',color:'white',opacity:loggingIn?0.7:1}}>
                {loggingIn ? 'Signing in...' : 'Sign in →'}
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="rounded-2xl p-4 mb-4 flex items-center gap-3" style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
              <span style={{color:'#4ADE80'}}>✓</span>
              <div>
                <p className="text-sm font-medium" style={{color:'var(--tn-cream)'}}>{client.name}</p>
                <p className="text-xs" style={{color:'rgba(250,247,240,0.35)'}}>{client.email}</p>
              </div>
            </div>

            <div className="rounded-2xl p-5 mb-4" style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
              <p className="text-sm font-medium mb-3" style={{color:'var(--tn-cream)'}}>Enter your order number</p>
              <div className="relative mb-3">
                <input
                  className="w-full px-4 py-3 rounded-xl text-sm pr-12"
                  style={{background:'rgba(250,247,240,0.06)',border:'0.5px solid rgba(139,105,20,0.25)',color:'var(--tn-cream)',outline:'none'}}
                  placeholder="e.g. DEL-2026-6188"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && handleSearch()}
                />
                <button onClick={handleSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">🔍</button>
              </div>
              <button onClick={handleSearch} disabled={loading}
                className="w-full py-3 rounded-xl font-medium text-sm"
                style={{background:'var(--tn-red)',color:'white',opacity:loading?0.7:1}}>
                {loading ? 'Searching...' : 'Track order'}
              </button>
            </div>

            {searched && !loading && (
              <div>
                {!results || results.length === 0 ? (
                  <div className="rounded-2xl p-8 text-center" style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.15)'}}>
                    <p className="text-3xl mb-3">🔍</p>
                    <p className="font-medium" style={{color:'var(--tn-cream)'}}>No orders found</p>
                    <p className="text-sm mt-1" style={{color:'rgba(250,247,240,0.35)'}}>Check the order number and try again</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs mb-2" style={{color:'rgba(250,247,240,0.35)'}}>{results.length} result{results.length>1?'s':''} found</p>
                    {results.map(order => (
                      <button key={order.id} onClick={() => navigate(`/track/${order.id}`)}
                        className="w-full rounded-xl p-4 text-left"
                        style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-mono text-xs" style={{color:'var(--tn-gold)'}}>{order.id}</p>
                          <span className={`badge ${STATUS_COLOR[order.status]||'badge-gray'}`}>
                            {STATUS_LABEL[order.status]||order.status}
                          </span>
                        </div>
                        <p className="text-sm font-medium mb-1" style={{color:'var(--tn-cream)'}}>{order.address}</p>
                        <p className="text-xs" style={{color:'rgba(250,247,240,0.35)'}}>
                          {String(order.date||'').split('T')[0]}
                          {order.boxes ? ` · ${order.boxes} box${order.boxes>1?'es':''}` : ''}
                          {order.store_number ? ` · ${order.store_number}` : ''}
                        </p>
                        <p className="text-xs mt-2" style={{color:'var(--tn-red)'}}>Tap to track →</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
