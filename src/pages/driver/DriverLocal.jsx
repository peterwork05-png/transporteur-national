import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { format } from 'date-fns';
import { useParams } from 'react-router-dom';

const STATUS_RANK  = { waiting:0, picked:1, enroute:2, delivered:3 };
const STATUS_LABEL = { waiting:'Awaiting pickup', picked:'Picked up', enroute:'En route', delivered:'Delivered' };
const STATUS_COLOR = { waiting:'badge-gray', picked:'badge-warning', enroute:'badge-info', delivered:'badge-success' };

export default function DriverLocal() {
  const { driverId } = useParams();
  const driver         = driverId || 'marc';
  const driverName     = driver === 'peter' ? 'Peter' : 'Marc Dumont';
  const driverColor    = driver === 'peter' ? '#7C3AED' : 'var(--tn-red)';
  const driverInitials = driver === 'peter' ? 'PE' : 'MD';

  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [period,       setPeriod]       = useState('today');
  const [activeEnroute,setActiveEnroute]= useState(null);
  const [tab,          setTab]          = useState('orders');
  const [expanded,     setExpanded]     = useState(null);   // expanded order id
  const [showProof,    setShowProof]    = useState(null);
  const [proofStep,    setProofStep]    = useState(1);
  const [recipientName,setRecipientName]= useState('');
  const [sigDrawn,     setSigDrawn]     = useState(false);
  const [photoTaken,   setPhotoTaken]   = useState(false);

  const fetchMyOrders = async () => {
    try {
      const url = period === '7days'
        ? `/api/orders?driver_id=${driver}&days=7`
        : `/api/orders?driver_id=${driver}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.map(o => ({
          id:               o.id,
          clientName:       o.client_name || o.to_business_name || o.billing_name || o.client_id || '—',
          address:          o.address,
          boxes:            o.boxes,
          status:           o.status,
          pickedUpAt:       o.picked_up_at,
          onWayAt:          o.on_way_at,
          deliveredAt:      o.delivered_at,
          // Delivery info
          toAssociateName:  o.to_associate_name  || '',
          toBusinessPhone:  o.to_business_phone  || '',
          requestedTime:    o.requested_delivery_time || '',
          // Pickup info
          pickupLocation:   o.pickup_location    || '',
          fromName:         o.billing_name       || '',
          fromPhone:        o.billing_phone      || '',
          // Order info
          storeNumber:      o.store_number       || '',
          poNumber:         o.po_number          || '',
          typeBoite:        o.type_boite         || '',
          notes:            o.notes              || '',
          dropoffDate:      o.to_dropoff_date    || '',
          fromPickupDate:   o.from_pickup_date   || '',
        })));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchMyOrders();
    const iv = period === 'today' ? setInterval(fetchMyOrders, 30000) : null;
    return () => { if (iv) clearInterval(iv); };
  }, [driver, period]);

  const delivered = orders.filter(o => o.status === 'delivered').length;

  const now = () => new Date().toLocaleTimeString('en-CA',{ hour:'2-digit', minute:'2-digit', hour12:true });

  const updateStatus = async (id, status, extra={}) => {
    setOrders(prev => prev.map(o => o.id===id ? {...o, status, ...extra} : o));
    try {
      await fetch(`/api/orders/${id}/status`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status, ...extra }),
      });
    } catch(e){ console.error(e); }
  };

  const pickUp        = id => updateStatus(id,'picked',  { picked_up_at: now() });
  const startDelivery = id => {
    if (activeEnroute) return alert('Finish current delivery first');
    setActiveEnroute(id);
    updateStatus(id,'enroute',{ on_way_at: now() });
  };
  const openProof = id => { setShowProof(id); setProofStep(1); setPhotoTaken(false); setSigDrawn(false); setRecipientName(''); };
  const submitDelivery = () => {
    updateStatus(showProof,'delivered',{ delivered_at: now(), recipient_name: recipientName });
    setActiveEnroute(null); setShowProof(null);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'var(--tn-dark)'}}>
      <div className="text-center">
        <div className="text-4xl mb-3">🦅</div>
        <p style={{color:'var(--tn-cream)'}}>Loading your orders...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{background:'var(--tn-cream)'}}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3" style={{background:'var(--tn-dark)',borderBottom:'0.5px solid rgba(139,105,20,0.2)'}}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{background:driverColor}}>
              {driverInitials}
            </div>
            <div>
              <p className="text-xs" style={{color:'rgba(250,247,240,0.4)'}}>{driverName} · Local deliveries</p>
              <p className="text-sm font-medium" style={{color:'var(--tn-cream)'}}>{format(new Date(),'EEEE, MMMM d yyyy')}</p>
            </div>
          </div>
          <p className="text-sm font-semibold tabular-nums" style={{color:'var(--tn-gold)'}}>{format(new Date(),'hh:mm a')}</p>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Stats — no price */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label:'Delivered', val:delivered,                                         color:'var(--tn-red)' },
            { label:'Remaining', val:orders.filter(o=>o.status!=='delivered').length,   color:'var(--tn-gold)' },
            { label:'Orders',    val:orders.length,                                     color:'#185FA5' },
          ].map((s,i)=>(
            <div key={i} className="card p-3 text-center">
              <div className="text-xl font-semibold" style={{color:s.color}}>{s.val}</div>
              <div className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Period toggle */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{background:'var(--tn-warm)', width:'fit-content'}}>
          {[['today','Today'],['7days','Last 7 days']].map(([val,label])=>(
            <button key={val} onClick={()=>{ setPeriod(val); setLoading(true); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: period===val ? 'white' : 'transparent',
                color: period===val ? 'var(--tn-dark)' : 'var(--tn-gold)',
                boxShadow: period===val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {[['orders','Orders'],['stats','Stats']].map(([val,label])=>(
            <button key={val} onClick={()=>setTab(val)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium"
              style={{background:tab===val?'var(--tn-red)':'white', color:tab===val?'white':'var(--tn-gold)', border:'0.5px solid var(--tn-border)'}}>
              {label}
            </button>
          ))}
          <button onClick={fetchMyOrders} className="ml-auto btn btn-outline btn-sm text-xs">↻</button>
        </div>

        {tab==='orders' && (
          <div className="space-y-3">
            {orders.length===0 && (
              <div className="card p-8 text-center">
                <p className="text-3xl mb-2">📦</p>
                <p className="font-medium">No orders assigned yet</p>
                <p className="text-sm mt-1" style={{color:'var(--tn-gold)'}}>Admin will assign orders to you</p>
              </div>
            )}

            {orders.map(order => {
              const rank     = STATUS_RANK[order.status] || 0;
              const isActive = activeEnroute === order.id;
              const isExp    = expanded === order.id;

              return (
                <div key={order.id} className="card overflow-hidden"
                  style={{borderColor:isActive?'var(--tn-red)':undefined, borderWidth:isActive?'1px':undefined}}>

                  {/* Top row — click to expand/collapse */}
                  <div className="p-4 cursor-pointer" onClick={()=>setExpanded(isExp?null:order.id)}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{order.clientName}</p>
                        <p className="text-xs mt-0.5 truncate" style={{color:'var(--tn-gold)'}}>{order.address}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-xs" style={{color:'rgba(139,105,20,0.6)'}}>{order.boxes} box{order.boxes>1?'es':''}</p>
                          {order.storeNumber && <p className="text-xs" style={{color:'rgba(139,105,20,0.6)'}}>· {order.storeNumber.startsWith('Store') ? order.storeNumber : `Store ${order.storeNumber}`}</p>}
                          {order.requestedTime && <p className="text-xs font-medium" style={{color:'var(--tn-red)'}}>· 🕐 {order.requestedTime}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`badge ${STATUS_COLOR[order.status]}`}>{STATUS_LABEL[order.status]}</span>
                        <span className="text-xs" style={{color:'var(--tn-gold)'}}>{isExp?'▲':'▼'}</span>
                      </div>
                    </div>

                    {/* Timeline dots */}
                    <div className="flex items-center gap-0 mt-3">
                      {['Assigned','Picked up','En route','Delivered'].map((step,si)=>(
                        <div key={step} className="flex items-center flex-1 last:flex-none">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 text-white"
                            style={{background:si<=rank?'var(--tn-red)':'var(--tn-warm)'}}>
                            {si<=rank?'✓':<span style={{color:'var(--tn-gold)',fontSize:'10px'}}>{si+1}</span>}
                          </div>
                          {si<3&&<div className="flex-1 h-0.5" style={{background:si<rank?'var(--tn-red)':'var(--tn-warm)'}}/>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expanded detail section */}
                  {isExp && (
                    <div className="px-4 pb-4 space-y-2 border-t" style={{borderColor:'var(--tn-border)'}}>

                      {/* Delivery address */}
                      <div className="rounded-xl p-3 mt-3" style={{background:'var(--tn-warm)'}}>
                        <p className="text-xs mb-0.5" style={{color:'var(--tn-gold)'}}>📍 Delivery address</p>
                        <p className="font-medium text-sm">{order.address}</p>
                      </div>

                      {/* Recipient */}
                      {(order.toAssociateName||order.toBusinessPhone) && (
                        <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                          <p className="text-xs mb-1" style={{color:'var(--tn-gold)'}}>👤 Recipient</p>
                          <div className="flex items-center justify-between">
                            {order.toAssociateName && <p className="font-medium text-sm">{order.toAssociateName}</p>}
                            {order.toBusinessPhone && (
                              <a href={`tel:${order.toBusinessPhone}`} className="btn btn-sm" style={{background:'var(--tn-red)',color:'white'}}>
                                📞 Call
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Pickup */}
                      {order.pickupLocation && (
                        <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                          <p className="text-xs mb-0.5" style={{color:'var(--tn-gold)'}}>🏭 Pickup location</p>
                          <p className="font-medium text-sm">{order.pickupLocation}</p>
                          {order.fromName && <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>Contact: {order.fromName}{order.fromPhone?` · ${order.fromPhone}`:''}</p>}
                        </div>
                      )}

                      {/* Order details grid */}
                      <div className="grid grid-cols-2 gap-2">
                        {order.poNumber && (
                          <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                            <p className="text-xs" style={{color:'var(--tn-gold)'}}>PO Number</p>
                            <p className="font-semibold text-sm font-mono">{order.poNumber}</p>
                          </div>
                        )}
                        {order.boxes && (
                          <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                            <p className="text-xs" style={{color:'var(--tn-gold)'}}>Boxes</p>
                            <p className="font-semibold text-sm">{order.boxes} box{order.boxes>1?'es':''}</p>
                          </div>
                        )}
                        {order.typeBoite && (
                          <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                            <p className="text-xs" style={{color:'var(--tn-gold)'}}>Box type</p>
                            <p className="font-semibold text-sm">{order.typeBoite}</p>
                          </div>
                        )}
                        {order.requestedTime && (
                          <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                            <p className="text-xs" style={{color:'var(--tn-gold)'}}>Deliver by</p>
                            <p className="font-semibold text-sm">🕐 {order.requestedTime}</p>
                          </div>
                        )}
                      </div>

                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-2">
                        {order.fromPickupDate && (
                          <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                            <p className="text-xs" style={{color:'var(--tn-gold)'}}>📅 Pickup date</p>
                            <p className="font-semibold text-sm">{order.fromPickupDate}</p>
                          </div>
                        )}
                        {order.dropoffDate && (
                          <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                            <p className="text-xs" style={{color:'var(--tn-gold)'}}>📅 Dropoff date</p>
                            <p className="font-semibold text-sm">{order.dropoffDate}</p>
                          </div>
                        )}
                      </div>
                      {order.notes && (
                        <div className="rounded-xl p-3" style={{background:'#FEF3C7',border:'0.5px solid #D97706'}}>
                          <p className="text-xs mb-1" style={{color:'#92400E'}}>📝 Notes</p>
                          <p className="text-sm" style={{color:'#92400E'}}>
                            {order.notes.startsWith('Notes:')
                              ? order.notes.split('|')[0].replace('Notes:', '').trim()
                              : order.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="px-4 pb-4">
                    {order.status==='waiting' && (
                      <button onClick={()=>pickUp(order.id)} className="btn btn-sm w-full justify-center" style={{background:'var(--tn-gold)',color:'white'}}>
                        📦 Mark as picked up
                      </button>
                    )}
                    {order.status==='picked' && (
                      <button onClick={()=>startDelivery(order.id)}
                        disabled={!!activeEnroute&&activeEnroute!==order.id}
                        className="btn btn-sm w-full justify-center"
                        style={{background:'var(--tn-red)',color:'white',opacity:activeEnroute&&activeEnroute!==order.id?0.4:1}}>
                        🚚 On my way
                      </button>
                    )}
                    {order.status==='enroute' && (
                      <button onClick={()=>openProof(order.id)} className="btn btn-success btn-sm w-full justify-center">
                        ✓ Mark delivered
                      </button>
                    )}
                    {order.status==='delivered' && (
                      <p className="text-xs font-medium text-center" style={{color:'#0F6E56'}}>✓ Delivered at {order.deliveredAt}</p>
                    )}
                    {order.pickedUpAt&&order.status!=='waiting'&&(
                      <p className="text-xs mt-1 text-center" style={{color:'rgba(139,105,20,0.5)'}}>Picked up at {order.pickedUpAt}</p>
                    )}
                  </div>
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
                {label:'Orders assigned', val:orders.length},
                {label:'Delivered',       val:`${delivered} / ${orders.length}`},
                {label:'Total boxes',     val:orders.reduce((s,o)=>s+o.boxes,0)},
                {label:'Remaining',       val:orders.filter(o=>o.status!=='delivered').length},
              ].map((s,i)=>(
                <div key={i} className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                  <p className="text-xs" style={{color:'var(--tn-gold)'}}>{s.label}</p>
                  <p className="font-semibold text-sm mt-0.5">{s.val}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Proof of delivery modal */}
      {showProof && (
        <div className="fixed inset-0 flex items-end z-50" style={{background:'rgba(26,18,8,0.6)'}}>
          <div className="w-full rounded-t-2xl p-5 max-w-lg mx-auto" style={{background:'var(--tn-cream)'}}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{background:'var(--tn-border-strong)'}}/>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Confirm delivery</h2>
              <button onClick={()=>setShowProof(null)} className="text-xl leading-none" style={{color:'var(--tn-gold)'}}>×</button>
            </div>
            <div className="flex items-center gap-0 mb-5">
              {['Photo','Signature','Confirm'].map((step,i)=>(
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{background:proofStep>i+1?'#0F6E56':proofStep===i+1?'var(--tn-red)':'var(--tn-warm)', color:proofStep>=i+1?'white':'var(--tn-gold)'}}>
                    {proofStep>i+1?'✓':i+1}
                  </div>
                  {i<2&&<div className="flex-1 h-0.5" style={{background:proofStep>i+1?'#0F6E56':'var(--tn-warm)'}}/>}
                </div>
              ))}
            </div>

            {proofStep===1&&(
              <div>
                <p className="font-medium text-sm mb-1">Take delivery photo</p>
                <p className="text-xs mb-3" style={{color:'var(--tn-gold)'}}>Photo of boxes at store entrance</p>
                {!photoTaken?(
                  <button onClick={()=>setPhotoTaken(true)} className="w-full rounded-xl p-8 flex flex-col items-center gap-2"
                    style={{border:'2px dashed var(--tn-border-strong)',background:'var(--tn-warm)'}}>
                    <span className="text-3xl">📷</span>
                    <span className="text-sm" style={{color:'var(--tn-gold)'}}>Tap to take photo</span>
                  </button>
                ):(
                  <div className="relative">
                    <div className="w-full h-40 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#1a3a1a,#2d5a2d)'}}>
                      <span className="text-white text-sm opacity-70">📦 Photo captured</span>
                    </div>
                    <button onClick={()=>setPhotoTaken(false)} className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs text-white" style={{background:'rgba(0,0,0,0.5)'}}>×</button>
                  </div>
                )}
                <button disabled={!photoTaken} onClick={()=>setProofStep(2)} className="btn w-full justify-center mt-4"
                  style={{background:photoTaken?'var(--tn-red)':'var(--tn-warm)',color:photoTaken?'white':'var(--tn-gold)'}}>
                  Next — Signature →
                </button>
              </div>
            )}

            {proofStep===2&&(
              <div>
                <p className="font-medium text-sm mb-1">Recipient signature</p>
                <p className="text-xs mb-3" style={{color:'var(--tn-gold)'}}>Ask store employee to sign below</p>
                <input className="input mb-3" placeholder="Received by (name)" value={recipientName} onChange={e=>setRecipientName(e.target.value)}/>
                <div className="rounded-xl h-32 flex items-center justify-center text-sm cursor-pointer" onClick={()=>setSigDrawn(true)}
                  style={{border:'0.5px solid var(--tn-border-strong)',background:'white',color:sigDrawn?'var(--tn-dark)':'var(--tn-gold)'}}>
                  {sigDrawn?'Signature captured ✓':'Sign here with finger'}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={()=>setProofStep(1)} className="btn btn-outline">← Back</button>
                  <button disabled={!sigDrawn||!recipientName} onClick={()=>setProofStep(3)} className="btn flex-1 justify-center"
                    style={{background:sigDrawn&&recipientName?'var(--tn-red)':'var(--tn-warm)',color:sigDrawn&&recipientName?'white':'var(--tn-gold)'}}>
                    Next — Confirm →
                  </button>
                </div>
              </div>
            )}

            {proofStep===3&&(
              <div>
                <p className="font-medium text-sm mb-3">Review & confirm</p>
                {[
                  {icon:'📷',label:'Delivery photo',sub:'1 photo captured'},
                  {icon:'✍️',label:'Signature',sub:`Signed by: ${recipientName}`},
                  {icon:'🏪',label:orders.find(o=>o.id===showProof)?.clientName||'',sub:`${orders.find(o=>o.id===showProof)?.boxes} boxes`},
                ].map((item,i)=>(
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl mb-2" style={{background:'var(--tn-warm)'}}>
                    <span className="text-xl">{item.icon}</span>
                    <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.sub}</p></div>
                    {i<2&&<span className="badge badge-success ml-auto">✓</span>}
                  </div>
                ))}
                <p className="text-xs mb-3" style={{color:'var(--tn-gold)'}}>Submitting will mark this delivery complete.</p>
                <div className="flex gap-2">
                  <button onClick={()=>setProofStep(2)} className="btn btn-outline">← Back</button>
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
