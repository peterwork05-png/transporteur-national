import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { CLIENTS } from '../../data/store';
import { format } from 'date-fns';

const STATUS_BADGE = {
  waiting:   { label:'Waiting',   cls:'badge-gray' },
  picked:    { label:'Picked up', cls:'badge-warning' },
  enroute:   { label:'En route',  cls:'badge-info' },
  delivered: { label:'Delivered', cls:'badge-success' },
};

export default function AdminToday() {
  const { orders, ontarioRoute, quebecRoute, invoices, fetchOrders } = useApp();
  const navigate = useNavigate();
  const [activityDetail, setActivityDetail] = useState(null);
  const today = format(new Date(), 'EEEE, MMMM d, yyyy');

  const todayOrders = orders.filter(o => {
    const orderDate = o.date?.split('T')[0];
    const todayDate = new Date().toISOString().split('T')[0];
    return orderDate === todayDate;
  });

  const delivered = todayOrders.filter(o => o.status === 'delivered').length;
  const active = todayOrders.filter(o => ['picked','enroute'].includes(o.status)).length;
  const pendingInvoices = invoices.filter(i => i.status === 'pending');
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const onDone = ontarioRoute.stopStatus.filter(s => s === 'delivered').length;
  const qcDone = quebecRoute.stopStatus.filter(s => s === 'delivered').length;

  const clientName = (order) => order.clientName || CLIENTS[order.client]?.name || order.client || '—';
  const driverName = (order) => order.driverName || (order.driver === 'peter' ? 'Peter' : order.driver === 'marc' ? 'Marc D.' : order.driver || '—');

  const kpis = [
    { label:'Local orders today', value:todayOrders.length, sub:`${delivered} delivered · ${active} active`, color:'var(--tn-red)', onClick:() => navigate('/admin/orders') },
    { label:'Contract routes', value:'2', sub:'Ontario · Québec', color:'var(--tn-gold)', onClick:() => navigate('/admin/routes') },
    { label:'Pending invoices', value:pendingInvoices.length, sub:`$${pendingInvoices.reduce((s,i)=>s+parseFloat(i.amount||0),0).toFixed(2)}`, color:'#185FA5', onClick:() => navigate('/admin/invoices') },
    { label:'Overdue', value:overdueInvoices.length, sub:overdueInvoices.length>0?'Follow up needed':'All clear ✓', color:overdueInvoices.length>0?'#991B1B':'#0F6E56', onClick:() => navigate('/admin/payments') },
  ];

  const recentActivity = [
    ...todayOrders.filter(o=>o.status==='delivered').map(o => ({
      icon:'✅', text:`Delivery confirmed — ${clientName(o)}`, sub:`${driverName(o)} · ${o.deliveredAt || ''}`, color:'#0F6E56', type:'delivery', data:o
    })),
    ...todayOrders.filter(o=>o.status==='enroute').map(o => ({
      icon:'🚚', text:`En route — ${clientName(o)}`, sub:`${driverName(o)} · ETA soon`, color:'#185FA5', type:'enroute', data:o
    })),
    { icon:'💳', text:'EFT #5044508 received — $7,674.53', sub:'Bureau en Gros · Auto-matched', color:'var(--tn-gold)', type:'payment', data:null },
  ].slice(0, 4);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Today's overview</h1>
          <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchOrders} className="btn btn-outline btn-sm">↻ Refresh</button>
          <span className="badge badge-live">● Live</span>
          <div className="flex -space-x-2">
            {[['MD','var(--tn-red)'],['PE','#7C3AED'],['JL','#8B4513'],['PT','#0F6E56']].map(([i,bg],idx) => (
              <div key={idx} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-white text-xs font-bold" style={{borderColor:'var(--tn-cream)',background:bg}}>{i}</div>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {kpis.map((kpi,i) => (
          <button key={i} onClick={kpi.onClick} className="card p-4 text-left hover:shadow-md transition-shadow">
            <div className="text-2xl font-semibold mb-1" style={{color:kpi.color}}>{kpi.value}</div>
            <div className="text-xs mb-1" style={{color:'var(--tn-gold)'}}>{kpi.label}</div>
            <div className="text-xs" style={{color:kpi.color,opacity:0.75}}>{kpi.sub}</div>
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
            {todayOrders.filter(o=>o.status!=='delivered').length === 0 && (
              <p className="text-sm text-center py-4" style={{color:'var(--tn-gold)'}}>No active orders right now</p>
            )}
            {todayOrders.filter(o=>o.status!=='delivered').map(order => {
              const b = STATUS_BADGE[order.status]||STATUS_BADGE.waiting;
              return (
                <div key={order.id} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:opacity-80"
                  style={{background:'var(--tn-warm)'}}
                  onClick={() => navigate('/admin/orders')}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:order.status==='enroute'?'var(--tn-red)':'var(--tn-gold)'}}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{clientName(order)}</p>
                    <p className="text-xs truncate" style={{color:'var(--tn-gold)'}}>{driverName(order)} · {order.boxes} boxes</p>
                  </div>
                  <span className={`badge ${b.cls} flex-shrink-0`}>{b.label}</span>
                </div>
              );
            })}
            <p className="text-xs pt-1" style={{color:'var(--tn-gold)',borderTop:'0.5px solid var(--tn-border)'}}>{delivered} delivered today ✓</p>
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
              {label:'Ontario / Gatineau',done:onDone,total:15,driver:'Jean-Luc B.',fillCls:'progress-fill-red',started:ontarioRoute.started},
              {label:'Québec route',done:qcDone,total:10,driver:'Pierre T.',fillCls:'progress-fill-gold',started:quebecRoute.started},
            ].map((route,i) => (
              <div key={i} onClick={() => navigate('/admin/routes')} className="cursor-pointer">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{route.label}</p>
                  <span className="badge badge-info text-xs">{route.done}/{route.total}</span>
                </div>
                <p className="text-xs mb-2" style={{color:'var(--tn-gold)'}}>{route.driver} · {route.started?'In progress':'Not started'}</p>
                <div className="progress-bar"><div className={route.fillCls} style={{width:`${(route.done/route.total)*100}%`}}/></div>
              </div>
            ))}
            <p className="text-xs pt-1" style={{color:'var(--tn-gold)',borderTop:'0.5px solid var(--tn-border)'}}>Auto-invoice generates Sunday</p>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card p-4">
        <h2 className="section-title">Recent activity</h2>
        <div className="space-y-2">
          {recentActivity.length === 0 && (
            <p className="text-sm text-center py-4" style={{color:'var(--tn-gold)'}}>No activity yet today</p>
          )}
          {recentActivity.map((item,i) => (
            <div key={i}
              className={`flex items-start gap-3 p-3 rounded-xl transition-all ${item.data?'cursor-pointer hover:opacity-80':''}`}
              style={{background:'var(--tn-warm)'}}
              onClick={() => item.data && setActivityDetail(item)}>
              <span className="text-base flex-shrink-0">{item.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{item.text}</p>
                <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>{item.sub}</p>
              </div>
              {item.data && <span className="text-xs" style={{color:'var(--tn-red)'}}>View →</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Activity detail modal */}
      {activityDetail && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.6)'}} onClick={() => setActivityDetail(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" style={{background:'var(--tn-cream)'}} onClick={e=>e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{background:'var(--tn-dark)'}}>
              <div>
                <p className="font-mono text-xs" style={{color:'rgba(250,247,240,0.4)'}}>{activityDetail.data?.id}</p>
                <p className="font-semibold" style={{color:'var(--tn-cream)'}}>{activityDetail.text}</p>
              </div>
              <button onClick={() => setActivityDetail(null)} className="text-xl" style={{color:'rgba(250,247,240,0.4)'}}>×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {label:'Client', val: clientName(activityDetail.data)},
                  {label:'Driver', val: driverName(activityDetail.data)},
                  {label:'Address', val: activityDetail.data?.address},
                  {label:'Delivered at', val: activityDetail.data?.deliveredAt || '—'},
                ].map((item,i) => (
                  <div key={i} className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                    <p className="text-xs mb-1" style={{color:'var(--tn-gold)'}}>{item.label}</p>
                    <p className="font-medium text-sm">{item.val}</p>
                  </div>
                ))}
              </div>

              {activityDetail.type === 'delivery' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl h-32 flex flex-col items-center justify-center gap-2" style={{background:'linear-gradient(135deg,#1a3a1a,#2d5a2d)'}}>
                      <span className="text-3xl">📷</span>
                      <span className="text-white text-xs opacity-70">Delivery photo</span>
                      <span className="badge badge-success text-xs">{activityDetail.data?.photoUrl ? 'View' : 'Captured'}</span>
                    </div>
                    <div className="rounded-xl h-32 flex flex-col items-center justify-center gap-2" style={{background:'var(--tn-warm)',border:'0.5px solid var(--tn-border)'}}>
                      <span className="text-3xl">✍️</span>
                      <span className="text-xs" style={{color:'var(--tn-gold)'}}>Signature</span>
                      <span className="badge badge-success text-xs">{activityDetail.data?.recipientName || 'Captured'}</span>
                    </div>
                  </div>
                  {activityDetail.data?.recipientName && (
                    <div className="rounded-xl p-3" style={{background:'#E8F5EF'}}>
                      <p className="text-xs" style={{color:'#0F6E56'}}>Received by</p>
                      <p className="font-semibold text-sm" style={{color:'#0F6E56'}}>{activityDetail.data.recipientName}</p>
                    </div>
                  )}
                </>
              )}

              <button onClick={() => setActivityDetail(null)} className="btn w-full justify-center" style={{background:'var(--tn-red)',color:'white'}}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
