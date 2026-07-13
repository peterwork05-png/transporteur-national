import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CLIENTS } from '../../data/store';

const STATUS_BADGE = {
  waiting:   { label:'Waiting',   cls:'badge-gray' },
  picked:    { label:'Picked up', cls:'badge-warning' },
  enroute:   { label:'En route',  cls:'badge-info' },
  delivered: { label:'Delivered', cls:'badge-success' },
};

const STATUS_STEPS = ['waiting', 'picked', 'enroute', 'delivered'];
const STATUS_LABELS = { waiting:'Order placed', picked:'Picked up', enroute:'En route', delivered:'Delivered' };

export default function AdminOrders() {
  const { orders, drivers, fetchOrders, updateOrderStatus } = useApp();
  const [tab, setTab] = useState('All');
  const [selected, setSelected] = useState(null);
  const [assigning, setAssigning] = useState(false);

  const TABS = [
    { label:`All (${orders.length})`, val:'All' },
    { label:`Unassigned (${orders.filter(o=>!o.driver&&!o.driver_id).length})`, val:'Unassigned' },
    { label:`Active (${orders.filter(o=>['waiting','picked','enroute'].includes(o.status)).length})`, val:'Active' },
    { label:`Delivered (${orders.filter(o=>o.status==='delivered').length})`, val:'Delivered' },
  ];

  const filtered = orders.filter(o => {
    if (tab==='Unassigned') return !o.driver && !o.driver_id;
    if (tab==='Active')     return ['waiting','picked','enroute'].includes(o.status);
    if (tab==='Delivered')  return o.status === 'delivered';
    return true;
  });

  const clientName = (o) => o.clientName || o.client_name || o.to_business_name || o.billing_name || CLIENTS[o.client]?.name || o.client || '—';
  const driverName = (o) => o.driverName || (o.driver==='peter'?'Peter':o.driver==='marc'?'Marc D.':o.driver||'—');

  const assignDriver = async (orderId, driverId) => {
    setAssigning(true);
    try {
      await fetch(`/api/orders/${orderId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId }),
      });
      await fetchOrders();
      // Find the full driver object
      const fullDriver = drivers.find(d => d.id === driverId);
      setSelected(prev => prev ? {
        ...prev,
        driver_id: driverId,
        driver: driverId,
        driverName: fullDriver?.name || driverId,
        driverInitials: fullDriver?.initials || driverId?.substring(0,2).toUpperCase(),
        driverColor: fullDriver?.color || 'var(--tn-red)',
      } : null);
    } catch (err) {
      console.error('Failed to assign driver:', err);
    }
    setAssigning(false);
  };

  const localDrivers = drivers.filter(d => d.role === 'local');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Local orders</h1>
          <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>{orders.length} orders today</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchOrders} className="btn btn-outline btn-sm">↻ Refresh</button>
          <span className="badge badge-info">{orders.filter(o=>['waiting','picked','enroute'].includes(o.status)&&(o.driver||o.driver_id)).length} active</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map(t => (
          <button key={t.val} onClick={() => setTab(t.val)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{background:tab===t.val?'var(--tn-red)':'white', color:tab===t.val?'white':'var(--tn-gold)', border:'0.5px solid var(--tn-border)'}}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{borderBottom:'0.5px solid var(--tn-border)'}}>
              {['Order ID','Client','Address','Driver','Boxes','Amount','Status'].map(h => (
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
                    {hasDriver ? driverName(order) : (
                      <span className="badge badge-danger">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{order.boxes}</td>
                  <td className="px-4 py-3 text-sm font-semibold">${parseFloat(order.amount||0).toFixed(2)}</td>
                  <td className="px-4 py-3"><span className={`badge ${b.cls}`}>{b.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm" style={{color:'var(--tn-gold)'}}>No orders found</div>
        )}
      </div>

      {/* Order detail modal */}
      {selected && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.6)'}} onClick={() => setSelected(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" style={{background:'var(--tn-cream)'}} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between sticky top-0" style={{background:'var(--tn-dark)'}}>
              <div>
                <p className="font-mono text-xs" style={{color:'rgba(250,247,240,0.4)'}}>{selected.id}</p>
                <p className="font-semibold" style={{color:'var(--tn-cream)'}}>Order details</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${STATUS_BADGE[selected.status]?.cls || 'badge-gray'}`}>
                  {STATUS_BADGE[selected.status]?.label || selected.status}
                </span>
                <button onClick={() => setSelected(null)} className="text-xl leading-none" style={{color:'rgba(250,247,240,0.4)'}}>×</button>
              </div>
            </div>

            <div className="p-6 space-y-4">

              {/* Assign driver */}
              <div className="rounded-xl p-4" style={{background: selected.driver||selected.driver_id ? '#E8F5EF' : '#FEF3C7', border:`0.5px solid ${selected.driver||selected.driver_id ? '#0F6E56' : '#D97706'}`}}>
                <p className="text-xs font-medium mb-2" style={{color: selected.driver||selected.driver_id ? '#0F6E56' : '#92400E'}}>
                  {selected.driver||selected.driver_id ? '✅ Assigned driver' : '⚠️ No driver assigned'}
                </p>
                {selected.driver||selected.driver_id ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{background: selected.driverColor || 'var(--tn-red)'}}>
                        {selected.driverInitials || '?'}
                      </div>
                      <p className="font-semibold text-sm">{driverName(selected)}</p>
                    </div>
                    <button onClick={() => assignDriver(selected.id, null)} className="btn btn-outline btn-sm text-xs">Change driver</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {localDrivers.map(driver => (
                      <button key={driver.id} onClick={() => assignDriver(selected.id, driver.id)} disabled={assigning}
                        className="flex items-center gap-2 p-2.5 rounded-xl text-left transition-all"
                        style={{background:'white', border:'0.5px solid var(--tn-border)'}}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background: driver.color}}>
                          {driver.initials}
                        </div>
                        <p className="text-sm font-medium">{driver.name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* FROM — Pickup info */}
              <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{color:'var(--tn-red)'}}>📦 From — Pickup</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label:'Associate name',  val: selected.billing_name || selected.from_associate_name },
                    { label:'Associate phone', val: selected.billing_phone, phone: true },
                    { label:'Pickup date',     val: selected.from_pickup_date || selected.pickup_date },
                    { label:'Store / Client',  val: selected.store_number },
                    { label:'Email',           val: selected.billing_email },
                  ].filter(i => i.val).map((item, i) => (
                    <div key={i}>
                      <p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.label}</p>
                      {item.phone
                        ? <a href={`tel:${item.val}`} className="font-medium text-sm mt-0.5 block" style={{color:'var(--tn-red)'}}>📞 {item.val}</a>
                        : <p className="font-medium text-sm mt-0.5">{item.val}</p>
                      }
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

              {/* TO — Delivery info */}
              <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{color:'var(--tn-red)'}}>🚚 To — Delivery</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label:'Associate name',   val: selected.to_associate_name },
                    { label:'Business name',    val: selected.to_business_name },
                    { label:'Business phone',   val: selected.to_business_phone, phone: true },
                    { label:'Dropoff date',     val: selected.to_dropoff_date },
                    { label:'Deliver by time',  val: selected.requested_delivery_time },
                  ].filter(i => i.val).map((item, i) => (
                    <div key={i}>
                      <p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.label}</p>
                      {item.phone
                        ? <a href={`tel:${item.val}`} className="font-medium text-sm mt-0.5 block" style={{color:'var(--tn-red)'}}>📞 {item.val}</a>
                        : <p className="font-medium text-sm mt-0.5">{item.val}</p>
                      }
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
                    { label:'Date',         val: selected.date },
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
                  <p className="text-sm" style={{color:'#92400E'}}>{selected.notes}</p>
                </div>
              )}

              {/* Delivery timeline */}
              <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs font-medium mb-3" style={{color:'var(--tn-gold)'}}>Delivery timeline</p>
                <div className="space-y-2">
                  {STATUS_STEPS.map((step, i) => {
                    const rank = STATUS_STEPS.indexOf(selected.status);
                    const done = i <= rank;
                    const times = {
                      waiting:   selected.date,
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

              {/* Proof of delivery */}
              {selected.status === 'delivered' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-3 flex items-center gap-2" style={{background:'#E8F5EF'}}>
                    <span className="text-lg">📷</span>
                    <div>
                      <p className="text-xs font-medium" style={{color:'#0F6E56'}}>Delivery photo</p>
                      <p className="text-xs" style={{color:'#0F6E56'}}>{selected.photo_url?'View':'Pending'}</p>
                    </div>
                  </div>
                  <div className="rounded-xl p-3 flex items-center gap-2" style={{background:'#E8F5EF'}}>
                    <span className="text-lg">✍️</span>
                    <div>
                      <p className="text-xs font-medium" style={{color:'#0F6E56'}}>Signature</p>
                      <p className="text-xs" style={{color:'#0F6E56'}}>{selected.recipient_name||'Pending'}</p>
                    </div>
                  </div>
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
