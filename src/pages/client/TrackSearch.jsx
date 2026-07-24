import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STATUS_LABEL = { waiting:'Processing', picked:'Picked up', enroute:'On the way', delivered:'Delivered' };
const STATUS_COLOR = { waiting:'badge-gray', picked:'badge-warning', enroute:'badge-info', delivered:'badge-success' };

export default function TrackSearch() {
  const navigate  = useNavigate();
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched,setSearched]= useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res  = await fetch(`/api/orders/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch(e) {
      setResults([]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen" style={{background:'var(--tn-dark)'}}>
      <div style={{position:'fixed',top:'-80px',right:'-80px',width:'300px',height:'300px',background:'var(--tn-red)',borderRadius:'50%',opacity:0.06,pointerEvents:'none'}}/>
      <div style={{position:'fixed',bottom:'-60px',left:'-60px',width:'200px',height:'200px',background:'var(--tn-gold)',borderRadius:'50%',opacity:0.08,pointerEvents:'none'}}/>

      <div className="max-w-lg mx-auto p-4 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 py-4 mb-6">
          <button onClick={() => navigate('/')} className="text-sm" style={{color:'rgba(250,247,240,0.4)'}}>← Back</button>
          <div className="flex items-center gap-2 ml-2">
            <span className="text-2xl">📦</span>
            <div>
              <p className="font-semibold" style={{color:'var(--tn-cream)'}}>Track an order</p>
              <p className="text-xs" style={{color:'rgba(250,247,240,0.35)'}}>Transporteur National MC INC.</p>
            </div>
          </div>
        </div>

        {/* Search box */}
        <div className="rounded-2xl p-5 mb-4" style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
          <p className="text-sm font-medium mb-3" style={{color:'var(--tn-cream)'}}>Search your delivery</p>
          <div className="relative mb-3">
            <input
              className="w-full px-4 py-3 rounded-xl text-sm pr-12"
              style={{background:'rgba(250,247,240,0.06)',border:'0.5px solid rgba(139,105,20,0.25)',color:'var(--tn-cream)',outline:'none'}}
              placeholder="Order ID, address, store number, PO#..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key==='Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">🔍</button>
          </div>
          <button onClick={handleSearch} disabled={loading}
            className="w-full py-3 rounded-xl font-medium text-sm"
            style={{background:'var(--tn-red)',color:'white',opacity:loading?0.7:1}}>
            {loading ? 'Searching...' : 'Search'}
          </button>

          {/* Quick examples */}
          <div className="mt-3 pt-3" style={{borderTop:'0.5px solid rgba(139,105,20,0.15)'}}>
            <p className="text-xs mb-2" style={{color:'rgba(250,247,240,0.25)'}}>Try searching:</p>
            <div className="flex flex-wrap gap-2">
              {['DEL-2026-','Ontario St','Staples','Jonarts'].map(ex => (
                <button key={ex} onClick={() => setQuery(ex)}
                  className="text-xs px-3 py-1 rounded-full"
                  style={{background:'rgba(139,105,20,0.12)',color:'rgba(250,247,240,0.45)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        {searched && !loading && (
          <div>
            {!results || results.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.15)'}}>
                <p className="text-3xl mb-3">🔍</p>
                <p className="font-medium" style={{color:'var(--tn-cream)'}}>No orders found</p>
                <p className="text-sm mt-1" style={{color:'rgba(250,247,240,0.35)'}}>Try searching by order ID (DEL-2026-XXXX), address, or store number</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs mb-2" style={{color:'rgba(250,247,240,0.35)'}}>{results.length} result{results.length>1?'s':''} found</p>
                {results.map(order => (
                  <button key={order.id} onClick={() => navigate(`/track/${order.id}`)}
                    className="w-full rounded-xl p-4 text-left transition-all"
                    style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-mono text-xs" style={{color:'var(--tn-gold)'}}>{order.id}</p>
                      <span className={`badge ${STATUS_COLOR[order.status]||'badge-gray'}`}>
                        {STATUS_LABEL[order.status]||order.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-1" style={{color:'var(--tn-cream)'}}>{order.address}</p>
                    <p className="text-xs" style={{color:'rgba(250,247,240,0.35)'}}>
                      {order.client_name || order.to_business_name || ''}
                      {order.date ? ` · ${String(order.date).split('T')[0]}` : ''}
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
      </div>
    </div>
  );
}
