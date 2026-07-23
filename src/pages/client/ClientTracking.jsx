import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

const STATUS_INFO = {
  waiting:   { label:'Order placed',  color:'#8B6914', icon:'📦' },
  picked:    { label:'Picked up',     color:'#B45309', icon:'🏭' },
  enroute:   { label:'On the way',    color:'#185FA5', icon:'🚚' },
  delivered: { label:'Delivered',     color:'#0F6E56', icon:'✅' },
};

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
export default function ClientTracking() {
  const { orderId } = useParams();
  const mapRef = useRef(null);
  const mapObj = useRef(null);

  const [order,    setOrder]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [coords,   setCoords]   = useState(null);
  const [driverPos,setDriverPos]= useState(null);

  useEffect(() => {
    fetch('/api/orders/' + orderId)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(data => { setOrder(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [orderId]);

  useEffect(() => {
    if (!order?.address) return;
    const q = encodeURIComponent(order.address + ', Quebec, Canada');
    fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/' + q + '.json?access_token=' + TOKEN + '&country=CA&limit=1')
      .then(r => r.json())
      .then(data => {
        if (data.features && data.features[0]) {
          const [lng, lat] = data.features[0].center;
          setCoords({ lat, lng });
        }
      })
      .catch(() => {});
  }, [order]);

  useEffect(() => {
    if (!order?.driver_id || order.status !== 'enroute') return;
    const poll = () => {
      fetch('/api/drivers/' + order.driver_id + '/location')
        .then(r => r.json())
        .then(d => { if (d.lat && d.lng) setDriverPos({ lat: d.lat, lng: d.lng }); })
        .catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 15000);
    return () => clearInterval(iv);
  }, [order]);

  useEffect(() => {
    if (!mapRef.current || mapObj.current || !coords) return;

    if (!document.querySelector('link[href*="mapbox-gl"]')) {
      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
      document.head.appendChild(link);
    }

    const initMap = () => {
      if (!window.mapboxgl || !mapRef.current) return;
      window.mapboxgl.accessToken = TOKEN;
      const map = new window.mapboxgl.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [coords.lng, coords.lat],
        zoom: 14,
      });
      map.addControl(new window.mapboxgl.NavigationControl());
      const el = document.createElement('div');
      el.style.cssText = 'font-size:36px;line-height:1';
      el.textContent = '📍';
      new window.mapboxgl.Marker({ element: el }).setLngLat([coords.lng, coords.lat]).addTo(map);
      mapObj.current = map;
    };

    if (window.mapboxgl) {
      initMap();
    } else {
      const script = document.createElement('script');
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
      script.onload = initMap;
      document.head.appendChild(script);
    }
  }, [coords]);

  useEffect(() => {
    if (!mapObj.current || !driverPos || !window.mapboxgl) return;
    const el = document.createElement('div');
    el.style.cssText = 'font-size:30px;line-height:1';
    el.textContent = '🚚';
    new window.mapboxgl.Marker({ element: el }).setLngLat([driverPos.lng, driverPos.lat]).addTo(mapObj.current);
  }, [driverPos]);

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#1A1208'}}>
      <div style={{textAlign:'center'}}><div style={{fontSize:'48px',marginBottom:'12px'}}>🗺️</div><p style={{color:'#FAF7F0'}}>Loading...</p></div>
    </div>
  );

  if (error) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#1A1208'}}>
      <div style={{textAlign:'center'}}><div style={{fontSize:'48px',marginBottom:'12px'}}>❌</div><p style={{color:'#FAF7F0'}}>Order not found</p></div>
    </div>
  );

  const info  = STATUS_INFO[order?.status] || STATUS_INFO.waiting;
  const steps = ['waiting','picked','enroute','delivered'];
  const rank  = steps.indexOf(order?.status);

  return (
    <div style={{minHeight:'100vh',background:'#FAF7F0',fontFamily:'sans-serif'}}>
      <div style={{background:'#1A1208',padding:'14px 20px',borderBottom:'1px solid rgba(139,105,20,0.2)'}}>
        <div style={{maxWidth:'640px',margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <span style={{fontSize:'24px'}}>{info.icon}</span>
            <div>
              <p style={{fontFamily:'monospace',fontSize:'11px',color:'rgba(250,247,240,0.4)',margin:0}}>{order?.id}</p>
              <p style={{fontSize:'15px',fontWeight:'600',color:'#FAF7F0',margin:0}}>{info.label}</p>
            </div>
          </div>
          {order?.status==='enroute' && (
            <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
              <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#4ADE80'}}/>
              <span style={{fontSize:'11px',color:'rgba(250,247,240,0.6)'}}>Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div style={{width:'100%',height:'380px',background:'#d4e4d4',position:'relative'}}>
        <div ref={mapRef} style={{width:'100%',height:'100%'}} />
        {!coords && (
          <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#d4e4d4'}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:'40px'}}>🗺️</div>
              <p style={{color:'#666',fontSize:'13px',marginTop:'8px'}}>Loading map...</p>
            </div>
          </div>
        )}
      </div>

      <div style={{padding:'20px',maxWidth:'640px',margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',marginBottom:'20px'}}>
          {steps.map((step,i) => {
            const done   = i <= rank;
            const labels = ['Placed','Picked up','En route','Delivered'];
            return (
              <div key={step} style={{display:'flex',alignItems:'center',flex:i<3?1:'none'}}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                  <div style={{width:'26px',height:'26px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'bold',background:done?info.color:'#F0EBE0',color:done?'white':'#8B6914'}}>
                    {done?'✓':i+1}
                  </div>
                  <p style={{fontSize:'9px',margin:'4px 0 0',color:done?'#1A1208':'rgba(26,18,8,0.3)',textAlign:'center',whiteSpace:'nowrap'}}>{labels[i]}</p>
                </div>
                {i<3&&<div style={{flex:1,height:'2px',margin:'0 4px 16px',background:i<rank?info.color:'#F0EBE0'}}/>}
              </div>
            );
          })}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
          <div style={{borderRadius:'12px',padding:'12px',background:'#F0EBE0',gridColumn:'1/-1'}}>
            <p style={{fontSize:'11px',color:'#8B6914',margin:'0 0 3px'}}>Delivery address</p>
            <p style={{fontSize:'13px',fontWeight:'500',margin:0}}>{order?.address}</p>
          </div>
          <div style={{borderRadius:'12px',padding:'12px',background:'#F0EBE0'}}>
            <p style={{fontSize:'11px',color:'#8B6914',margin:'0 0 3px'}}>Driver</p>
            <p style={{fontSize:'13px',fontWeight:'500',margin:0}}>{order?.driver_name||'—'}</p>
          </div>
          {order?.boxes && (
            <div style={{borderRadius:'12px',padding:'12px',background:'#F0EBE0'}}>
              <p style={{fontSize:'11px',color:'#8B6914',margin:'0 0 3px'}}>Boxes</p>
              <p style={{fontSize:'13px',fontWeight:'500',margin:0}}>{order.boxes} box{order.boxes>1?'es':''}</p>
            </div>
          )}
          {order?.requested_delivery_time && (
            <div style={{borderRadius:'12px',padding:'12px',background:'#F0EBE0'}}>
              <p style={{fontSize:'11px',color:'#8B6914',margin:'0 0 3px'}}>Deliver by</p>
              <p style={{fontSize:'13px',fontWeight:'500',margin:0}}>🕐 {order.requested_delivery_time}</p>
            </div>
          )}
        </div>

        {order?.status==='delivered' && (
          <div style={{marginTop:'14px',borderRadius:'12px',padding:'14px',background:'#E8F5EF',display:'flex',alignItems:'center',gap:'10px'}}>
            <span style={{fontSize:'20px'}}>✅</span>
            <div>
              <p style={{fontSize:'14px',fontWeight:'600',color:'#0F6E56',margin:0}}>Delivered successfully</p>
              {order.delivered_at&&<p style={{fontSize:'12px',color:'#0F6E56',margin:'3px 0 0'}}>at {order.delivered_at}</p>}
            </div>
          </div>
        )}

        {order?.status==='enroute'&&!driverPos&&(
          <div style={{marginTop:'14px',borderRadius:'12px',padding:'12px',background:'#EFF6FF'}}>
            <p style={{fontSize:'12px',textAlign:'center',color:'#185FA5',margin:0}}>🚚 On the way — map updates every 15 seconds</p>
          </div>
        )}
      </div>
    </div>
  );
}
