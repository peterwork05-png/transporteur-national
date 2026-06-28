import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { CLIENTS } from '../../data/store';
import { format } from 'date-fns';

const STATUS_BADGE = {
  waiting:   { label: 'Waiting',   cls: 'badge-gray' },
  picked:    { label: 'Picked up', cls: 'badge-warning' },
  enroute:   { label: 'En route',  cls: 'badge-info' },
  delivered: { label: 'Delivered', cls: 'badge-success' },
};

export default function AdminToday() {
  const { orders, ontarioRoute, quebecRoute, invoices } = useApp();
  const navigate = useNavigate();
  const today = format(new Date(), 'EEEE, MMMM d, yyyy');

  const todayOrders = orders.filter(o => o.date === '2026-06-26');
  const delivered = todayOrders.filter(o => o.status === 'delivered').length;
  const active = todayOrders.filter(o => ['picked','enroute'].includes(o.status)).length;
  const pendingInvoices = invoices.filter(i => i.status === 'pending');
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const onDone = ontarioRoute.stopStatus.filter(s => s === 'delivered').length;
  const qcDone = quebecRoute.stopStatus.filter(s => s === 'delivered').length;

  const kpis = [
    { label: 'Local orders today', value: todayOrders.length, sub: `${delivered} delivered · ${active} active`, color: 'var(--tn-red)', onClick: () => navigate('/admin/orders') },
    { label: 'Contract routes', value: '2', sub: 'Ontario · Québec', color: 'var(--tn-gold)', onClick: () => navigate('/admin/routes') },
    { label: 'Pending invoices', value: pendingInvoices.length, sub: `$${pendingInvoices.reduce((s,i) => s+i.amount,0).toFixed(2)}`, color: '#185FA5', onClick: () => navigate('/admin/invoices') },
    { label: 'Overdue', value: overdueInvoices.length, sub: overdueInvoices.length > 0 ? 'Follow up needed' : 'All clear ✓', color: overdueInvoices.length > 0 ? '#991B1B' : '#0F6E56', onClick: () => navigate('/admin/payments') },
  ];

  const recentActivity = [
    { icon: '✅', text: 'Delivery confirmed — A&E Bath and Shower', sub: 'Marc D. · Photo + signature · 09:10 AM', color: '#0F6E56' },
    { icon: '🚚', text: 'Ontario route — Staples Kanata checked in', sub: 'Jean-Luc B. · Stop 10/15 · 11:38 AM', color: '#185FA5' },
    { icon: '⏭️', text: 'Québec route — Staples #207 skipped', sub: 'Pierre T. · 10:55 AM', color: '#991B1B' },
    { icon: '💳', text: 'EFT #5044508 received — $7,674.53', sub: 'Bureau en Gros · Inv. #580 + #581 · Auto-matched', color: 'var(--tn-gold)' },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color:'var(--tn-dark)' }}>Today's overview</h1>
          <p className="text-sm mt-0.5" style={{ color:'var(--tn-gold)' }}>{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge badge-live">● Live</span>
          <div className="flex -space-x-2">
            {[['MD','var(--tn-red)'],['PE','#7C3AED'],['JL','#8B4513'],['PT','#0F6E56']].map(([i,bg],idx) => (
              <div key={idx} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-white text-xs font-bold" style={{ borderColor:'var(--tn-cream)', background:bg }}>
                {i}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {kpis.map((kpi, i) => (
          <button key={i} onClick={kpi.onClick} className="card p-4 text-left hover:shadow-md transition-shadow">
            <div className="text-2xl font-semibold mb-1" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="text-xs mb-1" style={{ color:'var(--tn-gold)' }}>{kpi.label}</div>
            <div className="text-xs" style={{ color: kpi.color, opacity:0.75 }}>{kpi.sub}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Active orders */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title" style={{marginBottom:0}}>Active deliveries</h2>
            <span className="badge badge-info">{active} active</span>
          </div>
          <div className="space-y-2 mt-3">
            {todayOrders.filter(o => o.status !== 'delivered').map(order => {
              const b = STATUS_BADGE[order.status] || STATUS_BADGE.waiting;
              return (
                <div key={order.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ background:'var(--tn-warm)' }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: order.status === 'enroute' ? 'var(--tn-red)' : 'var(--tn-gold)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{CLIENTS[order.client]?.name}</p>
                    <p className="text-xs truncate" style={{ color:'var(--tn-gold)' }}>{order.driver === 'peter' ? 'Peter' : 'Marc D.'} · {order.boxes} boxes</p>
                  </div>
                  <span className={`badge ${b.cls} flex-shrink-0`}>{b.label}</span>
                </div>
              );
            })}
            <p className="text-xs pt-1" style={{ color:'var(--tn-gold)', borderTop:'0.5px solid var(--tn-border)' }}>{delivered} delivered today ✓</p>
          </div>
        </div>

        {/* Contract routes */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title" style={{marginBottom:0}}>Contract routes</h2>
            <span className="badge badge-success">Both active</span>
          </div>
          <div className="space-y-4 mt-3">
            {[
              { label:'Ontario / Gatineau', done:onDone, total:15, driver:'Jean-Luc B.', fillCls:'progress-fill-red', started:ontarioRoute.started },
              { label:'Québec route',       done:qcDone, total:10, driver:'Pierre T.',   fillCls:'progress-fill-gold', started:quebecRoute.started },
            ].map((route, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{route.label}</p>
                  <span className="badge badge-info text-xs">{route.done} / {route.total}</span>
                </div>
                <p className="text-xs mb-2" style={{ color:'var(--tn-gold)' }}>{route.driver} · {route.started ? 'In progress' : 'Not started'}</p>
                <div className="progress-bar">
                  <div className={route.fillCls} style={{ width:`${(route.done/route.total)*100}%` }} />
                </div>
              </div>
            ))}
            <p className="text-xs pt-1" style={{ color:'var(--tn-gold)', borderTop:'0.5px solid var(--tn-border)' }}>Auto-invoice generates Sunday</p>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card p-4">
        <h2 className="section-title">Recent activity</h2>
        <div className="space-y-3">
          {recentActivity.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-base flex-shrink-0">{item.icon}</span>
              <div>
                <p className="text-sm">{item.text}</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--tn-gold)' }}>{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
