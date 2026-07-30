import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { format } from 'date-fns';
import { useParams } from 'react-router-dom';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const STATUS_RANK  = { waiting:0, picked:1, enroute:2, delivered:3 };
const STATUS_LABEL = { waiting:'Awaiting pickup', picked:'Picked up', enroute:'En route', delivered:'Delivered' };
const STATUS_COLOR = { waiting:'badge-gray', picked:'badge-warning', enroute:'badge-info', delivered:'badge-success' };

export default function DriverLocal() {
  const { driverId } = useParams();
  const driver         = driverId || 'marc';
  const driverName     = driver === 'peter' ? 'Peter' : 'Marc Dumont';
  const driverColor    = driver === 'peter' ? '#7C3AED' : 'var(--tn-red)';
  const driverInitials = driver === 'peter' ? 'PE' : 'MD';

  const [orders,        setOrders]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [period,        setPeriod]        = useState('today');
  const [filter,        setFilter]        = useState('all');
  const [activeEnroute, setActiveEnroute] = useState(null);
  const [tab,           setTab]           = useState('orders');
  const [expanded,      setExpanded]      = useState(null);
  const [showProof,     setShowProof]     = useState(null);
  const [proofStep,     setProofStep]     = useState(1);
  const [recipientName, setRecipientName] = useState('');
  const [sigDrawn,      setSigDrawn]      = useState(false);
  const [photoTaken,    setPhotoTaken]    = useState(false);
  const [photoDataUrl,  setPhotoDataUrl]  = useState(null);
  const [photoFile,     setPhotoFile]     = useState(null);
  const [sigDataUrl, setSigDataUrl] = useState(null);
  const sigCanvasRef = useRef(null);
  const locationInterval = useRef(null);
  usePushNotifications('driver', driver?.id);

  const fetchMyOrders = useCallback(async () => {
    try {
      const url = period === '7days'
        ? `/api/orders?driver_id=${driver}&days=7`
        : `/api/orders?driver_id=${driver}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.map(o => ({
          ...o,
          clientName:      o.client_name || o.to_business_name || o.billing_name || o.client_id || '—',
          toAssociateName: o.to_associate_name  || '',
          toBusinessPhone: o.to_business_phone  || '',
          requestedTime:   o.requested_delivery_time || '',
          pickupLocation:  o.pickup_location    || '',
          fromName:        o.billing_name       || '',
          fromPhone:       o.billing_phone      || '',
          storeNumber:     o.store_number       || '',
          poNumber:        o.po_number          || '',
          typeBoite:       o.type_boite         || '',
          notes:           o.notes              || '',
          dropoffDate:     o.to_dropoff_date    || '',
          fromPickupDate:  o.from_pickup_date   || '',
        })));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [driver, period]);

  useEffect(() => {
    fetchMyOrders();
    const iv = period === 'today' ? setInterval(fetchMyOrders, 30000) : null;
    return () => { if (iv) clearInterval(iv); };
  }, [driver, period, fetchMyOrders]);

  // GPS location sharing when enroute
  const startLocationSharing = useCallback(() => {
    if (!navigator.geolocation) return;
    const sendLocation = () => {
      navigator.geolocation.getCurrentPosition(pos => {
        fetch(`/api/drivers/${driver}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        }).catch(() => {});
      }, () => {}, { enableHighAccuracy: true });
    };
    sendLocation(); // send immediately
    locationInterval.current = setInterval(sendLocation, 30000); // then every 30s
  }, [driver]);

  const stopLocationSharing = useCallback(() => {
    if (locationInterval.current) {
      clearInterval(locationInterval.current);
      locationInterval.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopLocationSharing();
  }, []);

  const delivered = orders.filter(o => o.status === 'delivered').length;
  const remaining = orders.filter(o => o.status !== 'delivered').length;

  const filteredOrders = orders.filter(o => {
    if (filter === 'delivered') return o.status === 'delivered';
    if (filter === 'remaining') return o.status !== 'delivered';
    return true;
  });

  const now = () => new Date().toLocaleTimeString('en-CA', { hour:'2-digit', minute:'2-digit', hour12:true });

  const updateStatus = async (id, status, extra = {}) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status, ...extra } : o));
    try {
      await fetch(`/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      });
    } catch(e) { console.error(e); }
  };

  const pickUp = id => updateStatus(id, 'picked', { picked_up_at: now() });

  const startDelivery = id => {
    if (activeEnroute) return alert('Finish current delivery first');
    setActiveEnroute(id);
    updateStatus(id, 'enroute', { on_way_at: now() });
    startLocationSharing(); // 🗺️ Start GPS sharing
  };

  const openProof = id => {
    setShowProof(id);
    setProofStep(1);
    setPhotoTaken(false);
    setPhotoDataUrl(null);
    setPhotoFile(null);
    setSigDrawn(false);
    setSigDataUrl(null);
    setRecipientName('');
  };

  const submitDelivery = async () => {
    let photo_url = null;
    let signature_url = null;

    // Upload photo to Cloudinary
    if (photoFile) {
      try {
        const reader = new FileReader();
        const photoBase64 = await new Promise(resolve => {
          reader.onload = e => resolve(e.target.result.split(',')[1]);
          reader.readAsDataURL(photoFile);
        });
        const res = await fetch('/api/upload/delivery-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: photoBase64, orderId: showProof }),
        });
        const data = await res.json();
        if (data.url) photo_url = data.url;
      } catch(e) { console.error('Photo upload failed:', e); }
    }

    // Upload signature from saved data URL
    if (sigDataUrl) {
      try {
        const sigBase64 = sigDataUrl.split(',')[1];
        const res = await fetch('/api/upload/delivery-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: sigBase64, orderId: `${showProof}_sig` }),
        });
        const data = await res.json();
        if (data.url) signature_url = data.url;
      } catch(e) { console.error('Signature upload failed:', e); }
    }

    updateStatus(showProof, 'delivered', {
      delivered_at: now(),
      recipient_name: recipientName,
      photo_url,
      signature_url,
    });
    setActiveEnroute(null);
    setShowProof(null);
    stopLocationSharing();
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
      <div className="sticky top-0 z-10 px-4" style={{background:'var(--tn-dark)',borderBottom:'0.5px solid rgba(139,105,20,0.2)', paddingTop:'max(12px, env(safe-area-inset-top))', paddingBottom:'12px'}}>
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
          <div className="flex items-center gap-2">
            {activeEnroute && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{background:'rgba(24,95,165,0.2)'}}>
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"/>
                <span className="text-xs" style={{color:'#93C5FD'}}>GPS on</span>
              </div>
            )}
            <p className="text-sm font-semibold tabular-nums" style={{color:'var(--tn-gold)'}}>{format(new Date(),'hh:mm a')}</p>
            <button onClick={() => window.location.href = '/'}
              style={{
                minWidth:'44px', minHeight:'44px',
                background:'rgba(250,247,240,0.08)',
                color:'rgba(250,247,240,0.5)',
                border:'0.5px solid rgba(139,105,20,0.2)',
                borderRadius:'10px',
                fontSize:'18px',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}
              title="Sign out">
              🚪
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label:'Delivered',  val:delivered, color:'var(--tn-red)',  key:'delivered' },
            { label:'Remaining',  val:remaining, color:'var(--tn-gold)', key:'remaining' },
            { label:'All orders', val:orders.length, color:'#185FA5',   key:'all' },
          ].map((s,i) => (
            <button key={i} onClick={() => setFilter(s.key)}
              className="card p-3 text-center transition-all"
              style={{borderColor:filter===s.key?s.color:'var(--tn-border)', borderWidth:filter===s.key?'2px':'0.5px'}}>
              <div className="text-xl font-semibold" style={{color:s.color}}>{s.val}</div>
              <div className="text-xs mt-0.5" style={{color:filter===s.key?s.color:'var(--tn-gold)'}}>
                {s.label}{filter===s.key?' ●':''}
              </div>
            </button>
          ))}
        </div>

        {/* Period toggle */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{background:'var(--tn-warm)',width:'fit-content'}}>
          {[['today','Today'],['7days','Last 7 days']].map(([val,label]) => (
            <button key={val} onClick={() => { setPeriod(val); setLoading(true); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{background:period===val?'white':'transparent', color:period===val?'var(--tn-dark)':'var(--tn-gold)', boxShadow:period===val?'0 1px 3px rgba(0,0,0,0.1)':'none'}}>
              {label}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {[['orders','Orders'],['stats','Stats']].map(([val,label]) => (
            <button key={val} onClick={() => setTab(val)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium"
              style={{background:tab===val?'var(--tn-red)':'white', color:tab===val?'white':'var(--tn-gold)', border:'0.5px solid var(--tn-border)'}}>
              {label}
            </button>
          ))}
          <button onClick={fetchMyOrders} className="ml-auto btn btn-outline btn-sm text-xs">↻</button>
        </div>

        {tab === 'orders' && (
          <div className="space-y-3">
            {filteredOrders.length === 0 && (
              <div className="card p-8 text-center">
                <p className="text-3xl mb-2">📦</p>
                <p className="font-medium">
                  {filter==='delivered'?'No deliveries yet':filter==='remaining'?'All done! 🎉':'No orders assigned yet'}
                </p>
                <p className="text-sm mt-1" style={{color:'var(--tn-gold)'}}>
                  {filter==='all'?'Admin will assign orders to you':'Tap "All orders" to see everything'}
                </p>
              </div>
            )}

            {filteredOrders.map(order => {
              const rank     = STATUS_RANK[order.status] || 0;
              const isActive = activeEnroute === order.id;
              const isExp    = expanded === order.id;

              return (
                <div key={order.id} className="card overflow-hidden"
                  style={{borderColor:isActive?'var(--tn-red)':undefined, borderWidth:isActive?'1px':undefined}}>

                  <div className="p-4 cursor-pointer" onClick={() => setExpanded(isExp ? null : order.id)}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{order.clientName}</p>
                        <p className="text-xs mt-0.5 truncate" style={{color:'var(--tn-gold)'}}>{order.address}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-xs" style={{color:'rgba(139,105,20,0.6)'}}>{order.boxes} box{order.boxes>1?'es':''}</p>
                          {order.storeNumber && <p className="text-xs" style={{color:'rgba(139,105,20,0.6)'}}>· {order.storeNumber.startsWith('Store')?order.storeNumber:`Store ${order.storeNumber}`}</p>}
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
                      {['Assigned','Picked up','En route','Delivered'].map((step,si) => (
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

                  {/* Expanded details */}
                  {isExp && (
                    <div className="px-4 pb-4 space-y-2 border-t" style={{borderColor:'var(--tn-border)'}}>
                      <div className="rounded-xl p-3 mt-3" style={{background:'var(--tn-warm)'}}>
                        <p className="text-xs mb-0.5" style={{color:'var(--tn-gold)'}}>📍 Delivery address</p>
                        <p className="font-medium text-sm">{order.address}</p>
                      </div>
                      {(order.toAssociateName||order.toBusinessPhone) && (
                        <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                          <p className="text-xs mb-1" style={{color:'var(--tn-gold)'}}>👤 Recipient</p>
                          <div className="flex items-center justify-between">
                            {order.toAssociateName&&<p className="font-medium text-sm">{order.toAssociateName}</p>}
                            {order.toBusinessPhone&&(
                              <a href={`tel:${order.toBusinessPhone}`} className="btn btn-sm" style={{background:'var(--tn-red)',color:'white'}}>📞 Call</a>
                            )}
                          </div>
                        </div>
                      )}
                      {order.pickupLocation&&(
                        <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                          <p className="text-xs mb-0.5" style={{color:'var(--tn-gold)'}}>🏭 Pickup location</p>
                          <p className="font-medium text-sm">{order.pickupLocation}</p>
                          {order.fromName&&<p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>Contact: {order.fromName}{order.fromPhone?` · ${order.fromPhone}`:''}</p>}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        {order.poNumber&&(<div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}><p className="text-xs" style={{color:'var(--tn-gold)'}}>PO Number</p><p className="font-semibold text-sm font-mono">{order.poNumber}</p></div>)}
                        {order.boxes&&(<div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}><p className="text-xs" style={{color:'var(--tn-gold)'}}>Boxes</p><p className="font-semibold text-sm">{order.boxes} box{order.boxes>1?'es':''}</p></div>)}
                        {order.typeBoite&&(<div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}><p className="text-xs" style={{color:'var(--tn-gold)'}}>Box type</p><p className="font-semibold text-sm">{order.typeBoite}</p></div>)}
                        {order.requestedTime&&(<div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}><p className="text-xs" style={{color:'var(--tn-gold)'}}>Deliver by</p><p className="font-semibold text-sm">🕐 {order.requestedTime}</p></div>)}
                        {order.fromPickupDate&&(<div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}><p className="text-xs" style={{color:'var(--tn-gold)'}}>📅 Pickup date</p><p className="font-semibold text-sm">{order.fromPickupDate}</p></div>)}
                        {order.dropoffDate&&(<div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}><p className="text-xs" style={{color:'var(--tn-gold)'}}>📅 Dropoff date</p><p className="font-semibold text-sm">{order.dropoffDate}</p></div>)}
                      </div>
                      {order.notes&&(
                        <div className="rounded-xl p-3" style={{background:'#FEF3C7',border:'0.5px solid #D97706'}}>
                          <p className="text-xs mb-1" style={{color:'#92400E'}}>📝 Notes</p>
                          <p className="text-sm" style={{color:'#92400E'}}>{order.notes.startsWith('Notes:')?order.notes.split('|')[0].replace('Notes:','').trim():order.notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="px-4 pb-4">
                    {order.status==='waiting'&&(
                      <button onClick={()=>pickUp(order.id)} className="btn btn-sm w-full justify-center" style={{background:'var(--tn-gold)',color:'white'}}>📦 Mark as picked up</button>
                    )}
                    {order.status==='picked'&&(
                      <button onClick={()=>startDelivery(order.id)} disabled={!!activeEnroute&&activeEnroute!==order.id}
                        className="btn btn-sm w-full justify-center" style={{background:'var(--tn-red)',color:'white',opacity:activeEnroute&&activeEnroute!==order.id?0.4:1}}>
                        🚚 On my way
                      </button>
                    )}
                    {order.status==='enroute'&&(
                      <button onClick={()=>openProof(order.id)} className="btn btn-success btn-sm w-full justify-center">✓ Mark delivered</button>
                    )}
                    {order.status==='delivered'&&(
                      <p className="text-xs font-medium text-center" style={{color:'#0F6E56'}}>✓ Delivered at {order.delivered_at}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab==='stats'&&(
          <div className="card p-4">
            <h2 className="section-title">Today's summary</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                {label:'Orders assigned', val:orders.length},
                {label:'Delivered',       val:`${delivered} / ${orders.length}`},
                {label:'Total boxes',     val:orders.reduce((s,o)=>s+o.boxes,0)},
                {label:'Remaining',       val:remaining},
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

      {/* Proof modal */}
      {showProof&&(
        <div className="fixed inset-0 flex items-end z-50" style={{background:'rgba(26,18,8,0.6)'}}>
          <div className="w-full rounded-t-2xl p-5 max-w-lg mx-auto max-h-[92vh] overflow-y-auto" style={{background:'var(--tn-cream)'}}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{background:'var(--tn-border-strong)'}}/>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Confirm delivery</h2>
              <button onClick={()=>setShowProof(null)} className="text-xl leading-none" style={{color:'var(--tn-gold)'}}>×</button>
            </div>

            {/* Steps */}
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

            {/* Step 1 — Camera */}
            {proofStep===1&&(
              <div>
                <p className="font-medium text-sm mb-3">Take a photo of the delivery</p>
                {!photoTaken ? (
                  <div>
                    <label htmlFor="camera-input" className="w-full rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer"
                      style={{border:'2px dashed var(--tn-border-strong)',background:'var(--tn-warm)'}}>
                      <span className="text-4xl">📷</span>
                      <span className="text-sm font-medium" style={{color:'var(--tn-gold)'}}>Tap to open camera</span>
                      <span className="text-xs" style={{color:'rgba(139,105,20,0.5)'}}>Or select from gallery</span>
                    </label>
                    <input
                      id="camera-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        // Show preview
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setPhotoTaken(true);
                          setPhotoDataUrl(ev.target.result);
                        };
                        reader.readAsDataURL(file);
                        setPhotoFile(file);
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <img src={photoDataUrl} alt="Delivery" className="w-full rounded-xl object-cover" style={{maxHeight:'220px'}}/>
                    <button onClick={() => { setPhotoTaken(false); setPhotoDataUrl(null); setPhotoFile(null); }}
                      className="btn btn-outline btn-sm w-full justify-center text-xs">
                      📷 Retake photo
                    </button>
                  </div>
                )}
                <button disabled={!photoTaken} onClick={()=>setProofStep(2)} className="btn w-full justify-center mt-4"
                  style={{background:photoTaken?'var(--tn-red)':'var(--tn-warm)',color:photoTaken?'white':'var(--tn-gold)'}}>
                  Next — Signature →
                </button>
              </div>
            )}

            {/* Step 2 — Signature */}
            {proofStep===2&&(
              <div>
                <p className="font-medium text-sm mb-3">Recipient signature</p>
                <input className="input mb-3" placeholder="Received by (full name)" value={recipientName} onChange={e=>setRecipientName(e.target.value)}/>
                <p className="text-xs mb-2" style={{color:'var(--tn-gold)'}}>Sign below with finger:</p>
                <canvas
                  ref={sigCanvasRef}
                  width={340}
                  height={140}
                  className="w-full rounded-xl"
                  style={{border:'0.5px solid var(--tn-border-strong)',background:'white',touchAction:'none',cursor:'crosshair'}}
                  onPointerDown={(e) => {
                    const canvas = sigCanvasRef.current;
                    const ctx = canvas.getContext('2d');
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    ctx.beginPath();
                    ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                    ctx.lineWidth = 2.5;
                    ctx.strokeStyle = '#1A1208';
                    ctx.lineCap = 'round';
                    canvas.isDrawing = true;
                    setSigDrawn(true);
                  }}
                  onPointerMove={(e) => {
                    const canvas = sigCanvasRef.current;
                    if (!canvas.isDrawing) return;
                    const ctx = canvas.getContext('2d');
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                    ctx.stroke();
                  }}
                  onPointerUp={() => { if (sigCanvasRef.current) sigCanvasRef.current.isDrawing = false; }}
                  onPointerLeave={() => { if (sigCanvasRef.current) sigCanvasRef.current.isDrawing = false; }}
                />
                {sigDrawn && (
                  <button onClick={() => {
                    const canvas = sigCanvasRef.current;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    setSigDrawn(false);
                  }} className="btn btn-outline btn-sm mt-2 text-xs">
                    ✕ Clear signature
                  </button>
                )}
                <div className="flex gap-2 mt-4">
                  <button onClick={()=>setProofStep(1)} className="btn btn-outline">← Back</button>
                  <button disabled={!sigDrawn||!recipientName} onClick={()=>{
                    // Save signature to state before canvas unmounts
                    if (sigCanvasRef.current) {
                      const canvas = sigCanvasRef.current;
                      const exportCanvas = document.createElement('canvas');
                      exportCanvas.width = canvas.width;
                      exportCanvas.height = canvas.height;
                      const ctx = exportCanvas.getContext('2d');
                      ctx.fillStyle = 'white';
                      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
                      ctx.drawImage(canvas, 0, 0);
                      setSigDataUrl(exportCanvas.toDataURL('image/png'));
                    }
                    setProofStep(3);
                  }} className="btn flex-1 justify-center"
                    style={{background:sigDrawn&&recipientName?'var(--tn-red)':'var(--tn-warm)',color:sigDrawn&&recipientName?'white':'var(--tn-gold)'}}>
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — Confirm */}
            {proofStep===3&&(
              <div>
                <p className="font-medium text-sm mb-3">Review & confirm</p>
                {photoDataUrl && (
                  <img src={photoDataUrl} alt="Delivery" className="w-full rounded-xl object-cover mb-3" style={{maxHeight:'150px'}}/>
                )}
                {[
                  {icon:'📷', label:'Delivery photo', sub:'Photo captured ✓'},
                  {icon:'✍️', label:'Signature',       sub:`Signed by: ${recipientName}`},
                ].map((item,i)=>(
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl mb-2" style={{background:'var(--tn-warm)'}}>
                    <span className="text-xl">{item.icon}</span>
                    <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.sub}</p></div>
                    <span className="badge badge-success ml-auto">✓</span>
                  </div>
                ))}
                <div className="flex gap-2 mt-3">
                  <button onClick={()=>setProofStep(2)} className="btn btn-outline">← Back</button>
                  <button onClick={submitDelivery} className="btn btn-success flex-1 justify-center">
                    ✓ Submit & mark delivered
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
