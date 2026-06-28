import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CLIENTS } from '../../data/store';

const STATUS_BADGE = {
  waiting:   { label:'Waiting',   cls:'badge-gray' },
  picked:    { label:'Picked up', cls:'badge-warning' },
  enroute:   { label:'En route',  cls:'badge-info' },
  delivered: { label:'Delivered', cls:'badge-success' },
};

export default function AdminOrders() {
  const { orders } = useApp();
  const [tab, setTab] = useState('All');
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Local orders</h1>
          <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>{orders.length} orders today</p>
        </div>
        <span className="badge badge-info">{orders.filter(o=>['picked','enroute'].includes(o.status)).length} active</span>
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
                <th key={h} className="text-left text-xs font-medium px-4 py-3" style={{color:'var(--tn-gold)'}}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((order, i) => {
              const b = STATUS_BADGE[order.status] || STATUS_BADGE.waiting;
              return (
                <tr key={order.id} style={{borderBottom:'0.5px solid var(--tn-border)', background: i%2===0?'white':'var(--tn-cream)'}}>
                  <td className="px-4 py-3 font-mono text-xs" style={{color:'var(--tn-gold)'}}>{order.id}</td>
                  <td className="px-4 py-3 text-sm font-medium">{CLIENTS[order.client]?.name}</td>
                  <td className="px-4 py-3 text-sm max-w-xs truncate" style={{color:'var(--tn-gold)'}}>{order.address}</td>
                  <td className="px-4 py-3 text-sm">{order.driver === 'peter' ? 'Peter' : 'Marc D.'}</td>
                  <td className="px-4 py-3 text-sm">{order.boxes}</td>
                  <td className="px-4 py-3 text-sm font-semibold">${order.amount.toFixed(2)}</td>
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
    </div>
  );
}
