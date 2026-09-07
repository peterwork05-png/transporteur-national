import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function ClientTracking() {
  const { orderId } = useParams();
  const navigate    = useNavigate();
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);
  const markerRef   = useRef(null);
  const [status,    setStatus]    = useState('Loading...');
  const [lastSeen,  setLastSeen]  = useState(null);
  const [order,     setOrder]     = useState(null);

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-73.5673, 45.5017],
      zoom: 12,
    });
    mapInstance.current = map;
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    return () => map.remove();
  }, []);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const res  = await fetch(`/api/orders/${orderId}/track`);
        const data = await res.json();
        if (data.order) setOrder(data.order);

        if (data.location) {
          const { lat, lng, updated_at } = data.location;
          setStatus('Driver is on the way');
          setLastSeen(updated_at ? new Date(updated_at).toLocaleTimeString() : null);

          if (mapInstance.current) {
            mapInstance.current.flyTo({ center: [lng, lat], zoom: 14 });
            if (markerRef.current) {
              markerRef.current.setLngLat([lng, lat]);
            } else {
              const el = document.createElement('div');
              el.innerHTML = '🚚';
              el.style.fontSize = '28px';
              el.style.cursor = 'pointer';
              markerRef.current = new mapboxgl.Marker({ element: el })
                .setLngLat([lng, lat])
                .addTo(mapInstance.current);
            }
          }
        } else {
          setStatus(data.order?.status === 'delivered' ? 'Delivered ✅' : 'Waiting for driver location...');
        }
      } catch(err) { setStatus('Unable to load location'); }
    };

    fetchLocation();
    const interval = setInterval(fetchLocation, 15000);
    return () => clearInterval(interval);
  }, [orderId]);

  return (
    <div className="min-h-screen flex flex-col" style={{background:'var(--tn-dark)'}}>
      {/* Header with safe area */}
      <div className="px-4 flex items-center gap-3 z-10" style={{
        background:'var(--tn-dark)',
        borderBottom:'0.5px solid rgba(139,105,20,0.2)',
        paddingTop:'max(16px, env(safe-area-inset-top))',
        paddingBottom:'12px',
      }}>
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm flex-shrink-0"
          style={{color:'rgba(250,247,240,0.5)', minWidth:'44px', minHeight:'44px'}}>
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate" style={{color:'var(--tn-cream)'}}>
            🗺️ Live Tracking
          </p>
          {order && (
            <p className="text-xs truncate" style={{color:'rgba(250,247,240,0.4)'}}>
              {order.id} · {order.address}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xs font-medium" style={{color:'var(--tn-gold)'}}>{status}</p>
          {lastSeen && <p className="text-xs" style={{color:'rgba(250,247,240,0.3)'}}>Updated {lastSeen}</p>}
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} className="flex-1" style={{minHeight:'calc(100vh - 80px)'}} />

      {/* Bottom info */}
      <div className="px-4 py-3" style={{
        background:'var(--tn-dark)',
        borderTop:'0.5px solid rgba(139,105,20,0.2)',
        paddingBottom:'max(12px, env(safe-area-inset-bottom))',
      }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{background:'#4ADE80'}}/>
          <p className="text-xs" style={{color:'rgba(250,247,240,0.4)'}}>Updates every 15 seconds</p>
        </div>
      </div>
    </div>
  );
}
