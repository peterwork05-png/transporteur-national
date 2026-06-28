import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { CLIENTS } from '../../data/store';

const STEPS = [
  { key:'placed',    label:'Order placed',      icon:'📋' },
  { key:'picked',    label:'Picked up by driver', icon:'📦' },
  { key:'enroute',   label:'On the way',         icon:'🚚' },
  { key:'delivered', label:'Delivered',           icon:'✅' },
];
const STATUS_RANK = { waiting:0, picked:1, enroute:2, delivered:3 };

export default function ClientTracking() {
  const { orderId } = useParams();
  const { orders } = useApp();
  const [tab, setTab] = useState('tracking');
  const [showPickupDetails, setShowPickupDetails] = useState(false);
  const [driverPos, setDriverPos] = useState(0);

  const order = orders.find(o=>o.id===orderId) || orders.find(o=>o.status==='enroute');
  const client = order ? CLIENTS[order.client] : null;
  const rank = order ? (STATUS_RANK[order.status]??0) : 0;

  useEffect(() => {
    if (order?.status==='enroute') {
      const t = setInterval(() => setDriverPos(p => Math.min(p+1,100)), 800);
      return () => clearInterval(t);
    }
  }, [order?.status]);

  const eta  = Math.max(0, Math.round(12 - driverPos*0.12));
  const dist = Math.max(0, (3.2 - driverPos*0.032)).toFixed(1);

  if (!order) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'var(--tn-cream)'}}>
      <div className="text-center">
        <p className="text-4xl mb-3">📦</p>
        <p className="font-medium">Order not found</p>
        <p className="text-sm mt-1" style={{color:'var(--tn-gold)'}}>Check your tracking number</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{background:'var(--tn-cream)'}}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-4" style={{background:'var(--tn-dark)',borderBottom:'0.5px solid rgba(139,105,20,0.2)'}}>
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xl" style={{background:'rgba(139,105,20,0.15)'}}>🦅</div>
            <div>
              <p className="font-mono text-xs" style={{color:'rgba(250,247,240,0.35)'}}>{order.id}</p>
              <p className="font-semibold" style={{color:'var(--tn-cream)'}}>Track your delivery</p>
            </div>
          </div>
          <span className={`badge ${rank>=3?'badge-success':rank>=2?'badge-info':rank>=1?'badge-warning':'badge-gray'}`}>
            {rank>=3?'Delivered':rank>=2?'On the way':rank>=1?'Picked up':'Processing'}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {[['tracking','Tracking'],['details','Order details'],['proof','Proof of delivery']].map(([val,label]) => (
            <button key={val} onClick={() => setTab(val)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{background:tab===val?'var(--tn-red)':'white', color:tab===val?'white':'var(--tn-gold)', border:'0.5px solid var(--tn-border)'}}>
              {label}
            </button>
          ))}
        </div>

        {tab==='tracking' && (
          <div className="space-y-3">
            {/* Live map */}
            {order.status==='enroute' && (
              <div className="card overflow-hidden">
                <div className="relative h-44" style={{background:'#eef5ee'}}>
                  <svg viewBox="0 0 400 176" className="w-full h-full">
                    <rect width="400" height="176" fill="#eef5ee"/>
                    <rect x="0" y="64" width="400" height="14" fill="white" opacity="0.9"/>
                    <rect x="60" y="0" width="12" height="176" fill="white" opacity="0.9"/>
                    <rect x="160" y="0" width="12" height="176" fill="white" opacity="0.9"/>
                    <rect x="300" y="0" width="10" height="176" fill="white" opacity="0.9"/>
                    <line x1="0" y1="71" x2="400" y2="71" stroke="#ddd" strokeWidth="1" strokeDasharray="8,6"/>
                    <polyline points={`60,136 60,71 ${60+driverPos*2.4},71 ${Math.min(320,60+driverPos*2.4)},${driverPos>80?45:71}`} stroke="#C0392B" strokeWidth="2.5" fill="none" strokeDasharray="6,4" opacity="0.7"/>
                    <circle cx="320" cy="71" r="8" fill="#8B6914" opacity="0.2"/>
                    <circle cx="320" cy="71" r="5" fill="#8B6914"/>
                    <circle cx={Math.min(320,60+driverPos*2.4)} cy={driverPos>80?45:71} r="10" fill="#C0392B" opacity="0.2"/>
                    <circle cx={Math.min(320,60+driverPos*2.4)} cy={driverPos>80?45:71} r="6" fill="#C0392B"/>
                    <text x="320" y="88" textAnchor="middle" fontSize="9" fill="#8B6914" fontWeight="600">DEST</text>
                  </svg>
                  <div className="absolute bottom-2 left-2 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shadow-sm text-xs" style={{background:'white'}}>
                    <div className="w-2 h-2 rounded-full" style={{background:'var(--tn-red)',animation:'pulse 1.5s infinite'}}/>
                    Live · updating
                  </div>
                </div>
                <div className="grid grid-cols-3 divide-x p-3" style={{borderColor:'var(--tn-border)'}}>
                  <div className="text-center"><p className="font-bold" style={{color:'var(--tn-red)'}}>{eta>0?`${eta} min`:'Arriving'}</p><p className="text-xs" style={{color:'var(--tn-gold)'}}>ETA</p></div>
                  <div className="text-center"><p className="font-bold">{dist} km</p><p className="text-xs" style={{color:'var(--tn-gold)'}}>Distance</p></div>
                  <div className="text-center"><p className="font-bold">{order.boxes} boxes</p><p className="text-xs" style={{color:'var(--tn-gold)'}}>This order</p></div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="card p-4">
              <p className="font-semibold text-sm mb-4">Delivery progress</p>
              {STEPS.map((step, i) => {
                const done    = i<rank||(i===rank&&rank===3);
                const active  = i===rank&&rank<3;
                const pending = i>rank;
                return (
                  <div key={step.key}>
                    <div className={`flex items-start gap-3 ${step.key==='picked'&&rank>=1?'cursor-pointer':''}`}
                      onClick={() => step.key==='picked'&&rank>=1&&setShowPickupDetails(true)}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                        style={{background:done?'#E8F5EF':active?'rgba(192,57,43,0.1)':'var(--tn-warm)'}}>
                        {pending ? <span style={{opacity:0.3}}>{step.icon}</span> : step.icon}
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium" style={{color:pending?'rgba(26,18,8,0.35)':'var(--tn-dark)'}}>{step.label}</p>
                          {step.key==='picked'&&rank>=1 && <span className="text-xs" style={{color:'var(--tn-red)'}}>View details →</span>}
                        </div>
                        <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>
                          {step.key==='placed'?'Today, 9:14 AM':
                           step.key==='picked'&&rank>=1?`Today, ${order.pickedUpAt} · Marc D.`:
                           step.key==='enroute'&&rank>=2?`Est. arrival in ${eta} min`:
                           step.key==='delivered'&&rank>=3?`Today, ${order.deliveredAt}`:'Awaiting'}
                        </p>
                      </div>
                    </div>
                    {i<STEPS.length-1 && <div className="ml-4 w-0.5 h-5 my-1" style={{background:i<rank?'rgba(192,57,43,0.2)':'var(--tn-warm)'}} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab==='details' && (
          <div className="card p-4 space-y-3">
            <p className="font-semibold text-sm mb-1">Order summary</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                {label:'Client',  val:client?.name||'—'},
                {label:'Driver',  val:'Marc Dumont'},
                {label:'Boxes',   val:`${order.boxes} boxes`},
                {label:'Amount',  val:`$${order.amount}`},
              ].map((item,i) => (
                <div key={i} className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                  <p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.label}</p>
                  <p className="font-medium text-sm mt-0.5">{item.val}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
              <p className="text-xs" style={{color:'var(--tn-gold)'}}>Delivery address</p>
              <p className="font-medium text-sm mt-0.5">{order.address}</p>
            </div>
          </div>
        )}

        {tab==='proof' && (
          <div className="card p-4">
            <p className="font-semibold text-sm mb-1">Proof of delivery</p>
            <p className="text-xs mb-3" style={{color:'var(--tn-gold)'}}>{rank>=3?'Delivery confirmed':'Available once delivery is confirmed'}</p>
            <div className="grid grid-cols-2 gap-3">
              {[{icon:'📷',label:'Delivery photo'},{icon:'✍️',label:'Signature'}].map((item,i) => (
                <div key={i} className="rounded-xl h-24 flex flex-col items-center justify-center gap-1.5" style={{background:rank>=3?'#E8F5EF':'var(--tn-warm)',border:'0.5px solid var(--tn-border)'}}>
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-xs" style={{color:'var(--tn-gold)'}}>{item.label}</span>
                  {rank>=3 && <span className="badge badge-success" style={{fontSize:'10px'}}>View</span>}
                </div>
              ))}
            </div>
            {rank>=3 && (
              <div className="mt-3 rounded-xl p-3 grid grid-cols-2 gap-3" style={{background:'var(--tn-warm)'}}>
                <div><p className="text-xs" style={{color:'var(--tn-gold)'}}>Received by</p><p className="text-sm font-medium">Store manager</p></div>
                <div><p className="text-xs" style={{color:'var(--tn-gold)'}}>Delivered at</p><p className="text-sm font-medium">{order.deliveredAt}</p></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pickup details sheet */}
      {showPickupDetails && rank>=1 && (
        <div className="fixed inset-0 flex items-end z-50" style={{background:'rgba(26,18,8,0.6)'}} onClick={() => setShowPickupDetails(false)}>
          <div className="w-full rounded-t-2xl p-5 max-w-lg mx-auto" style={{background:'var(--tn-cream)'}} onClick={e=>e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{background:'var(--tn-border-strong)'}}/>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Pickup details</h2>
              <button onClick={() => setShowPickupDetails(false)} className="text-xl leading-none" style={{color:'var(--tn-gold)'}}>×</button>
            </div>
            <div className="flex items-center gap-3 mb-4 pb-4" style={{borderBottom:'0.5px solid var(--tn-border)'}}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{background:'var(--tn-red)'}}>MD</div>
              <div><p className="font-semibold">Marc Dumont</p><p className="text-xs" style={{color:'var(--tn-gold)'}}>Your driver today</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[
                {label:'Time picked up', val:order.pickedUpAt||'—', sub:'Today'},
                {label:'Est. delivery',  val:eta>0?`~${eta} min`:'Soon', sub:'Based on route'},
                {label:'Order ID',       val:order.id, mono:true},
                {label:'Boxes',          val:`${order.boxes} boxes`},
              ].map((item,i) => (
                <div key={i} className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                  <p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.label}</p>
                  <p className={`font-medium text-sm mt-0.5 ${item.mono?'font-mono text-xs':''}`}>{item.val}</p>
                  {item.sub && <p className="text-xs mt-0.5" style={{color:'rgba(139,105,20,0.5)'}}>{item.sub}</p>}
                </div>
              ))}
            </div>
            <div className="rounded-xl p-3 flex items-center gap-2" style={{background:'var(--tn-warm)'}}>
              <span>🏭</span>
              <div><p className="text-sm font-medium">Entrepôt Principal</p><p className="text-xs" style={{color:'var(--tn-gold)'}}>1200 Rue Louvain O, Montréal</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
