import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

const STATUS_INFO = {
  waiting:   { label:'Order placed',  color:'#8B6914', icon:'📦' },
  picked:    { label:'Picked up',     color:'#B45309', icon:'🏭' },
  enroute:   { label:'On the way',    color:'#185FA5', icon:'🚚' },
  delivered: { label:'Delivered',     color:'#0F6E56', icon:'✅' },
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function ClientTracking() {
  const { orderId } = useParams();
  const mapRef       = useRef(null);
  const mapInstance  = useRef(null);
  const deliveryMark = useRef(null);
  const driverMark   = useRef(null);

  const [order,     setOrder]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const fetchOrder = async () => {
    try {
      const res  = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) throw new Error('Order not found');
      const data = await res.json();
      setOrder(data);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const fetchDriverLocation = async (driverId) => {
    try {
      const res = await fetch(`/api/drivers/${driverId}/location`);
      if (res.ok) {
        const data = await res.json();
        if (data.lat && data.lng) setDriverPos({ lat: data.lat, lng: data.lng });
      }
    } catch(e) {}
  };

  useEffect(() => { fetchOrder(); }, [orderId]);

  // Poll driver location
  useEffect(() => {
    if (!order || order.status !== 'enroute' || !order.driver_id) return;
    fetchDriverLocation(order.driver_id);
    const iv = setInterval(() => fetchDriverLocation(order.driver_id), 15000);
    return () => clearInterval(iv);
  }, [order]);

  // Load Mapbox dynamically
  useEffect(() => {
    if (mapLoaded || !mapRef.current) return;

    const script = document.createElement('script');
    script.src   = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.async = true;
    script.onload = () => {
      const link = document.createElement('link');
      link.rel   = 'stylesheet';
      link.href  = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
      document.head.appendChild(link);

      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      mapInstance.current = new window.mapboxgl.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-73.5674, 45.5017],
        zoom: 11,
      });
      mapInstance.current.addControl(new window.mapboxgl.NavigationControl(), 'top-right');
      setMapLoaded(true);
    };
    document.head.appendChild(script);
  }, [mapRef.current]);

  // Geocode delivery address and add marker
  useEffect(() => {
    if (!mapLoaded || !mapInstance.current || !order?.address) return;

    const geocode = async () => {
      try {
        const encoded = encodeURIComponent(order.address + ', Quebec, Canada');
        const res  = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&country=CA&limit=1`
        );
        const data = await res.json();
        if (data.features?.length > 0) {
          const [lng, lat] = data.features[0].center;

          const el = document.createElement('div');
          el.innerHTML  = '📍';
          el.style.fontSize = '36px';
          el.style.lineHeight = '1';

          deliveryMark.current = new window.mapboxgl.Marker({ element: el })
            .setLngLat([lng, lat])
            .setPopup(
              new window.mapboxgl.Popup({ offset: 25 }).setHTML(
                `<div style="font-family:sans-serif;padding:6px 2px">
                  <p style="font-weight:700;margin:0;font-size:13px">${order.to_business_name || order.client_name || 'Delivery'}</p>
                  <p style="color:#666;font-size:11px;margin:3px 0 0">${order.address}</p>
                  ${order.to_associate_name ? `<p style="font-size:11px;margin:2px 0 0;color:#333">To: ${order.to_associate_name}</p>` : ''}
                </div>`
              )
            )
            .addTo(mapInstance.current);

          mapInstance.current.flyTo({ center: [lng, lat], zoom: 14, duration: 1500 });
        }
      } catch(e) { console.error('Geocoding error:', e); }
    };

    geocode();
  }, [mapLoaded, order]);

  // Update driver marker
  useEffect(() => {
    if (!mapLoaded || !mapInstance.current || !driverPos) return;

    if (driverMark.current) driverMark.current.remove();

    const el = document.createElement('div');
    el.innerHTML = '🚚';
    el.style.fontSize = '30px';
    el.style.filter   = 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))';
    el.style.lineHeight = '1';

    driverMark.current = new window.mapboxgl.Marker({ element: el })
      .setLngLat([driverPos.lng, driverPos.lat])
      .setPopup(
        new window.mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="font-family:sans-serif;padding:6px 2px">
            <p style="font-weight:700;margin:0;font-size:13px">${order?.driver_name || 'Driver'}</p>
            <p style="color:#185FA5;font-size:11px;margin:3px 0 0">🚚 En route to you</p>
          </div>`
        )
      )
      .addTo(mapInstance.current);

    // If both markers exist, fit bounds to show both
    if (deliveryMark.current) {
      const bounds = new window.mapboxgl.LngLatBounds();
      bounds.extend([driverPos.lng, driverPos.lat]);
      bounds.extend(deliveryMark.current.getLngLat());
      mapInstance.current.fitBounds(bounds, { padding: 80, duration: 1000 });
    }
  }, [driverPos, mapLoaded]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'var(--tn-dark)'}}>
      <div className="text-center">
        <div className="text-4xl mb-3 animate-pulse">🗺️</div>
        <p style={{color:'var(--tn-cream)'}}>Loading tracking...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'var(--tn-dark)'}}>
      <div className="text-center">
        <div className="text-4xl mb-3">❌</div>
        <p style={{color:'var(--tn-cream)'}}>Order not found</p>
        <p className="text-sm mt-1" style={{color:'rgba(250,247,240,0.4)'}}>Order ID: {orderId}</p>
      </div>
    </div>
  );

  const statusInfo = STATUS_INFO[order?.status] || STATUS_INFO.waiting;
  const rank = ['waiting','picked','enroute','delivered'].indexOf(order?.status);

  return (
    <div style={{display:'flex', flexDirection:'column', height:'100vh', background:'var(--tn-cream)'}}>

      {/* Header */}
      <div style={{flexShrink:0, padding:'12px 16px', background:'var(--tn-dark)', borderBottom:'0.5px solid rgba(139,105,20,0.2)'}}>
        <div style={{maxWidth:'640px', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
            <span style={{fontSize:'24px'}}>{statusInfo.icon}</span>
            <div>
              <p style={{fontFamily:'monospace', fontSize:'11px', color:'rgba(250,247,240,0.4)', margin:0}}>{order?.id}</p>
              <p style={{fontSize:'14px', fontWeight:'600', color:'var(--tn-cream)', margin:0}}>{statusInfo.label}</p>
            </div>
          </div>
          {order?.status === 'enroute' && (
            <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
              <div style={{width:'8px', height:'8px', borderRadius:'50%', background:'#4ADE80', animation:'pulse 2s infinite'}}/>
              <span style={{fontSize:'11px', color:'rgba(250,247,240,0.6)'}}>Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Map container */}
      <div ref={mapRef} style={{flex:1, minHeight:'250px'}} />

      {/* Info panel */}
      <div style={{flexShrink:0, padding:'16px', background:'var(--tn-cream)', borderTop:'0.5px solid var(--tn-border)', maxHeight:'45vh', overflowY:'auto'}}>
        <div style={{maxWidth:'640px', margin:'0 auto'}}>

          {/* Progress steps */}
          <div style={{display:'flex', alignItems:'center', marginBottom:'16px'}}>
            {['waiting','picked','enroute','delivered'].map((step, i) => {
              const done   = i <= rank;
              const labels = ['Placed','Picked up','En route','Delivered'];
              return (
                <div key={step} style={{display:'flex', alignItems:'center', flex: i < 3 ? 1 : 'none'}}>
                  <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                    <div style={{
                      width:'24px', height:'24px', borderRadius:'50%',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:'11px', fontWeight:'bold',
                      background: done ? statusInfo.color : 'var(--tn-warm)',
                      color: done ? 'white' : 'var(--tn-gold)',
                    }}>
                      {done ? '✓' : i+1}
                    </div>
                    <p style={{fontSize:'9px', marginTop:'4px', color: done ? 'var(--tn-dark)' : 'rgba(26,18,8,0.3)', textAlign:'center', whiteSpace:'nowrap'}}>
                      {labels[i]}
                    </p>
                  </div>
                  {i < 3 && (
                    <div style={{flex:1, height:'2px', margin:'0 4px', marginBottom:'16px', background: i < rank ? statusInfo.color : 'var(--tn-warm)'}}/>
                  )}
                </div>
              );
            })}
          </div>

          {/* Details grid */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
            <div style={{borderRadius:'12px', padding:'10px', background:'var(--tn-warm)'}}>
              <p style={{fontSize:'11px', color:'var(--tn-gold)', margin:'0 0 2px'}}>Delivery address</p>
              <p style={{fontSize:'13px', fontWeight:'500', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{order?.address}</p>
            </div>
            <div style={{borderRadius:'12px', padding:'10px', background:'var(--tn-warm)'}}>
              <p style={{fontSize:'11px', color:'var(--tn-gold)', margin:'0 0 2px'}}>Driver</p>
              <p style={{fontSize:'13px', fontWeight:'500', margin:0}}>{order?.driver_name || '—'}</p>
            </div>
            {order?.requested_delivery_time && (
              <div style={{borderRadius:'12px', padding:'10px', background:'var(--tn-warm)'}}>
                <p style={{fontSize:'11px', color:'var(--tn-gold)', margin:'0 0 2px'}}>Deliver by</p>
                <p style={{fontSize:'13px', fontWeight:'500', margin:0}}>🕐 {order.requested_delivery_time}</p>
              </div>
            )}
            {order?.boxes && (
              <div style={{borderRadius:'12px', padding:'10px', background:'var(--tn-warm)'}}>
                <p style={{fontSize:'11px', color:'var(--tn-gold)', margin:'0 0 2px'}}>Boxes</p>
                <p style={{fontSize:'13px', fontWeight:'500', margin:0}}>{order.boxes} box{order.boxes > 1 ? 'es' : ''}</p>
              </div>
            )}
          </div>

          {order?.status === 'delivered' && (
            <div style={{marginTop:'12px', borderRadius:'12px', padding:'12px', background:'#E8F5EF', display:'flex', alignItems:'center', gap:'8px'}}>
              <span>✅</span>
              <div>
                <p style={{fontSize:'13px', fontWeight:'500', color:'#0F6E56', margin:0}}>Delivered successfully</p>
                {order.delivered_at && <p style={{fontSize:'11px', color:'#0F6E56', margin:'2px 0 0'}}>at {order.delivered_at}</p>}
              </div>
            </div>
          )}

          {order?.status === 'enroute' && !driverPos && (
            <div style={{marginTop:'12px', borderRadius:'12px', padding:'10px', background:'#EFF6FF'}}>
              <p style={{fontSize:'12px', textAlign:'center', color:'#185FA5', margin:0}}>
                🚚 Driver is on the way — location updates every 15 seconds
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
