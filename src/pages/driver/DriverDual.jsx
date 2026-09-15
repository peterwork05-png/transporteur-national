import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useApp } from '../../context/AppContext';
import { format } from 'date-fns';
import { useParams } from 'react-router-dom';

const STATUS_RANK  = { waiting:0, accepted:1, picked:2, enroute:3, delivered:4, attempted:3 };
const STATUS_LABEL = { waiting:'Awaiting pickup', accepted:'Accepted', picked:'Picked up', enroute:'En route', delivered:'Delivered', attempted:'Attempted delivery' };
const STATUS_COLOR = { waiting:'badge-gray', accepted:'badge-info', picked:'badge-warning', enroute:'badge-info', delivered:'badge-success', attempted:'badge-danger' };

// ─── LOCAL ORDERS TAB ────────────────────────────────────────────────────────

function LocalTab({ driverId, driverColor, driverInitials }) {
  const [orders,        setOrders]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [period,        setPeriod]        = useState('today');
  const [filter,        setFilter]        = useState('all');
  const [activeEnroute, setActiveEnroute] = useState(null);
  const [expanded,      setExpanded]      = useState(null);
  const [showAttempted, setShowAttempted] = useState(null);
  const [attemptedNote, setAttemptedNote] = useState('');
  const [showProof,     setShowProof]     = useState(null);
  const [proofStep,     setProofStep]     = useState(1);
  const [recipientName, setRecipientName] = useState('');
  const [sigDrawn,      setSigDrawn]      = useState(false);
  const [photoTaken,    setPhotoTaken]    = useState(false);
  const [photoDataUrl,  setPhotoDataUrl]  = useState(null);
  const [photoFile,     setPhotoFile]     = useState(null);
  const [sigDataUrl,    setSigDataUrl]    = useState(null);
  const sigCanvasRef = useRef(null);
  const locationInterval = useRef(null);

  const fetchOrders = useCallback(async () => {
    try {
      const url = period === '7days'
        ? `/api/orders?driver_id=${driverId}&days=7`
        : `/api/orders?driver_id=${driverId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.map(o => ({
          ...o,
          clientName:      o.client_name || o.to_business_name || o.billing_name || o.client_id || '—',
          toAssociateName: o.to_associate_name || '',
          toBusinessName:  o.to_business_name || '',
          toBusinessPhone: o.to_business_phone || '',
          requestedTime:   o.requested_delivery_time || '',
          pickupLocation:  o.pickup_location || '',
          fromName:        o.billing_name || '',
          fromPhone:       o.billing_phone || '',
          storeNumber:     o.store_number || '',
          poNumber:        o.po_number || '',
          typeBoite:       o.type_boite || '',
          notes:           o.notes || '',
        })));
      }
    } catch(err) { console.error(err); }
    finally { setLoading(false); }
  }, [driverId, period]);

  useEffect(() => {
    fetchOrders();
    const iv = period === 'today' ? setInterval(fetchOrders, 30000) : null;
    return () => { if(iv) clearInterval(iv); };
  }, [fetchOrders, period]);

  const startLocationSharing = useCallback(() => {
    if (!navigator.geolocation) return;
    const send = () => {
      navigator.geolocation.getCurrentPosition(pos => {
        fetch(`/api/drivers/${driverId}/location`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        }).catch(() => {});
      }, () => {}, { enableHighAccuracy: true });
    };
    send();
    locationInterval.current = setInterval(send, 30000);
  }, [driverId]);

  const stopLocationSharing = useCallback(() => {
    if (locationInterval.current) { clearInterval(locationInterval.current); locationInterval.current = null; }
  }, []);

  useEffect(() => () => stopLocationSharing(), []);

  const delivered = orders.filter(o => o.status === 'delivered').length;
  const remaining = orders.filter(o => !['delivered','attempted'].includes(o.status)).length;
  const filteredOrders = orders.filter(o => {
    if (filter === 'delivered') return o.status === 'delivered';
    if (filter === 'remaining') return !['delivered','attempted'].includes(o.status);
    return true;
  });

  const now = () => new Date().toLocaleTimeString('en-CA', { hour:'2-digit', minute:'2-digit', hour12:true });

  const updateStatus = async (id, status, extra = {}) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status, ...extra } : o));
    try {
      await fetch(`/api/orders/${id}/status`, {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ status, ...extra }),
      });
    } catch(e) { console.error(e); }
  };

  const acceptOrder    = id => updateStatus(id, 'accepted');
  const pickUp         = id => updateStatus(id, 'picked', { picked_up_at: now() });
  const startDelivery  = id => { if(activeEnroute) return alert('Finish current delivery first'); setActiveEnroute(id); updateStatus(id, 'enroute', { on_way_at: now() }); startLocationSharing(); };
  const cancelEnroute  = id => { setActiveEnroute(null); updateStatus(id, 'picked'); stopLocationSharing(); };
  const openAttempted  = id => { setShowAttempted(id); setAttemptedNote(''); };

  const submitAttempted = async () => {
    await updateStatus(showAttempted, 'attempted', { delivered_at: now(), notes: attemptedNote ? `[Attempted] ${attemptedNote}` : '[Attempted delivery]' });
    setActiveEnroute(null); setShowAttempted(null); setAttemptedNote(''); stopLocationSharing();
  };

  const openProof = id => { setShowProof(id); setProofStep(1); setPhotoTaken(false); setPhotoDataUrl(null); setPhotoFile(null); setSigDrawn(false); setSigDataUrl(null); setRecipientName(''); };

  const submitDelivery = async () => {
    let photo_url = null, signature_url = null;
    if (photoFile) {
      try {
        const reader = new FileReader();
        const b64 = await new Promise(res => { reader.onload = e => res(e.target.result.split(',')[1]); reader.readAsDataURL(photoFile); });
        const r = await fetch('/api/upload/delivery-photo', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ imageBase64: b64, orderId: showProof }) });
        const d = await r.json(); if(d.url) photo_url = d.url;
      } catch(e) {}
    }
    if (sigDataUrl) {
      try {
        const r = await fetch('/api/upload/delivery-photo', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ imageBase64: sigDataUrl.split(',')[1], orderId: `${showProof}_sig` }) });
        const d = await r.json(); if(d.url) signature_url = d.url;
      } catch(e) {}
    }
    updateStatus(showProof, 'delivered', { delivered_at: now(), recipient_name: recipientName, photo_url, signature_url });
    setActiveEnroute(null); setShowProof(null); stopLocationSharing();
  };

  const openGoogleMaps = (order) => {
    const pickup  = order.pickupLocation || order.fromName;
    const dropoff = order.address;
    if (pickup && dropoff) window.open(`https://www.google.com/maps/dir/${encodeURIComponent(pickup)}/${encodeURIComponent(dropoff)}`, '_blank');
    else if (dropoff) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dropoff)}`, '_blank');
  };

  if (loading) return <div className="flex items-center justify-center py-20"><p style={{color:'var(--tn-gold)'}}>Loading orders...</p></div>;

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[{label:'Delivered',val:delivered,color:'var(--tn-red)',key:'delivered'},{label:'Remaining',val:remaining,color:'var(--tn-gold)',key:'remaining'},{label:'All',val:orders.length,color:'#185FA5',key:'all'}].map((s,i)=>(
          <button key={i} onClick={()=>setFilter(s.key)} className="card p-3 text-center"
            style={{borderColor:filter===s.key?s.color:'var(--tn-border)',borderWidth:filter===s.key?'2px':'0.5px'}}>
            <div className="text-xl font-semibold" style={{color:s.color}}>{s.val}</div>
            <div className="text-xs mt-0.5" style={{color:s.color}}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* Period */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{background:'var(--tn-warm)',width:'fit-content'}}>
        {[['today','Today'],['7days','Last 7 days']].map(([val,label])=>(
          <button key={val} onClick={()=>{setPeriod(val);setLoading(true);}} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{background:period===val?'white':'transparent',color:period===val?'var(--tn-dark)':'var(--tn-gold)'}}>
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredOrders.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-3xl mb-2">📦</p>
            <p className="font-medium">{filter==='delivered'?'No deliveries yet':filter==='remaining'?'All done! 🎉':'No orders assigned yet'}</p>
          </div>
        )}

        {filteredOrders.map(order => {
          const rank  = STATUS_RANK[order.status] || 0;
          const isExp = expanded === order.id;
          return (
            <div key={order.id} className="card overflow-hidden">
              <div className="p-4 cursor-pointer" onClick={()=>setExpanded(isExp?null:order.id)}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{order.toBusinessName || order.clientName}</p>
                    {order.toBusinessName && order.toAssociateName && <p className="text-xs" style={{color:'var(--tn-gold)'}}>{order.toAssociateName}</p>}
                    <p className="text-xs mt-0.5 truncate" style={{color:'var(--tn-gold)'}}>{order.address}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs" style={{color:'rgba(139,105,20,0.6)'}}>{order.boxes} box{order.boxes>1?'es':''}</p>
                      {order.storeNumber && <p className="text-xs" style={{color:'rgba(139,105,20,0.6)'}}>· {order.storeNumber}</p>}
                      {order.requestedTime && <p className="text-xs font-medium" style={{color:'var(--tn-red)'}}>· 🕐 {order.requestedTime}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`badge ${STATUS_COLOR[order.status]}`}>{STATUS_LABEL[order.status]}</span>
                    <span className="text-xs" style={{color:'var(--tn-gold)'}}>{isExp?'▲':'▼'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-0 mt-3">
                  {['Assigned','Accepted','Picked','En route','Delivered'].map((step,si)=>(
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 text-white" style={{background:si<=rank?'var(--tn-red)':'var(--tn-warm)'}}>
                        {si<=rank?'✓':<span style={{color:'var(--tn-gold)',fontSize:'10px'}}>{si+1}</span>}
                      </div>
                      {si<4&&<div className="flex-1 h-0.5" style={{background:si<rank?'var(--tn-red)':'var(--tn-warm)'}}/>}
                    </div>
                  ))}
                </div>
              </div>

              {isExp && (
                <div className="px-4 pb-4 space-y-2 border-t" style={{borderColor:'var(--tn-border)'}}>
                  <div className="rounded-xl p-3 mt-3" style={{background:'var(--tn-warm)'}}>
                    <p className="text-xs mb-0.5" style={{color:'var(--tn-gold)'}}>📍 Delivery address</p>
                    <p className="font-medium text-sm">{order.address}</p>
                    <button onClick={()=>openGoogleMaps(order)} className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium" style={{background:'#185FA5',color:'white'}}>
                      🗺️ Start on Google Maps
                    </button>
                  </div>
                  {(order.toAssociateName||order.toBusinessPhone) && (
                    <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                      <p className="text-xs mb-1" style={{color:'var(--tn-gold)'}}>👤 Recipient</p>
                      <div className="flex items-center justify-between">
                        {order.toAssociateName&&<p className="font-medium text-sm">{order.toAssociateName}</p>}
                        {order.toBusinessPhone&&<a href={`tel:${order.toBusinessPhone}`} className="btn btn-sm" style={{background:'var(--tn-red)',color:'white'}}>📞 Call</a>}
                      </div>
                    </div>
                  )}
                  {order.pickupLocation && (
                    <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                      <p className="text-xs mb-0.5" style={{color:'var(--tn-gold)'}}>🏭 Pickup location</p>
                      <p className="font-medium text-sm">{order.pickupLocation}</p>
                    </div>
                  )}
                  {order.notes && (
                    <div className="rounded-xl p-3" style={{background:'#FEF3C7',border:'0.5px solid #D97706'}}>
                      <p className="text-xs mb-1" style={{color:'#92400E'}}>📝 Notes</p>
                      <p className="text-sm" style={{color:'#92400E'}}>{order.notes.startsWith('Notes:')?order.notes.split('|')[0].replace('Notes:','').trim():order.notes}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="px-4 pb-4 space-y-2">
                {order.status==='waiting'&&<button onClick={()=>acceptOrder(order.id)} className="btn btn-sm w-full justify-center" style={{background:'#185FA5',color:'white'}}>✅ Accept order</button>}
                {order.status==='accepted'&&(
                  <div className="flex gap-2">
                    <button onClick={()=>pickUp(order.id)} className="btn btn-sm flex-1 justify-center" style={{background:'var(--tn-gold)',color:'white'}}>📦 Mark as picked up</button>
                    <button onClick={()=>updateStatus(order.id,'waiting')} className="btn btn-sm flex-shrink-0 px-3" style={{background:'rgba(139,105,20,0.15)',color:'var(--tn-gold)',border:'0.5px solid var(--tn-gold)'}}>↩ Back</button>
                  </div>
                )}
                {order.status==='picked'&&(
                  <div className="flex gap-2">
                    <button onClick={()=>startDelivery(order.id)} className="btn btn-sm flex-1 justify-center" style={{background:'var(--tn-red)',color:'white'}}>🚚 On my way</button>
                    <button onClick={()=>updateStatus(order.id,'accepted')} className="btn btn-sm flex-shrink-0 px-3" style={{background:'rgba(139,105,20,0.15)',color:'var(--tn-gold)',border:'0.5px solid var(--tn-gold)'}}>↩ Back</button>
                  </div>
                )}
                {order.status==='enroute'&&(
                  <div className="flex gap-2">
                    <button onClick={()=>openProof(order.id)} className="btn btn-success btn-sm flex-1 justify-center">✓ Mark delivered</button>
                    <button onClick={()=>openAttempted(order.id)} className="btn btn-sm flex-shrink-0 px-3" style={{background:'#FEF3C7',color:'#92400E',border:'0.5px solid #D97706'}}>⚠️</button>
                    <button onClick={()=>cancelEnroute(order.id)} className="btn btn-sm flex-shrink-0 px-3" style={{background:'rgba(139,105,20,0.15)',color:'var(--tn-gold)',border:'0.5px solid var(--tn-gold)'}}>↩</button>
                  </div>
                )}
                {order.status==='delivered'&&<p className="text-xs font-medium text-center" style={{color:'#0F6E56'}}>✓ Delivered at {order.delivered_at}</p>}
                {order.status==='attempted'&&<p className="text-xs font-medium text-center" style={{color:'#92400E'}}>⚠️ Attempted delivery</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Attempted modal */}
      {showAttempted&&(
        <div className="fixed inset-0 flex items-end z-50" style={{background:'rgba(26,18,8,0.6)'}}>
          <div className="w-full rounded-t-2xl p-5 max-w-lg mx-auto" style={{background:'var(--tn-cream)'}}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{background:'var(--tn-border-strong)'}}/>
            <h2 className="font-semibold mb-3">⚠️ Attempted delivery</h2>
            <textarea className="input mb-3" rows={3} style={{resize:'none'}} placeholder="Reason (optional)..." value={attemptedNote} onChange={e=>setAttemptedNote(e.target.value)}/>
            <div className="flex gap-2">
              <button onClick={()=>setShowAttempted(null)} className="btn btn-outline flex-1 justify-center">Cancel</button>
              <button onClick={submitAttempted} className="btn flex-1 justify-center" style={{background:'#D97706',color:'white'}}>⚠️ Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Proof modal */}
      {showProof&&(
        <div className="fixed inset-0 flex items-end z-50" style={{background:'rgba(26,18,8,0.6)'}}>
          <div className="w-full rounded-t-2xl p-5 max-w-lg mx-auto max-h-[92vh] overflow-y-auto" style={{background:'var(--tn-cream)'}}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{background:'var(--tn-border-strong)'}}/>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Confirm delivery</h2>
              <button onClick={()=>setShowProof(null)} className="text-xl" style={{color:'var(--tn-gold)'}}>×</button>
            </div>
            <div className="flex items-center gap-0 mb-5">
              {['Photo','Signature','Confirm'].map((step,i)=>(
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{background:proofStep>i+1?'#0F6E56':proofStep===i+1?'var(--tn-red)':'var(--tn-warm)',color:proofStep>=i+1?'white':'var(--tn-gold)'}}>
                    {proofStep>i+1?'✓':i+1}
                  </div>
                  {i<2&&<div className="flex-1 h-0.5" style={{background:proofStep>i+1?'#0F6E56':'var(--tn-warm)'}}/>}
                </div>
              ))}
            </div>
            {proofStep===1&&(
              <div>
                <p className="font-medium text-sm mb-3">Take a photo of the delivery</p>
                {!photoTaken?(
                  <label htmlFor="cam" className="w-full rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer" style={{border:'2px dashed var(--tn-border-strong)',background:'var(--tn-warm)'}}>
                    <span className="text-4xl">📷</span><span className="text-sm font-medium" style={{color:'var(--tn-gold)'}}>Tap to open camera</span>
                  </label>
                ):(
                  <div className="space-y-2">
                    <img src={photoDataUrl} alt="Delivery" className="w-full rounded-xl object-cover" style={{maxHeight:'220px'}}/>
                    <button onClick={()=>{setPhotoTaken(false);setPhotoDataUrl(null);setPhotoFile(null);}} className="btn btn-outline btn-sm w-full justify-center text-xs">📷 Retake</button>
                  </div>
                )}
                <input id="cam" type="file" accept="image/*" className="hidden" onChange={async(e)=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=(ev)=>{setPhotoTaken(true);setPhotoDataUrl(ev.target.result);};reader.readAsDataURL(file);setPhotoFile(file);}}/>
                <button disabled={!photoTaken} onClick={()=>setProofStep(2)} className="btn w-full justify-center mt-4" style={{background:photoTaken?'var(--tn-red)':'var(--tn-warm)',color:photoTaken?'white':'var(--tn-gold)'}}>Next →</button>
              </div>
            )}
            {proofStep===2&&(
              <div>
                <p className="font-medium text-sm mb-3">Recipient signature</p>
                <input className="input mb-3" placeholder="Received by (full name)" value={recipientName} onChange={e=>setRecipientName(e.target.value)}/>
                <canvas ref={sigCanvasRef} width={340} height={140} className="w-full rounded-xl"
                  style={{border:'0.5px solid var(--tn-border-strong)',background:'white',touchAction:'none',cursor:'crosshair'}}
                  onPointerDown={(e)=>{const c=sigCanvasRef.current;const ctx=c.getContext('2d');const r=c.getBoundingClientRect();const sx=c.width/r.width;const sy=c.height/r.height;ctx.beginPath();ctx.moveTo((e.clientX-r.left)*sx,(e.clientY-r.top)*sy);ctx.lineWidth=2.5;ctx.strokeStyle='#1A1208';ctx.lineCap='round';c.isDrawing=true;setSigDrawn(true);}}
                  onPointerMove={(e)=>{const c=sigCanvasRef.current;if(!c.isDrawing)return;const ctx=c.getContext('2d');const r=c.getBoundingClientRect();const sx=c.width/r.width;const sy=c.height/r.height;ctx.lineTo((e.clientX-r.left)*sx,(e.clientY-r.top)*sy);ctx.stroke();}}
                  onPointerUp={()=>{if(sigCanvasRef.current)sigCanvasRef.current.isDrawing=false;}}
                  onPointerLeave={()=>{if(sigCanvasRef.current)sigCanvasRef.current.isDrawing=false;}}
                />
                {sigDrawn&&<button onClick={()=>{const c=sigCanvasRef.current;c.getContext('2d').clearRect(0,0,c.width,c.height);setSigDrawn(false);}} className="btn btn-outline btn-sm mt-2 text-xs">✕ Clear</button>}
                <div className="flex gap-2 mt-4">
                  <button onClick={()=>setProofStep(1)} className="btn btn-outline">← Back</button>
                  <button disabled={!sigDrawn||!recipientName} onClick={()=>{if(sigCanvasRef.current){const c=sigCanvasRef.current;const exp=document.createElement('canvas');exp.width=c.width;exp.height=c.height;const ctx=exp.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,exp.width,exp.height);ctx.drawImage(c,0,0);setSigDataUrl(exp.toDataURL('image/png'));}setProofStep(3);}} className="btn flex-1 justify-center"
                    style={{background:sigDrawn&&recipientName?'var(--tn-red)':'var(--tn-warm)',color:sigDrawn&&recipientName?'white':'var(--tn-gold)'}}>
                    Next →
                  </button>
                </div>
              </div>
            )}
            {proofStep===3&&(
              <div>
                <p className="font-medium text-sm mb-3">Review & confirm</p>
                {photoDataUrl&&<img src={photoDataUrl} alt="Delivery" className="w-full rounded-xl object-cover mb-3" style={{maxHeight:'150px'}}/>}
                {[{icon:'📷',label:'Delivery photo',sub:'Photo captured ✓'},{icon:'✍️',label:'Signature',sub:`Signed by: ${recipientName}`}].map((item,i)=>(
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl mb-2" style={{background:'var(--tn-warm)'}}>
                    <span className="text-xl">{item.icon}</span>
                    <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.sub}</p></div>
                    <span className="badge badge-success ml-auto">✓</span>
                  </div>
                ))}
                <div className="flex gap-2 mt-3">
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

// ─── ROUTE TAB ───────────────────────────────────────────────────────────────

const ONTARIO_STOPS = [
  'Staples Kanata (6-2600 Iris St, Kanata)',
  'Staples Nepean (2-1536 Merivale Rd, Nepean)',
  'Staples Barrhaven (101-3651 Strandherd Dr, Nepean)',
  'Staples Orleans (1-2323 St Joseph Blvd, Orleans)',
  'Staples Gloucester (1500 Blair Rd, Gloucester)',
  'Staples Bank St (2210 Bank St, Ottawa)',
  'Staples Rideau (1035 Cyrville Rd, Ottawa)',
  'Staples Gatineau Hull (wrhs) (10 rue Eddy, Gatineau)',
  'Staples Aylmer (181 ch Doherty, Gatineau)',
  'Staples Gatineau (696 boul Maloney E, Gatineau)',
  'Staples Buckingham (355 rue Joseph, Gatineau)',
  'Staples Masson-Angers (880 boul St-René E, Gatineau)',
  'Staples Ottawa (wrhs) (2350 Stevenage Dr, Ottawa)',
  'Staples Beacon Hill (Place Beacon Hill, Ottawa)',
  'Staples Hazeldean (300 Eagleson Rd, Kanata)',
];

const QUEBEC_STOPS = [
  'Staples Laval (4141 autoroute 440 Ouest, Laval)',
  'Staples Terrebonne (1185 montée Masson, Terrebonne)',
  'Staples Repentigny (934 boul Iberville, Repentigny)',
  'Staples Boisbriand (3530 boul de la Grande-Allée, Boisbriand)',
  'Staples Saint-Jérôme (700 boul du Séminaire N, Saint-Jérôme)',
  'Staples Sainte-Thérèse (450 boul Curé-Labelle, Sainte-Thérèse)',
  'Staples Bois-des-Filion (990 montée Monette, Bois-des-Filion)',
  'Staples Mascouche (170 montée Masson, Mascouche)',
  'Staples Joliette (795 boul Firestone, Joliette)',
  'Staples Lachenaie (1100 montée Masson, Terrebonne)',
];

function RouteTab({ driverId, route }) {
  const [progress, setProgress] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  const routeKey = driverId === 'pierre' ? 'quebec' : 'ontario';
  const stops    = routeKey === 'ontario' ? ONTARIO_STOPS : QUEBEC_STOPS;

  const fetchProgress = async () => {
    try {
      const res  = await fetch('/api/routes/progress');
      const data = await res.json();
      setProgress(data[routeKey] || {
        started: false, startTime: null, holiday: false, done: false,
        stopStatus: new Array(stops.length).fill(null),
        arrivals:   new Array(stops.length).fill(null),
      });
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchProgress(); }, []);

  const saveProgress = async (updated) => {
    setSaving(true);
    try {
      await fetch(`/api/routes/${routeKey}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch(e) { console.error(e); }
    setSaving(false);
  };

  const toggleStop = async (i) => {
    if (!progress) return;
    const newStatus = [...(progress.stopStatus || [])];
    const now = new Date().toLocaleTimeString('en-CA', { hour:'2-digit', minute:'2-digit', hour12:true });
    const newArrivals = [...(progress.arrivals || [])];
    if (newStatus[i] === 'done') {
      newStatus[i] = null;
      newArrivals[i] = null;
    } else {
      newStatus[i] = 'done';
      newArrivals[i] = now;
    }
    const updated = { ...progress, stopStatus: newStatus, arrivals: newArrivals };
    setProgress(updated);
    await saveProgress(updated);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><p style={{color:'var(--tn-gold)'}}>Loading route...</p></div>;

  const completed = (progress?.stopStatus || []).filter(s => s === 'done').length;

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Progress bar */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium text-sm">Route {route}</p>
          <p className="text-sm font-semibold" style={{color:'var(--tn-red)'}}>{completed}/{stops.length} stops</p>
        </div>
        <div className="w-full rounded-full h-2" style={{background:'var(--tn-warm)'}}>
          <div className="h-2 rounded-full transition-all" style={{width:`${(completed/stops.length)*100}%`,background:'var(--tn-red)'}}/>
        </div>
      </div>

      {/* Stops */}
      <div className="space-y-2">
        {stops.map((stop, i) => {
          const isDone    = progress?.stopStatus?.[i] === 'done';
          const arrivalTime = progress?.arrivals?.[i];
          return (
            <div key={i} className="card p-3" style={{opacity: isDone ? 0.6 : 1}}>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{background: isDone ? '#0F6E56' : 'var(--tn-red)', color:'white'}}>
                  {isDone ? '✓' : i+1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{stop.split('(')[0].trim()}</p>
                  <p className="text-xs truncate" style={{color:'var(--tn-gold)'}}>{stop.match(/\(([^)]+)\)/)?.[1] || ''}</p>
                  {isDone && arrivalTime && <p className="text-xs" style={{color:'#0F6E56'}}>✓ Done at {arrivalTime}</p>}
                </div>
                <button onClick={() => toggleStop(i)} disabled={saving}
                  className="btn btn-sm flex-shrink-0 text-xs"
                  style={{background: isDone?'#FEF3C7':'#0F6E56', color: isDone?'#92400E':'white', minWidth:'60px'}}>
                  {isDone ? '↩ Undo' : '✓ Done'}
                </button>
              </div>
              <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.match(/\(([^)]+)\)/)?.[1] || stop)}`, '_blank')}
                className="mt-2 w-full flex items-center justify-center gap-1 py-1 rounded-lg text-xs"
                style={{background:'#185FA5',color:'white'}}>
                🗺️ Google Maps
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    fetch(`/api/route-days?driver_id=${driverId}&date=${today}`)
      .then(r => r.json())
      .then(async days => {
        const day = Array.isArray(days) ? days[0] : null;
        setRouteDay(day);
        if (day?.id) {
          const res = await fetch(`/api/route-stops?route_day_id=${day.id}`);
          const data = await res.json();
          setStops(Array.isArray(data) ? data : []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [driverId]);

  const toggleStop = async (stop) => {
    const newStatus = stop.status === 'completed' ? 'pending' : 'completed';
    setUpdating(stop.id);
    try {
      await fetch(`/api/route-stops/${stop.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: newStatus } : s));
    } catch(e) { console.error(e); }
    setUpdating(null);
  };

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function DriverDual() {
  const { driverId } = useParams();
  const { drivers }  = useApp();

  const driverObj      = drivers?.find(d => d.id === driverId);
  const driverName     = driverObj?.name     || driverId || 'Driver';
  const driverColor    = driverObj?.color    || 'var(--tn-red)';
  const driverInitials = driverObj?.initials || driverId?.substring(0,2).toUpperCase() || 'DR';
const route = driverId === 'pierre' ? 'Québec' : driverId === 'jeanluc' ? 'Ontario' : 'Route';
  const [tab, setTab] = useState('route'); // default to route
  if (!driverId) return null;

  return (
    <div className="min-h-screen" style={{background:'var(--tn-cream)'}}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4" style={{background:'var(--tn-dark)',borderBottom:'0.5px solid rgba(139,105,20,0.2)',paddingTop:'max(12px, env(safe-area-inset-top))',paddingBottom:'0'}}>
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{background:driverColor}}>
              {driverInitials}
            </div>
            <div>
              <p className="text-xs" style={{color:'rgba(250,247,240,0.4)'}}>{driverName}</p>
              <p className="text-sm font-medium" style={{color:'var(--tn-cream)'}}>{format(new Date(),'EEEE, MMMM d')}</p>
            </div>
          </div>
          <button onClick={() => window.location.href = '/'}
            style={{minWidth:'44px',minHeight:'44px',background:'rgba(250,247,240,0.08)',color:'rgba(250,247,240,0.5)',border:'0.5px solid rgba(139,105,20,0.2)',borderRadius:'10px',fontSize:'18px',display:'flex',alignItems:'center',justifyContent:'center'}}>
            🚪
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b" style={{borderColor:'rgba(139,105,20,0.2)'}}>
          {[['route',`🗺️ ${route}`],['local','📦 Local']].map(([val,label])=>(
            <button key={val} onClick={()=>setTab(val)}
              className="flex-1 py-3 text-sm font-medium transition-all"
              style={{
                color: tab===val ? 'var(--tn-cream)' : 'rgba(250,247,240,0.4)',
                borderBottom: tab===val ? '2px solid var(--tn-red)' : '2px solid transparent',
                marginBottom: '-1px',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === 'route'
        ? <RouteTab driverId={driverId} route={route} />
        : <LocalTab driverId={driverId} driverColor={driverColor} driverInitials={driverInitials} />
      }
    </div>
  );
}
