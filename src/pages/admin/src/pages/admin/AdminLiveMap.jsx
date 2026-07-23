import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const DRIVER_COLORS = {
  local:   '#C0392B',
  ontario: '#8B4513',
  quebec:  '#0F6E56',
};

export default function AdminLiveMap() {
  const { orders, drivers } = useApp();
  const mapRef      = useRef(null);
  const mapObj      = useRef(null);
  const markersRef  = useRef({});
  const [mapReady,  setMapReady]  = useState(false);
  const [locations, setLocations] = useState({});
  const [selected,  setSelected]  = useState(null);
  const [lastUpdate,setLastUpdate]= useState(null);

  const todayOrders = orders.filter(o => {
    const d = o.date?.split('T')[0];
    return d === new Date().toISOString().split('T')[0];
  });

  const activeDrivers = drivers.filter(d =>
    todayOrders.some(o => (o.driver_id === d.id || o.driver === d.id) && ['picked','enroute'].includes(o.status))
  );

  // Fetch all driver locations
  const fetchLocations = async () => {
    const locs = {};
    await Promise.all(
      drivers.map(async d => {
        try {
          const res  = await fetch(`/api/drivers/${d.id}/location`);
          const data = await res.json();
          if (data.lat && data.lng) locs[d.id] = { lat: data.lat, lng: data.lng, updatedAt: data.location_updated_at };
        } catch(e) {}
      })
    );
    setLocations(locs);
    setLastUpdate(new Date());
  };

  useEffect(() => {
    fetchLocations();
    const iv = setInterval(fetchLocations, 15000);
    return () => clearInterval(iv);
  }, [drivers]);

  // Init map
  useEffect(() => {
    if (mapObj.current || !mapRef.current) return;

    if (!document.querySelector('link[href*="mapbox-gl"]')) {
      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
      document.head.appendChild(link);
    }

    const init = () => {
      if (!window.mapboxgl || !mapRef.current) return;
      window.mapboxgl.accessToken = TOKEN;
      const map = new window.mapboxgl.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-73.5674, 45.5017], // Montreal/Laval area
        zoom: 10,
      });
      map.addControl(new window.mapboxgl.NavigationControl(), 'top-right');
      mapObj.current = map;
      setMapReady(true);
    };

    if (window.mapboxgl) { init(); }
    else {
      const script = document.createElement('script');
      script.src   = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
      script.onload = init;
      document.head.appendChild(script);
    }
  }, [mapRef.current]);

  // Update driver markers on map
  useEffect(() => {
    if (!mapReady || !mapObj.current || !window.mapboxgl) return;

    // Remove old markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    // Add driver markers
    drivers.forEach(driver => {
      const loc = locations[driver.id];
      if (!loc) return;

      const driverOrders = todayOrders.filter(o => (o.driver_id === driver.id || o.driver === driver.id) && o.status === 'enroute');
      const isActive = driverOrders.length > 0;

      const el = document.createElement('div');
      el.style.cssText = `
        width: 40px; height: 40px; border-radius: 50%;
        background: ${driver.color || '#C0392B'};
        border: 3px solid white;
        display: flex; align-items: center; justify-content: center;
        color: white; font-weight: bold; font-size: 12px;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ${isActive ? 'animation: pulse 2s infinite;' : ''}
      `;
      el.textContent = driver.initials || '?';
      el.onclick = () => setSelected(driver.id === selected ? null : driver.id);

      const popup = new window.mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
        <div style="font-family:sans-serif;padding:6px 2px;min-width:160px">
          <p style="font-weight:700;margin:0;font-size:13px">${driver.name}</p>
          <p style="color:#666;font-size:11px;margin:3px 0 0">${isActive ? '🚚 En route' : '📍 On duty'}</p>
          ${driverOrders[0] ? `<p style="font-size:11px;margin:3px 0 0;color:#333">→ ${driverOrders[0].address}</p>` : ''}
        </div>
      `);

      markersRef.current[driver.id] = new window.mapboxgl.Marker({ element: el })
        .setLngLat([loc.lng, loc.lat])
        .setPopup(popup)
        .addTo(mapObj.current);
    });

    // Fit map to show all drivers
    const locs = Object.values(locations);
    if (locs.length > 1) {
      const bounds = new window.mapboxgl.LngLatBounds();
      locs.forEach(l => bounds.extend([l.lng, l.lat]));
      mapObj.current.fitBounds(bounds, { padding: 80, maxZoom: 14 });
    } else if (locs.length === 1) {
      mapObj.current.flyTo({ center: [locs[0].lng, locs[0].lat], zoom: 13 });
    }
  }, [locations, mapReady, drivers]);

  const fmt = d => d ? new Date(d).toLocaleTimeString('en-CA', { hour:'2-digit', minute:'2-digit', hour12:true }) : '—';

  return (
    <div className="flex flex-col" style={{height:'calc(100vh - 56px)'}}>
      {/* Top bar */}
      <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between" style={{background:'white',borderBottom:'0.5px solid var(--tn-border)'}}>
        <div>
          <h1 className="text-lg font-semibold" style={{color:'var(--tn-dark)'}}>Live driver map</h1>
          <p className="text-xs" style={{color:'var(--tn-gold)'}}>
            {activeDrivers.length} driver{activeDrivers.length !== 1 ? 's' : ''} active · Updates every 15s
            {lastUpdate && ` · Last: ${fmt(lastUpdate)}`}
          </p>
        </div>
        <button onClick={fetchLocations} className="btn btn-outline btn-sm">↻ Refresh</button>
      </div>

      {/* Driver legend */}
      <div className="flex-shrink-0 px-4 py-2 flex gap-3 overflow-x-auto" style={{background:'var(--tn-warm)',borderBottom:'0.5px solid var(--tn-border)'}}>
        {drivers.map(driver => {
          const loc = locations[driver.id];
          const driverOrders = todayOrders.filter(o => (o.driver_id===driver.id||o.driver===driver.id) && ['picked','enroute'].includes(o.status));
          return (
            <div key={driver.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl flex-shrink-0 cursor-pointer transition-all"
              style={{background:selected===driver.id?driver.color:'white', border:`1px solid ${driver.color}`}}
              onClick={() => {
                setSelected(driver.id === selected ? null : driver.id);
                if (loc && mapObj.current) mapObj.current.flyTo({ center:[loc.lng,loc.lat], zoom:14 });
              }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{background:driver.color}}>
                {driver.initials}
              </div>
              <div>
                <p className="text-xs font-medium" style={{color:selected===driver.id?'white':'var(--tn-dark)'}}>{driver.name}</p>
                <p className="text-xs" style={{color:selected===driver.id?'rgba(255,255,255,0.7)':'var(--tn-gold)'}}>
                  {loc ? (driverOrders.length>0?'🟢 En route':'🟡 On duty') : '⚪ No GPS'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Map */}
      <div ref={mapRef} style={{flex:1}} />

      {/* No GPS message */}
      {Object.keys(locations).length === 0 && (
        <div style={{position:'absolute',bottom:'80px',left:'50%',transform:'translateX(-50%)',zIndex:10}}>
          <div className="px-4 py-2 rounded-xl text-sm" style={{background:'rgba(26,18,8,0.8)',color:'white'}}>
            📍 Waiting for driver GPS — drivers share location when En route
          </div>
        </div>
      )}
    </div>
  );
}
