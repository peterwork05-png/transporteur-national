import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CLIENTS } from '../../data/store';

const STATUS_BADGE = {
  waiting:   { label:'Waiting',   cls:'badge-gray' },
  picked:    { label:'Picked up', cls:'badge-warning' },
  enroute:   { label:'En route',  cls:'badge-info' },
  delivered: { label:'Delivered', cls:'badge-success' },
};

const STATUS_STEPS  = ['waiting','picked','enroute','delivered'];
const STATUS_LABELS = { waiting:'Order placed', picked:'Picked up', enroute:'En route', delivered:'Delivered' };

export default function AdminOrders() {
  const { orders, drivers, fetchOrders, updateOrderStatus } = useApp();
  const [tab,       setTab]       = useState('All');
  const [period,    setPeriod]    = useState('today');   // 'today' | '7days'
  const [selected,  setSelected]  = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [allOrders, setAllOrders] = useState([]);
  const [loading7,  setLoading7]  = useState(false);

  // When switching to 7-day view, fetch all orders without date filter
  useEffect(() => {
    if (period === '7days') {
      setLoading7(true);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      fetch('/api/orders?days=7')
        .then(r => r.json())
        .then(data => {
          setAllOrders(data.map(o => ({
            ...o,
            client: o.client_id,
            driver: o.driver_id,
            clientName: o.client_name || o.to_business_name || o.billing_name || o.client_id,
            driverName: o.driver_name,
            driverInitials: o.driver_initials,
            driverColor: o.driver_color,
            pickedUpAt: o.picked_up_at,
            onWayAt: o.on_way_at,
            deliveredAt: o.delivered_at,
            amount: parseFloat(o.amount || 0),
          })));
        })
        .catch(console.error)
        .finally(() => setLoading7(false));
    }
  }, [period]);

  const displayOrders = period === 'today' ? orders : allOrders;

  const filtered = displayOrders.filter(o => {
    if (tab === 'Unassigned') return !o.driver && !o.driver_id;
    if (tab === 'Active')     return ['waiting','picked','enroute'].includes(o.status);
    if (tab === 'Delivered')  return o.status === 'delivered';
    return true;
  });

  const TABS = [
    { label:`All (${displayOrders.length})`,                                                              val:'All' },
    { label:`Unassigned (${displayOrders.filter(o=>!o.driver&&!o.driver_id).length})`,                   val:'Unassigned' },
    { label:`Active (${displayOrders.filter(o=>['waiting','picked','enroute'].includes(o.status)).length})`, val:'Active' },
    { label:`Delivered (${displayOrders.filter(o=>o.status==='delivered').length})`,                      val:'Delivered' },
  ];

  const clientName = (o) => o.clientName || o.client_name || o.to_business_name || o.billing_name || CLIENTS[o.client]?.name || o.client || '—';
  const driverName = (o) => o.driverName || o.driver_name || (o.driver==='peter'?'Peter':o.driver==='marc'?'Marc D.':o.driver||'—');

  const assignDriver = async (orderId, driverId) => {
    setAssigning(true);
    try {
      await fetch(`/api/orders/${orderId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId }),
      });
      if (period === 'today') await fetchOrders();
      else {
        setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, driver_id: driverId, driver: driverId } : o));
      }
      const fullDriver = drivers.find(d => d.id === driverId);
      setSelected(prev => prev ? {
        ...prev,
        driver_id: driverId,
        driver: driverId,
        driverName: fullDriver?.name || driverId,
        driverInitials: fullDriver?.initials || driverId?.substring(0,2).toUpperCase(),
        driverColor: fullDriver?.color || 'var(--tn-red)',
      } : null);
    } catch (err) { console.error(err); }
    setAssigning(false);
  };

  const localDrivers = drivers.filter(d => d.role === 'local');

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Local orders</h1>
          <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>
            {displayOrders.length} orders {period === 'today' ? 'today' : 'in last 7 days'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { period==='today' ? fetchOrders() : null; }} className="btn btn-outline btn-sm">↻</button>
          <span className="badge badge-info">
            {displayOrders.filter(o=>['waiting','picked','enroute'].includes(o.status)&&(o.driver||o.driver_id)).length} active
          </span>
        </div>
      </div>

      {/* Period toggle */}
      <div className="flex gap-2 mb-4 p-1 rounded-xl" style={{background:'var(--tn-warm)', width:'fit-content'}}>
        {[['today','📅 Today'],['7days','📆 Last 7 days']].map(([val,label])=>(
          <button key={val} onClick={()=>{ setPeriod(val); setTab('All'); }}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: period===val ? 'white' : 'transparent',
              color: period===val ? 'var(--tn-dark)' : 'var(--tn-gold)',
              boxShadow: period===val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map(t => (
          <button key={t.val} onClick={() => setTab(t.val)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{background:tab===t.val?'var(--tn-red)':'white', color:tab===t.val?'white':'var(--tn-gold)', border:'0.5px solid var(--tn-border)'}}>
            {t.label}
          </button>
        ))}
      </div>

      {loading7 && (
        <div className="text-center py-8" style={{color:'var(--tn-gold)'}}>Loading orders...</div>
      )}

      {/* Desktop table */}
      {!loading7 && (
        <>
          <div className="card overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr style={{borderBottom:'0.5px solid var(--tn-border)'}}>
                  {['Order ID','Client','Address','Driver','Boxes','Amount','Status','Date'].map(h => (
                    <th key={h} className="text-left text-xs font-medium px-4 py-3" style={{color:'var(--tn-gold)'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((order, i) => {
                  const b = STATUS_BADGE[order.status] || STATUS_BADGE.waiting;
                  const hasDriver = order.driver || order.driver_id;
                  return (
                    <tr key={order.id}
                      onClick={() => setSelected(order)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      style={{borderBottom:'0.5px solid var(--tn-border)', background:i%2===0?'white':'var(--tn-cream)'}}>
                      <td className="px-4 py-3 font-mono text-xs" style={{color:'var(--tn-red)'}}>{order.id}</td>
                      <td className="px-4 py-3 text-sm font-medium">{clientName(order)}</td>
                      <td className="px-4 py-3 text-sm max-w-xs truncate" style={{color:'var(--tn-gold)'}}>{order.address}</td>
                      <td className="px-4 py-3 text-sm">
                        {hasDriver ? driverName(order) : <span className="badge badge-danger">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">{order.boxes}</td>
                      <td className="px-4 py-3 text-sm font-semibold">${parseFloat(order.amount||0).toFixed(2)}</td>
                      <td className="px-4 py-3"><span className={`badge ${b.cls}`}>{b.label}</span></td>
                      <td className="px-4 py-3 text-xs" style={{color:'var(--tn-gold)'}}>{String(order.date||'').split('T')[0]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-sm" style={{color:'var(--tn-gold)'}}>No orders found</div>
            )}
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {filtered.length === 0 && (
              <div className="card p-8 text-center text-sm" style={{color:'var(--tn-gold)'}}>No orders found</div>
            )}
            {filtered.map(order => {
              const b = STATUS_BADGE[order.status] || STATUS_BADGE.waiting;
              const hasDriver = order.driver || order.driver_id;
              return (
                <div key={order.id} className="card p-4 cursor-pointer" onClick={() => setSelected(order)}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{clientName(order)}</p>
                      <p className="font-mono text-xs mt-0.5" style={{color:'var(--tn-red)'}}>{order.id}</p>
                      <p className="text-xs mt-0.5 truncate" style={{color:'var(--tn-gold)'}}>{order.address}</p>
                    </div>
                    <span className={`badge ${b.cls} flex-shrink-0`}>{b.label}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2" style={{borderTop:'0.5px solid var(--tn-border)'}}>
                    <div className="text-xs" style={{color:'var(--tn-gold)'}}>
                      {hasDriver ? driverName(order) : <span className="badge badge-danger">Unassigned</span>}
                    </div>
                    <div className="text-xs" style={{color:'var(--tn-gold)'}}>
                      {period==='7days' && <span className="mr-2">{String(order.date||'').split('T')[0]}</span>}
                      {order.boxes} boxes
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Order detail modal */}
      {selected && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.6)'}} onClick={() => setSelected(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" style={{background:'var(--tn-cream)'}} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between sticky top-0" style={{background:'var(--tn-dark)'}}>
              <div>
                <p className="font-mono text-xs" style={{color:'rgba(250,247,240,0.4)'}}>{selected.id}</p>
                <p className="font-semibold" style={{color:'var(--tn-cream)'}}>Order details</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${STATUS_BADGE[selected.status]?.cls||'badge-gray'}`}>
                  {STATUS_BADGE[selected.status]?.label||selected.status}
                </span>
                <button onClick={() => setSelected(null)} className="text-xl leading-none" style={{color:'rgba(250,247,240,0.4)'}}>×</button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Assign driver */}
              <div className="rounded-xl p-4" style={{background:selected.driver||selected.driver_id?'#E8F5EF':'#FEF3C7', border:`0.5px solid ${selected.driver||selected.driver_id?'#0F6E56':'#D97706'}`}}>
                <p className="text-xs font-medium mb-2" style={{color:selected.driver||selected.driver_id?'#0F6E56':'#92400E'}}>
                  {selected.driver||selected.driver_id?'✅ Assigned driver':'⚠️ No driver assigned'}
                </p>
                {selected.driver||selected.driver_id ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{background:selected.driverColor||'var(--tn-red)'}}>
                        {selected.driverInitials||'?'}
                      </div>
                      <p className="font-semibold text-sm">{driverName(selected)}</p>
                    </div>
                    <button onClick={() => assignDriver(selected.id, null)} className="btn btn-outline btn-sm text-xs">Change driver</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {localDrivers.map(driver => (
                      <button key={driver.id} onClick={() => assignDriver(selected.id, driver.id)} disabled={assigning}
                        className="flex items-center gap-2 p-2.5 rounded-xl text-left"
                        style={{background:'white', border:'0.5px solid var(--tn-border)'}}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:driver.color}}>
                          {driver.initials}
                        </div>
                        <p className="text-sm font-medium">{driver.name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* FROM */}
              <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{color:'var(--tn-red)'}}>📦 From — Pickup</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label:'Associate name',  val: selected.from_associate_name || selected.billing_name },
                    { label:'Associate phone', val: selected.billing_phone, phone: true },
                    { label:'Pickup date',     val: selected.from_pickup_date },
                    { label:'Store / Client',  val: selected.store_number },
                    { label:'Email',           val: selected.billing_email },
                  ].filter(i => i.val).map((item, i) => (
                    <div key={i}>
                      <p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.label}</p>
                      {item.phone
                        ? <a href={`tel:${item.val}`} className="font-medium text-sm mt-0.5 block" style={{color:'var(--tn-red)'}}>📞 {item.val}</a>
                        : <p className="font-medium text-sm mt-0.5">{item.val}</p>}
                    </div>
                  ))}
                  {selected.pickup_location && (
                    <div className="col-span-2">
                      <p className="text-xs" style={{color:'var(--tn-gold)'}}>Pickup address</p>
                      <p className="font-medium text-sm mt-0.5">{selected.pickup_location}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* TO */}
              <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{color:'var(--tn-red)'}}>🚚 To — Delivery</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label:'Associate name',  val: selected.to_associate_name },
                    { label:'Business name',   val: selected.to_business_name },
                    { label:'Business phone',  val: selected.to_business_phone, phone: true },
                    { label:'Dropoff date',    val: selected.to_dropoff_date },
                    { label:'Deliver by time', val: selected.requested_delivery_time },
                  ].filter(i => i.val).map((item, i) => (
                    <div key={i}>
                      <p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.label}</p>
                      {item.phone
                        ? <a href={`tel:${item.val}`} className="font-medium text-sm mt-0.5 block" style={{color:'var(--tn-red)'}}>📞 {item.val}</a>
                        : <p className="font-medium text-sm mt-0.5">{item.val}</p>}
                    </div>
                  ))}
                  <div className="col-span-2">
                    <p className="text-xs" style={{color:'var(--tn-gold)'}}>Delivery address</p>
                    <p className="font-medium text-sm mt-0.5">{selected.address}</p>
                  </div>
                </div>
              </div>

              {/* Order details */}
              <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{color:'var(--tn-red)'}}>📋 Order details</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label:'PO Number',    val: selected.po_number },
                    { label:'Store number', val: selected.store_number },
                    { label:'Quantity',     val: selected.boxes },
                    { label:'Box type',     val: selected.type_boite },
                    { label:'Amount',       val: selected.amount ? `$${parseFloat(selected.amount).toFixed(2)}` : null },
                    { label:'Date',         val: selected.date ? String(selected.date).split('T')[0] : null },
                  ].filter(i => i.val).map((item, i) => (
                    <div key={i}>
                      <p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.label}</p>
                      <p className="font-semibold text-sm mt-0.5">{item.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {selected.notes && (
                <div className="rounded-xl p-3" style={{background:'#FEF3C7', border:'0.5px solid #D97706'}}>
                  <p className="text-xs mb-1 font-medium" style={{color:'#92400E'}}>📝 Delivery notes</p>
                  <p className="text-sm" style={{color:'#92400E'}}>
                    {selected.notes.startsWith('Notes:')
                      ? selected.notes.split('|')[0].replace('Notes:','').trim()
                      : selected.notes}
                  </p>
                </div>
              )}

              {/* Timeline */}
              <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs font-medium mb-3" style={{color:'var(--tn-gold)'}}>Delivery timeline</p>
                <div className="space-y-2">
                  {STATUS_STEPS.map((step, i) => {
                    const rank = STATUS_STEPS.indexOf(selected.status);
                    const done = i <= rank;
                    const times = {
                      waiting:   selected.date ? String(selected.date).split('T')[0] : null,
                      picked:    selected.pickedUpAt || selected.picked_up_at,
                      enroute:   selected.onWayAt    || selected.on_way_at,
                      delivered: selected.deliveredAt|| selected.delivered_at,
                    };
                    return (
                      <div key={step} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                          style={{background:done?'var(--tn-red)':'rgba(139,105,20,0.15)', color:done?'white':'var(--tn-gold)'}}>
                          {done?'✓':i+1}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium" style={{color:done?'var(--tn-dark)':'rgba(26,18,8,0.35)'}}>{STATUS_LABELS[step]}</p>
                        </div>
                        {times[step] && <p className="text-xs" style={{color:'var(--tn-gold)'}}>{times[step]}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selected.status==='delivered' && (
                <div className="grid grid-cols-2 gap-3">
                  {[{icon:'📷',label:'Delivery photo',val:selected.photo_url},{icon:'✍️',label:'Signature',val:selected.recipient_name}].map((item,i)=>(
                    <div key={i} className="rounded-xl p-3 flex items-center gap-2" style={{background:'#E8F5EF'}}>
                      <span className="text-lg">{item.icon}</span>
                      <div>
                        <p className="text-xs font-medium" style={{color:'#0F6E56'}}>{item.label}</p>
                        <p className="text-xs" style={{color:'#0F6E56'}}>{item.val||'Captured'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => setSelected(null)} className="btn w-full justify-center" style={{background:'var(--tn-red)',color:'white'}}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
