import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { CLIENTS } from '../../data/store';

export default function TrackSearch() {
  const { orders } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) return;
    const q = query.toLowerCase().trim();
    const found = orders.filter(o =>
      o.id.toLowerCase().includes(q) ||
      o.address.toLowerCase().includes(q) ||
      o.date.toLowerCase().includes(q) ||
      CLIENTS[o.client]?.name.toLowerCase().includes(q)
    );
    setResults(found);
    setSearched(true);
  };

  const STATUS_LABEL = { waiting:'Processing', picked:'Picked up', enroute:'On the way', delivered:'Delivered' };
  const STATUS_COLOR = { waiting:'badge-gray', picked:'badge-warning', enroute:'badge-info', delivered:'badge-success' };

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
              placeholder="Order number, address, or date..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key==='Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">🔍</button>
          </div>
          <button onClick={handleSearch} className="w-full py-3 rounded-xl font-medium text-sm" style={{background:'var(--tn-red)',color:'white'}}>
            Search
          </button>

          {/* Quick examples */}
          <div className="mt-3 pt-3" style={{borderTop:'0.5px solid rgba(139,105,20,0.15)'}}>
            <p className="text-xs mb-2" style={{color:'rgba(250,247,240,0.25)'}}>Try searching:</p>
            <div className="flex flex-wrap gap-2">
              {['DEL-2026-0847','Jun 26, 2026','Ontario St','Jonarts'].map(ex => (
                <button key={ex} onClick={() => { setQuery(ex); }}
                  className="text-xs px-3 py-1 rounded-full"
                  style={{background:'rgba(139,105,20,0.12)',color:'rgba(250,247,240,0.45)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        {searched && (
          <div>
            {results.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.15)'}}>
                <p className="text-3xl mb-3">🔍</p>
                <p className="font-medium" style={{color:'var(--tn-cream)'}}>No orders found</p>
                <p className="text-sm mt-1" style={{color:'rgba(250,247,240,0.35)'}}>Try a different order number, address or date</p>
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
                      <span className={`badge ${STATUS_COLOR[order.status]}`}>{STATUS_LABEL[order.status]}</span>
                    </div>
                    <p className="text-sm font-medium mb-1" style={{color:'var(--tn-cream)'}}>{order.address}</p>
                    <p className="text-xs" style={{color:'rgba(250,247,240,0.35)'}}>
                      {CLIENTS[order.client]?.name} · {order.date} · {order.boxes} box{order.boxes>1?'es':''}
                    </p>
                    <p className="text-xs mt-2" style={{color:'var(--tn-red)'}}>Tap to track live →</p>
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
