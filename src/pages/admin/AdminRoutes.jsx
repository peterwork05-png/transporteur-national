import { useApp } from '../../context/AppContext';
import { ONTARIO_STOPS, QUEBEC_STOPS } from '../../data/store';

export default function AdminRoutes() {
  const { ontarioRoute, quebecRoute, drivers } = useApp();

  // Get route drivers dynamically from database
  const ontarioDriver = drivers?.find(d => d.role === 'ontario');
  const quebecDriver  = drivers?.find(d => d.role === 'quebec');

  const RouteView = ({ title, driver, route, stops, accentColor }) => {
    const delivered = route.stopStatus.filter(s => s === 'delivered').length;
    const skipped   = route.stopStatus.filter(s => s === 'skipped').length;
    const pct = Math.round(((delivered + skipped) / stops.length) * 100);
    const currentIdx = route.stopStatus.findIndex(s => s === null);

    const driverName     = driver?.name     || '—';
    const driverInitials = driver?.initials || '?';
    const driverColor    = driver?.color    || '#8B4513';

    return (
      <div className="card p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-sm">{title}</h2>
          <span className={`badge ${route.started ? 'badge-info' : route.holiday ? 'badge-warning' : 'badge-gray'}`}>
            {route.holiday ? 'Holiday' : route.started ? (route.done ? 'Complete' : 'In progress') : 'Not started'}
          </span>
        </div>

        {/* Driver */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{background: driverColor}}>
            {driverInitials}
          </div>
          <p className="text-xs" style={{color:'var(--tn-gold)'}}>
            {driverName}{route.startTime ? ` · Started ${route.startTime}` : ''}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 progress-bar">
            <div className="h-full rounded-full transition-all" style={{width:`${pct}%`, background:accentColor}} />
          </div>
          <span className="text-xs flex-shrink-0" style={{color:'var(--tn-gold)'}}>{delivered} / {stops.length}</span>
        </div>
        <div className="flex gap-2 mb-3">
          <span className="badge badge-success">{delivered} delivered</span>
          {skipped > 0 && <span className="badge badge-danger">{skipped} skipped</span>}
        </div>

        {/* Stop list */}
        <div className="overflow-y-auto" style={{maxHeight:'320px'}}>
          {stops.map((stop, i) => {
            const status   = route.stopStatus[i];
            const name     = typeof stop === 'string' ? stop : stop.name;
            const addr     = typeof stop === 'object' ? stop.addr : null;
            const arrival  = route.arrivals[i];
            const isActive = route.started && i === currentIdx && !route.done;
            return (
              <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs"
                style={{background:isActive?'rgba(24,95,165,0.06)':'transparent', borderBottom:'0.5px solid var(--tn-border)'}}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 font-medium"
                  style={{
                    background: status==='delivered'?'#E8F5EF':status==='skipped'?'#FEE2E2':isActive?'rgba(24,95,165,0.12)':'var(--tn-warm)',
                    color:      status==='delivered'?'#0F6E56':status==='skipped'?'#991B1B':isActive?'#185FA5':'var(--tn-gold)',
                  }}>
                  {status==='delivered'?'✓':status==='skipped'?'✕':isActive?'→':i+1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate"
                    style={{textDecoration:status==='skipped'?'line-through':'none', color:status?'rgba(26,18,8,0.4)':'var(--tn-dark)'}}>
                    {name}
                  </p>
                  {addr && <p className="truncate" style={{color:'var(--tn-gold)'}}>{addr}</p>}
                  {arrival && <p style={{color:'#0F6E56'}}>🕐 {arrival}</p>}
                </div>
                {status && (
                  <span className={`badge flex-shrink-0 ${status==='delivered'?'badge-success':status==='skipped'?'badge-danger':'badge-info'}`}
                    style={{fontSize:'10px'}}>
                    {status==='delivered'?'Done':status==='skipped'?'Skipped':'Active'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Contract routes</h1>
        <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>Live view — Ontario & Québec</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RouteView title="Ontario / Gatineau" driver={ontarioDriver} route={ontarioRoute} stops={ONTARIO_STOPS} accentColor="var(--tn-red)" />
        <RouteView title="Québec route"        driver={quebecDriver}  route={quebecRoute}  stops={QUEBEC_STOPS}  accentColor="var(--tn-gold)" />
      </div>
    </div>
  );
}
