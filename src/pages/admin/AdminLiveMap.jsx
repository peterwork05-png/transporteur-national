import { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';

function loadMapbox() {
  return new Promise((resolve) => {
    if (window.mapboxgl) { resolve(window.mapboxgl); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
    script.onload = () => resolve(window.mapboxgl);
    document.head.appendChild(script);
  });
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function AdminLiveMap() {
  const { drivers } = useApp();
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);
  const markersRef  = useRef({});
  const [driverStatuses, setDriverStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAllLocations = useCallback(async () => {
    if (!drivers?.length) return;
    const statuses = {};
    await Promise.all(drivers.map(async (driver) => {
      try {
        const [locRes, driverRes] = await Promise.all([
          fetch(`/api/drivers/${driver.id}/location`),
          fetch(`/api/drivers/${driver.id}/duty-status`),
        ]);
        const loc   = await locRes.json();
        const duty  = await driverRes.json();
        statuses[driver.id] = {
          ...driver,
          lat:          loc.lat,
          lng:          loc.lng,
          updated_at:   loc.location_updated_at,
          on_duty:      duty.on_duty || false,
          clocked_in_at: duty.clocked_in_at,
        };
      } catch(e) {
        statuses[driver.id] = { ...driver, lat: null, lng: null, on_duty: false };
      }
    }));
    setDriverStatuses(statuses);
    setLastUpdated(new Date().toLocaleTimeString());
    setLoading(false);

    // Update map markers
    if (!mapInstance.current) return;
    const mapboxgl = await loadMapbox();

    Object.values(statuses).forEach(driver => {
      if (!driver.lat || !driver.lng || !driver.on_duty) {
        // Remove marker if off duty or no location
        if (markersRef.current[driver.id]) {
          markersRef.current[driver.id].remove();
          delete markersRef.current[driver.id];
        }
        return;
      }

      const el = document.createElement('div');
      el.style.cssText = `
        width: 36px; height: 36px; border-radius: 50%;
        background: ${driver.color || '#C0392B'};
        border: 2px solid white;
        display: flex; align-items: center; justify-content: center;
        color: white; font-size: 12px; font-weight: bold;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      el.textContent = driver.initials || driver.name?.substring(0,2).toUpperCase() || '?';

      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
        <div style="font-family:Arial;padding:8px;min-width:140px">
          <p style="font-weight:bold;margin:0 0 4px">${driver.name}</p>
          <p style="color:#0F6E56;font-size:11px;margin:0">🟢 On duty</p>
          ${driver.clocked_in_at ? `<p style="color:#666;font-size:11px;margin:2px 0">Since ${new Date(driver.clocked_in_at).toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit',hour12:true})}</p>` : ''}
          ${driver.updated_at ? `<p style="color:#666;font-size:11px;margin:0">GPS: ${new Date(driver.updated_at).toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit',hour12:true})}</p>` : ''}
        </div>
      `);

      if (markersRef.current[driver.id]) {
        markersRef.current[driver.id].setLngLat([driver.lng, driver.lat]);
      } else {
        markersRef.current[driver.id] = new mapboxgl.Marker({ element: el })
          .setLngLat([driver.lng, driver.lat])
          .setPopup(popup)
          .addTo(mapInstance.current);
      }
    });
  }, [drivers]);

  useEffect(() => {
    const initMap = async () => {
      const mapboxgl = await loadMapbox();
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-73.5673, 45.5017],
        zoom: 10,
      });
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      mapInstance.current = map;
      map.on('load', fetchAllLocations);
    };
    initMap();
    return () => { if (mapInstance.current) mapInstance.current.remove(); };
  }, []);

  useEffect(() => {
    if (!loading) {
      const interval = setInterval(fetchAllLocations, 30000);
      return () => clearInterval(interval);
    }
  }, [loading, fetchAllLocations]);

  useEffect(() => {
    if (drivers?.length && !loading) fetchAllLocations();
  }, [drivers]);

  const onDutyDrivers  = Object.values(driverStatuses).filter(d => d.on_duty);
  const offDutyDrivers = Object.values(driverStatuses).filter(d => !d.on_duty);

  return (
    <div className="flex flex-col h-full" style={{minHeight:'calc(100vh - 60px)'}}>
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Live Map</h1>
            {lastUpdated && <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>Updated {lastUpdated}</p>}
          </div>
          <button onClick={fetchAllLocations} className="btn btn-outline btn-sm">↻ Refresh</button>
        </div>

        {/* Driver status cards */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* On duty */}
          <div className="card p-3">
            <p className="text-xs font-medium mb-2" style={{color:'#0F6E56'}}>🟢 On duty ({onDutyDrivers.length})</p>
            {onDutyDrivers.length === 0 ? (
              <p className="text-xs" style={{color:'var(--tn-gold)'}}>No drivers on duty</p>
            ) : onDutyDrivers.map(driver => (
              <div key={driver.id} className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{background: driver.color || 'var(--tn-red)'}}>
                  {driver.initials || driver.name?.substring(0,2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{driver.name}</p>
                  {driver.clocked_in_at && (
                    <p className="text-xs" style={{color:'var(--tn-gold)'}}>
                      Since {new Date(driver.clocked_in_at).toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit',hour12:true})}
                    </p>
                  )}
                  {driver.lat ? (
                    <p className="text-xs" style={{color:'#0F6E56'}}>📍 GPS active</p>
                  ) : (
                    <p className="text-xs" style={{color:'var(--tn-gold)'}}>No GPS yet</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Off duty */}
          <div className="card p-3">
            <p className="text-xs font-medium mb-2" style={{color:'rgba(26,18,8,0.4)'}}>⚫ Off duty ({offDutyDrivers.length})</p>
            {offDutyDrivers.length === 0 ? (
              <p className="text-xs" style={{color:'var(--tn-gold)'}}>All drivers on duty</p>
            ) : offDutyDrivers.map(driver => (
              <div key={driver.id} className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{background: 'rgba(26,18,8,0.2)'}}>
                  {driver.initials || driver.name?.substring(0,2).toUpperCase()}
                </div>
                <p className="text-xs truncate" style={{color:'rgba(26,18,8,0.4)'}}>{driver.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{flex:1, minHeight:'400px'}} />
    </div>
  );
}
