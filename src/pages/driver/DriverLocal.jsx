import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CLIENTS } from '../../data/store';
import { format } from 'date-fns';
import { useParams } from 'react-router-dom';

const STATUS_RANK = { waiting: 0, picked: 1, enroute: 2, delivered: 3 };
const STATUS_LABEL = { waiting: 'Awaiting pickup', picked: 'Picked up', enroute: 'En route', delivered: 'Delivered' };
const STATUS_COLOR = { waiting: 'badge-gray', picked: 'badge-warning', enroute: 'badge-info', delivered: 'badge-success' };

export default function DriverLocal() {
  const { orders, updateOrderStatus } = useApp();
  const { driverId } = useParams();
  const driver = driverId || 'marc';
  const driverName = driver === 'peter' ? 'Peter' : 'Marc Dumont';
  const [activeEnroute, setActiveEnroute] = useState(null);
  const [tab, setTab] = useState('orders');
  const [showProof, setShowProof] = useState(null);
  const [proofStep, setProofStep] = useState(1);
  const [recipientName, setRecipientName] = useState('');
  const [sigDrawn, setSigDrawn] = useState(false);
  const [photoTaken, setPhotoTaken] = useState(false);

  const myOrders = orders.filter(o => o.driver === driver && o.date === '2026-06-26');
  const delivered = myOrders.filter(o => o.status === 'delivered').length;
  const now = () => new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true });

  const pickUp    = id => updateOrderStatus(id, 'picked',  { pickedUpAt: now() });
  const startDelivery = id => { if (activeEnroute) return alert('Finish current delivery first'); setActiveEnroute(id); updateOrderStatus(id, 'enroute', { onWayAt: now() }); };
  const openProof = id => { setShowProof(id); setProofStep(1); setPhotoTaken(false); setSigDrawn(false); setRecipientName(''); };
  const submitDelivery = () => { updateOrderStatus(showProof, 'delivered', { deliveredAt: now() }); setActiveEnroute(null); setShowProof(null); };

  const driverColor = driver === 'peter' ? '#7C3AED' : 'var(--tn-red)';

  return (
    <div className="min-h-screen" style={{ background:'var(--tn-cream)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3" style={{ background:'var(--tn-dark)', borderBottom:'0.5px solid rgba(139,105,20,0.2)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: driverColor }}>
              {driver === 'peter' ? 'PE' : 'MD'}
            </div>
            <div>
              <p className="text-xs" style={{ color:'rgba(250,247,240,0.4)' }}>{driverName} · Local deliveries</p>
              <p className="text-sm font-medium" style={{ color:'var(--tn-cream)' }}>{format(new Date(), 'EEEE, MMMM d yyyy')}</p>
            </div>
          </div>
          <p className="text-sm font-semibold tabular-nums" style={{ color:'var(--tn-gold)' }}>{format(new Date(), 'hh:mm a')}</p>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label:'Delivered', val:delivered, color:'var(--tn-red)' },
            { label:'Remaining', val:myOrders.filter(o=>o.status!=='delivered').length, color:'var(--tn-gold)' },
            { label:'Km today',  val:`${delivered*6} km`, color:'#185FA5' },
          ].map((s,i) => (
            <div key={i} className="card p-3 text-center">
              <div className="text-xl font-semibold" style={{ color:s.color }}>{s.val}</div>
              <div className="text-xs mt-0.5" style={{ color:'var(--tn-gold)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {[['orders','Orders'],['stats','Stats']].map(([val,label]) => (
            <button key={val} onClick={() => setTab(val)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{ background: tab===val ? 'var(--tn-red)' : 'white', color: tab===val ? 'white' : 'var(--tn-gold)', border:'0.5px solid var(--tn-border)' }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'orders' && (
          <div className="space-y-3">
            {myOrders.map(order => {
              const client = CLIENTS[order.client];
              const rank = STATUS_RANK[order.status] || 0;
              const isActive = activeEnroute === order.id;
              return (
                <div key={order.id} className="card p-4" style={{ borderColor: isActive ? 'var(--tn-red)' : undefined, borderWidth: isActive ? '1px' : undefined }}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{client?.name}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color:'var(--tn-gold)' }}>{order.address}</p>
                      <p className="text-xs mt-0.5" style={{ color:'rgba(139,105,20,0.6)' }}>{order.boxes} box{order.boxes>1?'es':''} · ${order.amount}</p>
                    </div>
                    <span className={`badge ${STATUS_COLOR[order.status]} flex-shrink-0`}>{STATUS_LABEL[order.status]}</span>
                  </div>

                  {/* Timeline */}
                  <div className="flex items-center gap-0 mb-3">
                    {['Assigned','Picked up','En route','Delivered'].map((step, si) => (
                      <div key={step} className="flex items-center flex-1 last:flex-none">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 text-white"
                          style={{ background: si<=rank ? 'var(--tn-red)' : 'var(--tn-warm)' }}>
                          {si<=rank ? '✓' : <span style={{color:'var(--tn-gold)',fontSize:'10px'}}>{si+1}</span>}
                        </div>
                        {si<3 && <div className="flex-1 h-0.5" style={{ background: si<rank ? 'var(--tn-red)' : 'var(--tn-warm)' }} />}
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {order.status==='waiting' && (
                      <button onClick={() => pickUp(order.id)} className="btn btn-sm flex-1 justify-center" style={{background:'var(--tn-gold)',color:'white'}}>
                        📦 Picked up
                      </button>
                    )}
                    {order.status==='picked' && (
                      <button onClick={() => startDelivery(order.id)} disabled={!!activeEnroute && activeEnroute!==order.id}
                        className="btn btn-sm flex-1 justify-center" style={{background:'var(--tn-red)',color:'white',opacity:activeEnroute&&activeEnroute!==order.id?0.4:1}}>
                        🚚 On my way
                      </button>
                    )}
                    {order.status==='enroute' && (
                      <button onClick={() => openProof(order.id)} className="btn btn-success btn-sm flex-1 justify-center">
                        ✓ Mark delivered
                      </button>
                    )}
                    {order.status==='delivered' && (
                      <p className="text-xs font-medium" style={{color:'#0F6E56'}}>✓ Delivered at {order.deliveredAt}</p>
                    )}
                  </div>
                  {order.pickedUpAt && order.status!=='waiting' && (
                    <p className="text-xs mt-2" style={{color:'rgba(139,105,20,0.5)'}}>Picked up at {order.pickedUpAt}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab==='stats' && (
          <div className="card p-4">
            <h2 className="section-title">Today's summary</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                {label:'Orders loaded', val:myOrders.length},
                {label:'Delivered',     val:`${delivered} / ${myOrders.length}`},
                {label:'Total boxes',   val:myOrders.reduce((s,o)=>s+o.boxes,0)},
                {label:'Km driven',     val:`${delivered*6} km`},
              ].map((s,i) => (
                <div key={i} className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                  <p className="text-xs" style={{color:'var(--tn-gold)'}}>{s.label}</p>
                  <p className="font-semibold text-sm mt-0.5">{s.val}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Proof modal */}
      {showProof && (
        <div className="fixed inset-0 flex items-end z-50" style={{background:'rgba(26,18,8,0.6)'}}>
          <div className="w-full rounded-t-2xl p-5 max-w-lg mx-auto" style={{background:'var(--tn-cream)'}}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{background:'var(--tn-border-strong)'}} />
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Confirm delivery</h2>
              <button onClick={() => setShowProof(null)} className="text-xl leading-none" style={{color:'var(--tn-gold)'}}>×</button>
            </div>
            {/* Step indicators */}
            <div className="flex items-center gap-0 mb-5">
              {['Photo','Signature','Confirm'].map((step,i) => (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{background: proofStep>i+1?'#0F6E56':proofStep===i+1?'var(--tn-red)':'var(--tn-warm)', color: proofStep>=i+1?'white':'var(--tn-gold)'}}>
                    {proofStep>i+1?'✓':i+1}
                  </div>
                  {i<2 && <div className="flex-1 h-0.5" style={{background:proofStep>i+1?'#0F6E56':'var(--tn-warm)'}} />}
                </div>
              ))}
            </div>

            {proofStep===1 && (
              <div>
                <p className="font-medium text-sm mb-1">Take delivery photo</p>
                <p className="text-xs mb-3" style={{color:'var(--tn-gold)'}}>Photo of boxes at store entrance</p>
                {!photoTaken ? (
                  <button onClick={() => setPhotoTaken(true)} className="w-full rounded-xl p-8 flex flex-col items-center gap-2" style={{border:'2px dashed var(--tn-border-strong)',background:'var(--tn-warm)'}}>
                    <span className="text-3xl">📷</span>
                    <span className="text-sm" style={{color:'var(--tn-gold)'}}>Tap to take photo</span>
                  </button>
                ) : (
                  <div className="relative w-full h-40 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#1a3a1a,#2d5a2d)'}}>
                    <span className="text-white text-sm opacity-70">📦 Photo captured</span>
                    <button onClick={() => setPhotoTaken(false)} className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs text-white" style={{background:'rgba(0,0,0,0.5)'}}>×</button>
                  </div>
                )}
                <button disabled={!photoTaken} onClick={() => setProofStep(2)}
                  className="btn w-full justify-center mt-4"
                  style={{background:photoTaken?'var(--tn-red)':'var(--tn-warm)',color:photoTaken?'white':'var(--tn-gold)'}}>
                  Next — Signature →
                </button>
              </div>
            )}

            {proofStep===2 && (
              <div>
                <p className="font-medium text-sm mb-1">Recipient signature</p>
                <p className="text-xs mb-3" style={{color:'var(--tn-gold)'}}>Ask store employee to sign below</p>
                <input className="input mb-3" placeholder="Received by (name)" value={recipientName} onChange={e=>setRecipientName(e.target.value)} />
                <div className="rounded-xl h-32 flex items-center justify-center text-sm cursor-pointer" onClick={() => setSigDrawn(true)}
                  style={{border:'0.5px solid var(--tn-border-strong)',background:'white',color:sigDrawn?'var(--tn-dark)':'var(--tn-gold)'}}>
                  {sigDrawn ? 'Signature captured ✓' : 'Sign here with finger'}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setProofStep(1)} className="btn btn-outline">← Back</button>
                  <button disabled={!sigDrawn||!recipientName} onClick={() => setProofStep(3)}
                    className="btn flex-1 justify-center"
                    style={{background:sigDrawn&&recipientName?'var(--tn-red)':'var(--tn-warm)',color:sigDrawn&&recipientName?'white':'var(--tn-gold)'}}>
                    Next — Confirm →
                  </button>
                </div>
              </div>
            )}

            {proofStep===3 && (
              <div>
                <p className="font-medium text-sm mb-3">Review & confirm</p>
                {[
                  {icon:'📷', label:'Delivery photo', sub:'1 photo captured'},
                  {icon:'✍️', label:'Signature', sub:`Signed by: ${recipientName}`},
                  {icon:'🏪', label:CLIENTS[orders.find(o=>o.id===showProof)?.client]?.name||'', sub:`${orders.find(o=>o.id===showProof)?.boxes} boxes`},
                ].map((item,i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl mb-2" style={{background:'var(--tn-warm)'}}>
                    <span className="text-xl">{item.icon}</span>
                    <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.sub}</p></div>
                    {i<2 && <span className="badge badge-success ml-auto">✓</span>}
                  </div>
                ))}
                <p className="text-xs mb-3" style={{color:'var(--tn-gold)'}}>Submitting will notify the client and mark this delivery complete.</p>
                <div className="flex gap-2">
                  <button onClick={() => setProofStep(2)} className="btn btn-outline">← Back</button>
                  <button onClick={submitDelivery} className="btn btn-success flex-1 justify-center">✓ Submit & mark delivered</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
