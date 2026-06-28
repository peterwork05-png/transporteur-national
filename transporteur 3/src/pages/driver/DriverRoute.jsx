import { useApp } from '../../context/AppContext';
import { ONTARIO_STOPS, QUEBEC_STOPS, CONTRACT_RATES } from '../../data/store';
import { format } from 'date-fns';
import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function DriverRoute() {
  const { route } = useParams();
  const { ontarioRoute, quebecRoute, setOntarioRoute, setQuebecRoute } = useApp();
  const [clock, setClock] = useState(new Date());
  const [tab, setTab] = useState('stops');

  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(t); }, []);

  const isOntario = route === 'ontario';
  const routeState = isOntario ? ontarioRoute : quebecRoute;
  const setRoute = isOntario ? setOntarioRoute : setQuebecRoute;
  const rawStops = isOntario ? ONTARIO_STOPS : QUEBEC_STOPS;
  const stops = rawStops.map(s => typeof s === 'string' ? { name: s, addr: '' } : { name: s.name, addr: s.addr });
  const driverName = isOntario ? 'Jean-Luc Bergeron' : 'Pierre Tremblay';
  const driverInitials = isOntario ? 'JL' : 'PT';
  const driverColor = isOntario ? '#8B4513' : '#0F6E56';
  const routeTitle = isOntario ? 'Ontario / Gatineau' : 'Québec';

  const nowStr = () => clock.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true });
  const currentIdx = routeState.stopStatus.findIndex(s => s === null);
  const delivered = routeState.stopStatus.filter(s => s === 'delivered').length;
  const skipped = routeState.stopStatus.filter(s => s === 'skipped').length;
  const processed = delivered + skipped;

  const startRoute = () => { if (routeState.holiday) return; setRoute(r => ({ ...r, started: true, startTime: nowStr() })); };
  const markArrived = () => {
    if (currentIdx < 0 || currentIdx >= stops.length) return;
    const newStatus = [...routeState.stopStatus]; const newArrivals = [...routeState.arrivals];
    newStatus[currentIdx] = 'delivered'; newArrivals[currentIdx] = nowStr();
    setRoute(r => ({ ...r, stopStatus: newStatus, arrivals: newArrivals, done: newStatus.every(s => s !== null) }));
  };
  const skipStop = () => {
    if (currentIdx < 0 || currentIdx >= stops.length) return;
    const newStatus = [...routeState.stopStatus]; newStatus[currentIdx] = 'skipped';
    setRoute(r => ({ ...r, stopStatus: newStatus, done: newStatus.every(s => s !== null) }));
  };
  const markHoliday = () => { if (routeState.started) return; setRoute(r => ({ ...r, holiday: true })); };

  return (
    <div className="min-h-screen" style={{ background:'var(--tn-cream)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3" style={{ background:'var(--tn-dark)', borderBottom:'0.5px solid rgba(139,105,20,0.2)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: driverColor }}>
              {driverInitials}
            </div>
            <div>
              <p className="text-xs" style={{ color:'rgba(250,247,240,0.4)' }}>{driverName} · {routeTitle} route</p>
              <p className="text-sm font-medium" style={{ color:'var(--tn-cream)' }}>{format(clock, 'EEEE, MMMM d yyyy')}</p>
            </div>
          </div>
          <p className="text-base font-bold tabular-nums" style={{ color:'var(--tn-gold)' }}>{format(clock, 'hh:mm:ss a')}</p>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs" style={{color:'var(--tn-gold)'}}>My stops today</p>
            <p className="text-lg font-semibold">{routeTitle} route</p>
          </div>
          <span className={`badge ${routeState.done?'badge-success':routeState.started?'badge-info':routeState.holiday?'badge-warning':'badge-gray'}`}>
            {routeState.done?'Complete':routeState.holiday?'Holiday':routeState.started?`${stops.length} stops`:'Not started'}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            {label:'Delivered', val:`${delivered}/${stops.length}`, color:'var(--tn-red)'},
            {label:'Skipped',   val:skipped,                        color:'#991B1B'},
            {label:'Started',   val:routeState.startTime||'—',      color:'var(--tn-gold)'},
          ].map((s,i) => (
            <div key={i} className="card p-3 text-center">
              <div className="text-lg font-semibold" style={{color:s.color}}>{s.val}</div>
              <div className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="progress-bar mb-4">
          <div className={isOntario?'progress-fill-red':'progress-fill-gold'} style={{width:`${stops.length?(processed/stops.length)*100:0}%`}} />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {[['stops','Stops'],['summary','Summary']].map(([val,label]) => (
            <button key={val} onClick={() => setTab(val)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium"
              style={{background:tab===val?'var(--tn-red)':'white',color:tab===val?'white':'var(--tn-gold)',border:'0.5px solid var(--tn-border)'}}>
              {label}
            </button>
          ))}
        </div>

        {tab==='stops' && (
          <>
            {!routeState.started && !routeState.holiday && (
              <button onClick={startRoute} className="btn w-full justify-center py-3 mb-3" style={{background:'var(--tn-red)',color:'white'}}>
                ▶ Start today's route
              </button>
            )}
            {routeState.holiday && (
              <div className="rounded-xl px-4 py-3 text-sm text-center font-medium mb-3" style={{background:'#FEF3C7',color:'#92400E'}}>
                🎌 Holiday — not billed today
              </div>
            )}
            {routeState.started && !routeState.done && currentIdx>=0 && (
              <div className="rounded-xl p-3 mb-3 flex items-center gap-2" style={{background:'rgba(24,95,165,0.08)',border:'0.5px solid rgba(24,95,165,0.2)'}}>
                <span className="text-lg">🚚</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{stops[currentIdx]?.name}</p>
                  {stops[currentIdx]?.addr && <p className="text-xs truncate" style={{color:'var(--tn-gold)'}}>{stops[currentIdx].addr}</p>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={skipStop} className="btn btn-outline btn-sm text-xs">⏭ Skip</button>
                  <button onClick={markArrived} className="btn btn-success btn-sm text-xs">✓ Arrived</button>
                </div>
              </div>
            )}
            {routeState.done && (
              <div className="rounded-xl px-4 py-3 text-sm text-center font-medium mb-3" style={{background:'#E8F5EF',color:'#0F6E56'}}>
                ✅ Route complete! {delivered} delivered{skipped>0?`, ${skipped} skipped`:''}
              </div>
            )}

            <div className="card overflow-hidden">
              {stops.map((stop,i) => {
                const status = routeState.stopStatus[i];
                const isActive = routeState.started && i===currentIdx && !routeState.done;
                const arrival = routeState.arrivals[i];
                return (
                  <div key={i} className="flex items-start gap-3 p-3" style={{borderBottom:'0.5px solid var(--tn-border)',background:isActive?'rgba(24,95,165,0.04)':'transparent'}}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                      style={{background:status==='delivered'?'#E8F5EF':status==='skipped'?'#FEE2E2':isActive?'rgba(24,95,165,0.12)':'var(--tn-warm)',
                              color:status==='delivered'?'#0F6E56':status==='skipped'?'#991B1B':isActive?'#185FA5':'var(--tn-gold)'}}>
                      {status==='delivered'?'✓':status==='skipped'?'✕':isActive?'→':i+1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{textDecoration:status==='skipped'?'line-through':'none',color:status?'rgba(26,18,8,0.4)':'var(--tn-dark)'}}>{stop.name}</p>
                      {stop.addr && <p className="text-xs truncate" style={{color:'var(--tn-gold)'}}>{stop.addr}</p>}
                      {arrival && <p className="text-xs mt-0.5" style={{color:'#0F6E56'}}>🕐 Arrived {arrival}</p>}
                      {status==='skipped' && <p className="text-xs mt-0.5" style={{color:'#991B1B'}}>⏭ Skipped today</p>}
                    </div>
                    {status && (
                      <span className={`badge flex-shrink-0 text-xs ${status==='delivered'?'badge-success':status==='skipped'?'badge-danger':'badge-info'}`}>
                        {status==='delivered'?'Done':status==='skipped'?'Skipped':'Active'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {!routeState.started && !routeState.holiday && (
              <button onClick={markHoliday} className="btn btn-outline w-full justify-center mt-3 text-sm">
                🎌 Mark today as holiday / day off
              </button>
            )}
          </>
        )}

        {tab==='summary' && (
          <div className="card p-4">
            <h2 className="section-title">Today's summary</h2>
            <div className="grid grid-cols-2 gap-3">
              {[{label:'Total stops',val:stops.length},{label:'Delivered',val:delivered},{label:'Skipped',val:skipped},{label:'Route started',val:routeState.startTime||'—'}].map((s,i) => (
                <div key={i} className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                  <p className="text-xs" style={{color:'var(--tn-gold)'}}>{s.label}</p>
                  <p className="font-semibold text-sm mt-0.5">{s.val}</p>
                </div>
              ))}
            </div>
            <p className="text-xs mt-3 text-center" style={{color:'var(--tn-gold)',borderTop:'0.5px solid var(--tn-border)',paddingTop:'12px'}}>Invoice auto-generates Sunday based on days completed</p>
          </div>
        )}
      </div>
    </div>
  );
}
