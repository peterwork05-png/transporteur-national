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

  const delivered  = todayOrders.filter(o => o.status === 'delivered').length;
  const active     = todayOrders.filter(o => ['picked','enroute'].includes(o.status)).length;
  const pendingInvoices  = invoices.filter(i => i.status === 'pending');
  const overdueInvoices  = invoices.filter(i => i.status === 'overdue');
  const paidInvoices     = invoices.filter(i => i.status === 'paid');
  const onDone  = ontarioRoute.stopStatus.filter(s => s === 'delivered').length;
  const qcDone  = quebecRoute.stopStatus.filter(s => s === 'delivered').length;

  const clientName = (o) => o.clientName || o.client_name || CLIENTS[o.client]?.name || o.client || '—';
  const driverName = (o) => o.driverName || o.driver_name || (o.driver==='peter'?'Peter':o.driver==='marc'?'Marc D.':o.driver||'—');

  // Build real activity from actual data
  const recentActivity = [
    // Real delivered orders
    ...todayOrders
      .filter(o => o.status === 'delivered')
      .sort((a,b) => (b.deliveredAt||'').localeCompare(a.deliveredAt||''))
      .slice(0, 3)
      .map(o => ({
        icon: '✅',
        text: `Delivered — ${clientName(o)}`,
        sub: `${driverName(o)} · ${o.deliveredAt || o.delivered_at || ''} · ${o.boxes} boxes`,
        color: '#0F6E56',
        type: 'delivery',
        data: o,
      })),
    // Real en-route orders
    ...todayOrders
      .filter(o => o.status === 'enroute')
      .slice(0, 2)
      .map(o => ({
        icon: '🚚',
        text: `En route — ${clientName(o)}`,
        sub: `${driverName(o)} · On the way`,
        color: '#185FA5',
        type: 'enroute',
        data: o,
      })),
    // Real picked-up orders
    ...todayOrders
      .filter(o => o.status === 'picked')
      .slice(0, 1)
      .map(o => ({
        icon: '📦',
        text: `Picked up — ${clientName(o)}`,
        sub: `${driverName(o)} · ${o.pickedUpAt || o.picked_up_at || ''}`,
        color: '#B45309',
        type: 'pickup',
        data: o,
      })),
    // Real paid invoices
    ...paidInvoices
      .slice(0, 2)
      .map(inv => ({
        icon: '💳',
        text: `Payment received — ${inv.client_name || CLIENTS[inv.client]?.name || inv.client || ''}`,
        sub: `Invoice #${inv.id} · $${parseFloat(inv.amount||0).toFixed(2)}${inv.eft ? ` · EFT #${inv.eft}` : ''}`,
        color: 'var(--tn-gold)',
        type: 'payment',
        data: inv,
      })),
  ].slice(0, 5);

  const kpis = [
    { label:'Local orders', value:todayOrders.length, sub:`${delivered} delivered · ${active} active`, color:'var(--tn-red)', onClick:()=>navigate('/admin/orders') },
    { label:'Contract routes', value:'2', sub:'Ontario · Québec', color:'var(--tn-gold)', onClick:()=>navigate('/admin/routes') },
    { label:'Pending invoices', value:pendingInvoices.length, sub:`$${pendingInvoices.reduce((s,i)=>s+parseFloat(i.amount||0),0).toFixed(2)}`, color:'#185FA5', onClick:()=>navigate('/admin/invoices') },
    { label:'Overdue', value:overdueInvoices.length, sub:overdueInvoices.length>0?'Follow up':'All clear ✓', color:overdueInvoices.length>0?'#991B1B':'#0F6E56', onClick:()=>navigate('/admin/payments') },
  ];

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold leading-tight" style={{color:'var(--tn-dark)'}}>Today's overview</h1>
          <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>{today}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={fetchOrders} className="btn btn-outline btn-sm text-xs">↻</button>
          <span className="badge badge-live text-xs">● Live</span>
        </div>
      </div>

      {/* Driver avatars */}
      <div className="flex items-center gap-2 mb-5">
        <p className="text-xs" style={{color:'var(--tn-gold)'}}>On duty:</p>
        <div className="flex -space-x-1.5">
          {[['MD','var(--tn-red)'],['PE','#7C3AED'],['JL','#8B4513'],['PT','#0F6E56']].map(([i,bg],idx)=>(
            <div key={idx} className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-white text-xs font-bold"
              style={{borderColor:'var(--tn-cream)',background:bg}}>{i}</div>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 mb-5 md:grid-cols-4">
        {kpis.map((kpi,i)=>(
          <button key={i} onClick={kpi.onClick} className="card p-3 text-left hover:shadow-md transition-shadow">
            <div className="text-2xl font-bold mb-1" style={{color:kpi.color}}>{kpi.value}</div>
            <div className="text-xs font-medium mb-0.5" style={{color:'var(--tn-dark)'}}>{kpi.label}</div>
            <div className="text-xs leading-tight" style={{color:kpi.color,opacity:0.75}}>{kpi.sub}</div>
          </button>
        ))}
      </div>

      {/* Active orders */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Active deliveries</h2>
          <span className="badge badge-info">{active} active</span>
        </div>
        {todayOrders.filter(o=>o.status!=='delivered').length===0 ? (
          <p className="text-sm text-center py-3" style={{color:'var(--tn-gold)'}}>No active orders right now</p>
        ) : (
          <div className="space-y-2">
            {todayOrders.filter(o=>o.status!=='delivered').map(order=>{
              const b = STATUS_BADGE[order.status]||STATUS_BADGE.waiting;
              return (
                <div key={order.id} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer"
                  style={{background:'var(--tn-warm)'}}
                  onClick={()=>navigate('/admin/orders')}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{background:order.status==='enroute'?'var(--tn-red)':'var(--tn-gold)'}}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{clientName(order)}</p>
                    <p className="text-xs truncate" style={{color:'var(--tn-gold)'}}>{driverName(order)} · {order.boxes} boxes</p>
                  </div>
                  <span className={`badge ${b.cls} flex-shrink-0 text-xs`}>{b.label}</span>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs mt-3 pt-2" style={{color:'var(--tn-gold)',borderTop:'0.5px solid var(--tn-border)'}}>
          {delivered} delivered today ✓
        </p>
      </div>

      {/* Contract routes */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Contract routes</h2>
          <span className="badge badge-success">Both active</span>
        </div>
        <div className="space-y-4">
          {[
            {label:'Ontario / Gatineau',done:onDone,total:15,driver:'Jean-Luc B.',fillCls:'progress-fill-red',started:ontarioRoute.started},
            {label:'Québec route',      done:qcDone,total:10,driver:'Pierre T.',  fillCls:'progress-fill-gold',started:quebecRoute.started},
          ].map((route,i)=>(
            <div key={i} className="cursor-pointer" onClick={()=>navigate('/admin/routes')}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">{route.label}</p>
                <span className="badge badge-info text-xs">{route.done}/{route.total}</span>
              </div>
              <p className="text-xs mb-2" style={{color:'var(--tn-gold)'}}>{route.driver} · {route.started?'In progress':'Not started'}</p>
              <div className="progress-bar"><div className={route.fillCls} style={{width:`${(route.done/route.total)*100}%`}}/></div>
            </div>
          ))}
          <p className="text-xs" style={{color:'var(--tn-gold)',borderTop:'0.5px solid var(--tn-border)',paddingTop:'8px'}}>Auto-invoice generates Sunday</p>
        </div>
      </div>

      {/* Recent activity — all real, all clickable */}
      <div className="card p-4">
        <h2 className="font-semibold text-sm mb-3">Recent activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-center py-4" style={{color:'var(--tn-gold)'}}>No activity yet today — orders will appear here as they progress</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((item,i)=>(
              <button key={i} onClick={() => setActivityDetail(item)}
                className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all hover:opacity-80"
                style={{background:'var(--tn-warm)'}}>
                <span className="text-base flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.text}</p>
                  <p className="text-xs mt-0.5 truncate" style={{color:'var(--tn-gold)'}}>{item.sub}</p>
                </div>
                <span className="text-xs flex-shrink-0 mt-0.5" style={{color:'var(--tn-red)'}}>→</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Activity detail modal */}
      {activityDetail && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{background:'rgba(26,18,8,0.6)'}} onClick={()=>setActivityDetail(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[85vh] overflow-y-auto"
            style={{background:'var(--tn-cream)'}} onClick={e=>e.stopPropagation()}>

            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between sticky top-0" style={{background:'var(--tn-dark)'}}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{activityDetail.icon}</span>
                <p className="font-semibold text-sm" style={{color:'var(--tn-cream)'}}>{activityDetail.text}</p>
              </div>
              <button onClick={()=>setActivityDetail(null)} className="text-xl" style={{color:'rgba(250,247,240,0.4)'}}>×</button>
            </div>

            <div className="p-5 space-y-3">
              {/* Delivery detail */}
              {(activityDetail.type === 'delivery' || activityDetail.type === 'enroute' || activityDetail.type === 'pickup') && activityDetail.data && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {label:'Client',        val: clientName(activityDetail.data)},
                      {label:'Driver',        val: driverName(activityDetail.data)},
                      {label:'Address',       val: activityDetail.data.address},
                      {label:'Status',        val: activityDetail.data.status?.charAt(0).toUpperCase() + activityDetail.data.status?.slice(1)},
                      activityDetail.data.deliveredAt || activityDetail.data.delivered_at
                        ? {label:'Delivered at', val: activityDetail.data.deliveredAt || activityDetail.data.delivered_at}
                        : null,
                      activityDetail.data.pickedUpAt || activityDetail.data.picked_up_at
                        ? {label:'Picked up at', val: activityDetail.data.pickedUpAt || activityDetail.data.picked_up_at}
                        : null,
                      {label:'Boxes', val: `${activityDetail.data.boxes} boxes`},
                      {label:'Order ID', val: activityDetail.data.id},
                    ].filter(Boolean).map((item,i)=>(
                      <div key={i} className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                        <p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.label}</p>
                        <p className="font-medium text-sm mt-0.5 break-all">{item.val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Proof of delivery */}
                  {activityDetail.type === 'delivery' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl h-24 flex flex-col items-center justify-center gap-1.5"
                        style={{background:'linear-gradient(135deg,#1a3a1a,#2d5a2d)'}}>
                        <span className="text-2xl">📷</span>
                        <span className="text-white text-xs opacity-80">Delivery photo</span>
                        <span className="badge badge-success" style={{fontSize:'10px'}}>Captured</span>
                      </div>
                      <div className="rounded-xl h-24 flex flex-col items-center justify-center gap-1.5"
                        style={{background:'var(--tn-warm)',border:'0.5px solid var(--tn-border)'}}>
                        <span className="text-2xl">✍️</span>
                        <span className="text-xs" style={{color:'var(--tn-gold)'}}>Signature</span>
                        <span className="badge badge-success" style={{fontSize:'10px'}}>
                          {activityDetail.data.recipient_name || 'Captured'}
                        </span>
                      </div>
                    </div>
                  )}

                  <button onClick={()=>{ setActivityDetail(null); navigate('/admin/orders'); }}
                    className="btn w-full justify-center" style={{background:'var(--tn-red)',color:'white'}}>
                    View full order →
                  </button>
                </>
              )}

              {/* Payment detail */}
              {activityDetail.type === 'payment' && activityDetail.data && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {label:'Invoice #',  val: `#${activityDetail.data.id}`},
                      {label:'Client',     val: activityDetail.data.client_name || CLIENTS[activityDetail.data.client]?.name || activityDetail.data.client || '—'},
                      {label:'Amount',     val: `$${parseFloat(activityDetail.data.amount||0).toFixed(2)}`},
                      {label:'Status',     val: 'Paid ✓'},
                      activityDetail.data.eft ? {label:'EFT Reference', val: `EFT #${activityDetail.data.eft}`} : null,
                      {label:'Period',     val: activityDetail.data.dates || '—'},
                      {label:'Type',       val: activityDetail.data.type === 'contract' ? `Contract · ${activityDetail.data.route}` : 'Local'},
                    ].filter(Boolean).map((item,i)=>(
                      <div key={i} className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                        <p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.label}</p>
                        <p className="font-medium text-sm mt-0.5">{item.val}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl p-3 flex items-center gap-2" style={{background:'#E8F5EF'}}>
                    <span className="text-lg">💳</span>
                    <div>
                      <p className="text-xs font-medium" style={{color:'#0F6E56'}}>Payment confirmed</p>
                      <p className="text-sm" style={{color:'#0F6E56'}}>
                        {activityDetail.data.eft ? `EFT #${activityDetail.data.eft} received` : 'Invoice marked as paid'}
                      </p>
                    </div>
                  </div>

                  <button onClick={()=>{ setActivityDetail(null); navigate('/admin/invoices'); }}
                    className="btn w-full justify-center" style={{background:'var(--tn-red)',color:'white'}}>
                    View all invoices →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
