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
  const { orders, fetchOrders } = useApp();
  const [tab, setTab] = useState('All');
  const [selected, setSelected] = useState(null);

  const TABS = [
    { label:`All (${orders.length})`, val:'All' },
    { label:`Active (${orders.filter(o=>['waiting','picked','enroute'].includes(o.status)).length})`, val:'Active' },
    { label:`Delivered (${orders.filter(o=>o.status==='delivered').length})`, val:'Delivered' },
  ];

  const filtered = orders.filter(o => {
    if (tab==='Active')    return ['waiting','picked','enroute'].includes(o.status);
    if (tab==='Delivered') return o.status==='delivered';
    return true;
  });

  const clientName = (order) => order.clientName || CLIENTS[order.client]?.name || order.client || '—';
  const driverName = (order) => order.driverName || (order.driver === 'peter' ? 'Peter' : order.driver === 'marc' ? 'Marc D.' : order.driver || '—');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Local orders</h1>
          <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>{orders.length} orders today</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchOrders} className="btn btn-outline btn-sm">↻ Refresh</button>
          <span className="badge badge-info">{orders.filter(o=>['picked','enroute'].includes(o.status)).length} active</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
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
              return (
                <tr key={order.id}
                  onClick={() => setSelected(order)}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  style={{borderBottom:'0.5px solid var(--tn-border)', background:i%2===0?'white':'var(--tn-cream)'}}>
                  <td className="px-4 py-3 font-mono text-xs" style={{color:'var(--tn-red)'}}>{order.id}</td>
                  <td className="px-4 py-3 text-sm font-medium">{clientName(order)}</td>
                  <td className="px-4 py-3 text-sm max-w-xs truncate" style={{color:'var(--tn-gold)'}}>{order.address}</td>
                  <td className="px-4 py-3 text-sm">{driverName(order)}</td>
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
          <div className="rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" style={{background:'var(--tn-cream)'}} onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{background:'var(--tn-dark)'}}>
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
              {/* Client + Driver */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                  <p className="text-xs mb-1" style={{color:'var(--tn-gold)'}}>Client</p>
                  <p className="font-semibold text-sm">{clientName(selected)}</p>
                  {selected.clientAddress && <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>{selected.clientAddress}</p>}
                </div>
                <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                  <p className="text-xs mb-1" style={{color:'var(--tn-gold)'}}>Driver</p>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{background: selected.driverColor || 'var(--tn-red)'}}>
                      {selected.driverInitials || '?'}
                    </div>
                    <p className="font-semibold text-sm">{driverName(selected)}</p>
                  </div>
                </div>
              </div>

              {/* Delivery address */}
              <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs mb-1" style={{color:'var(--tn-gold)'}}>Delivery address</p>
                <p className="font-medium text-sm">{selected.address}</p>
              </div>

              {/* Order info */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                  <p className="text-xs mb-1" style={{color:'var(--tn-gold)'}}>Boxes</p>
                  <p className="font-semibold text-sm">{selected.boxes}</p>
                </div>
                <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                  <p className="text-xs mb-1" style={{color:'var(--tn-gold)'}}>Amount</p>
                  <p className="font-semibold text-sm">${parseFloat(selected.amount||0).toFixed(2)}</p>
                </div>
                <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                  <p className="text-xs mb-1" style={{color:'var(--tn-gold)'}}>Date</p>
                  <p className="font-semibold text-sm">{selected.date}</p>
                </div>
              </div>

              {/* Status timeline */}
              <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs font-medium mb-3" style={{color:'var(--tn-gold)'}}>Delivery timeline</p>
                <div className="space-y-2">
                  {STATUS_STEPS.map((step, i) => {
                    const rank = STATUS_STEPS.indexOf(selected.status);
                    const done = i <= rank;
                    const times = {
                      waiting: selected.date,
                      picked: selected.pickedUpAt,
                      enroute: selected.onWayAt,
                      delivered: selected.deliveredAt,
                    };
                    return (
                      <div key={step} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                          style={{background: done ? 'var(--tn-red)' : 'rgba(139,105,20,0.15)', color: done ? 'white' : 'var(--tn-gold)'}}>
                          {done ? '✓' : i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium" style={{color: done ? 'var(--tn-dark)' : 'rgba(26,18,8,0.35)'}}>{STATUS_LABELS[step]}</p>
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
                      <p className="text-xs" style={{color:'#0F6E56'}}>{selected.photoUrl ? 'Captured' : 'Pending'}</p>
                    </div>
                  </div>
                  <div className="rounded-xl p-3 flex items-center gap-2" style={{background:'#E8F5EF'}}>
                    <span className="text-lg">✍️</span>
                    <div>
                      <p className="text-xs font-medium" style={{color:'#0F6E56'}}>Signature</p>
                      <p className="text-xs" style={{color:'#0F6E56'}}>{selected.recipientName || (selected.signatureUrl ? 'Captured' : 'Pending')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
