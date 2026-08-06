import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CLIENTS } from '../../data/store';

const STATUS_BADGE = {
  waiting:   { label:'Waiting',            cls:'badge-gray' },
  picked:    { label:'Picked up',          cls:'badge-warning' },
  enroute:   { label:'En route',           cls:'badge-info' },
  delivered: { label:'Delivered',          cls:'badge-success' },
  attempted: { label:'Attempted delivery', cls:'badge-danger' },
};

const STATUS_STEPS  = ['waiting','picked','enroute','delivered'];
const STATUS_LABELS = { waiting:'Order placed', picked:'Picked up', enroute:'En route', delivered:'Delivered', attempted:'Attempted delivery' };

export default function AdminOrders() {
  const { orders, drivers, fetchOrders, updateOrderStatus } = useApp();
  const [tab,       setTab]       = useState('All');
  const [period,    setPeriod]    = useState('today');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');
  const [selected,  setSelected]  = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [allOrders, setAllOrders] = useState([]);
  const [loading7,  setLoading7]  = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [selectMode,   setSelectMode]   = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Edit / Create order
  const [showEdit,   setShowEdit]   = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [editForm,   setEditForm]   = useState({});
  const [createForm, setCreateForm] = useState({
    id: '', address: '', boxes: 1, amount: '', date: new Date().toISOString().split('T')[0],
    notes: '', driver_id: '', status: 'waiting',
  });

  const openEdit = (order) => {
    setEditForm({
      address:   order.address || '',
      boxes:     order.boxes || 1,
      amount:    order.amount || '',
      date:      order.date ? String(order.date).split('T')[0] : '',
      notes:     order.notes || '',
      driver_id: order.driver_id || order.driver || '',
      status:    order.status || 'waiting',
    });
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch(`/api/orders/${selected.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status:    editForm.status,
          notes:     editForm.notes,
        }),
      });
      // Update address, boxes, amount, date via a new endpoint
      await fetch(`/api/orders/${selected.id}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address:   editForm.address,
          boxes:     editForm.boxes,
          amount:    editForm.amount,
          date:      editForm.date,
          driver_id: editForm.driver_id || null,
        }),
      });
      if (period === 'today') await fetchOrders();
      else {
        setAllOrders(prev => prev.map(o => o.id === selected.id ? {
          ...o, ...editForm,
          driver: editForm.driver_id,
          driver_id: editForm.driver_id,
        } : o));
      }
      setSelected(prev => ({ ...prev, ...editForm, driver: editForm.driver_id, driver_id: editForm.driver_id }));
      setShowEdit(false);
    } catch(e) { console.error(e); }
    setSaving(false);
  };

  const handleCreateOrder = async () => {
    if (!createForm.address) return;
    setSaving(true);
    try {
      const id = createForm.id || `DEL-${new Date().getFullYear()}-MANUAL-${Date.now()}`;
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createForm, id }),
      });
      if (period === 'today') await fetchOrders();
      else {
        const res = await fetch(`/api/orders/${id}`);
        const data = await res.json();
        setAllOrders(prev => [data, ...prev]);
      }
      setShowCreate(false);
      setCreateForm({ id:'', address:'', boxes:1, amount:'', date:new Date().toISOString().split('T')[0], notes:'', driver_id:'', status:'waiting' });
    } catch(e) { console.error(e); }
    setSaving(false);
  };

  useEffect(() => {
    if (period === '7days' || period === 'all') {
      setLoading7(true);
      let url = '/api/orders?';
      if (period === '7days') url += 'days=7';
      if (period === 'all') {
        if (dateFrom) url += `&date_from=${dateFrom}`;
        if (dateTo)   url += `&date_to=${dateTo}`;
        if (!dateFrom && !dateTo) url += 'all=true';
      }
      fetch(url)
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
  }, [period, dateFrom, dateTo]);

  const displayOrders = period === 'today' ? orders : allOrders;

  const filtered = displayOrders.filter(o => {
    if (tab === 'Unassigned') return !o.driver && !o.driver_id;
    if (tab === 'Active')     return ['waiting','picked','enroute'].includes(o.status);
    if (tab === 'Delivered')  return o.status === 'delivered';
    if (tab === 'Attempted')  return o.status === 'attempted';
    return true;
  });

  const TABS = [
    { label:`All (${displayOrders.length})`,                                                                  val:'All' },
    { label:`Unassigned (${displayOrders.filter(o=>!o.driver&&!o.driver_id).length})`,                       val:'Unassigned' },
    { label:`Active (${displayOrders.filter(o=>['waiting','picked','enroute'].includes(o.status)).length})`,  val:'Active' },
    { label:`Delivered (${displayOrders.filter(o=>o.status==='delivered').length})`,                          val:'Delivered' },
    { label:`Attempted (${displayOrders.filter(o=>o.status==='attempted').length})`,                          val:'Attempted' },
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
      else setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, driver_id: driverId, driver: driverId } : o));
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

  const handleDelete = async (orderId) => {
    if (!window.confirm(`Delete order ${orderId}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      if (period === 'today') await fetchOrders();
      else setAllOrders(prev => prev.filter(o => o.id !== orderId));
      setSelected(null);
    } catch(e) { console.error(e); }
    setDeleting(false);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} orders? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map(id => fetch(`/api/orders/${id}`, { method: 'DELETE' })));
      if (period === 'today') await fetchOrders();
      else setAllOrders(prev => prev.filter(o => !selectedIds.has(o.id)));
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch(e) { console.error(e); }
    setBulkDeleting(false);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(o => o.id)));
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
          <button onClick={() => setShowCreate(true)}
            className="btn btn-sm" style={{background:'var(--tn-red)',color:'white'}}>
            + New order
          </button>
          <button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
            className="btn btn-sm"
            style={{background:selectMode?'var(--tn-red)':'white', color:selectMode?'white':'var(--tn-gold)', border:'0.5px solid var(--tn-border)'}}>
            {selectMode ? '✕ Cancel' : '☑ Select'}
          </button>
          <span className="badge badge-info">
            {displayOrders.filter(o=>['waiting','picked','enroute'].includes(o.status)&&(o.driver||o.driver_id)).length} active
          </span>
        </div>
      </div>

      {selectMode && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{background:'var(--tn-warm)'}}>
          <button onClick={toggleSelectAll} className="btn btn-outline btn-sm text-xs">
            {selectedIds.size === filtered.length ? '☑ Deselect all' : '☐ Select all'}
          </button>
          <span className="text-sm" style={{color:'var(--tn-gold)'}}>{selectedIds.size} selected</span>
          {selectedIds.size > 0 && (
            <button onClick={handleBulkDelete} disabled={bulkDeleting}
              className="btn btn-sm ml-auto" style={{background:'#991B1B', color:'white', opacity:bulkDeleting?0.6:1}}>
              {bulkDeleting ? '⏳ Deleting...' : `🗑 Delete ${selectedIds.size}`}
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex p-1 rounded-xl" style={{background:'var(--tn-warm)'}}>
          {[['today','📅 Today'],['7days','📆 Last 7 days'],['all','📂 All orders']].map(([val,label])=>(
            <button key={val} onClick={()=>{ setPeriod(val); setTab('All'); setSelectedIds(new Set()); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{background: period===val ? 'white' : 'transparent', color: period===val ? 'var(--tn-dark)' : 'var(--tn-gold)', boxShadow: period===val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {period === 'all' && (
        <div className="flex gap-2 mb-4 items-center flex-wrap">
          <div>
            <label className="label">From</label>
            <input type="date" className="input text-sm" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{width:'140px'}}/>
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input text-sm" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{width:'140px'}}/>
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={()=>{setDateFrom('');setDateTo('');}} className="btn btn-outline btn-sm mt-4">Clear</button>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map(t => (
          <button key={t.val} onClick={() => setTab(t.val)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{background:tab===t.val?'var(--tn-red)':'white', color:tab===t.val?'white':'var(--tn-gold)', border:'0.5px solid var(--tn-border)'}}>
            {t.label}
          </button>
        ))}
      </div>

      {loading7 && <div className="text-center py-8" style={{color:'var(--tn-gold)'}}>Loading orders...</div>}

      {!loading7 && (
        <>
          <div className="card overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr style={{borderBottom:'0.5px solid var(--tn-border)'}}>
                  {selectMode && <th className="px-4 py-3 w-10"/>}
                  {['Order ID','Client','Address','Driver','Boxes','Amount','Status','Date'].map(h => (
                    <th key={h} className="text-left text-xs font-medium px-4 py-3" style={{color:'var(--tn-gold)'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((order, i) => {
                  const b = STATUS_BADGE[order.status] || STATUS_BADGE.waiting;
                  const hasDriver = order.driver || order.driver_id;
                  const isChecked = selectedIds.has(order.id);
                  return (
                    <tr key={order.id}
                      onClick={() => selectMode ? toggleSelect(order.id) : setSelected(order)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      style={{borderBottom:'0.5px solid var(--tn-border)', background:isChecked?'rgba(192,57,43,0.05)':i%2===0?'white':'var(--tn-cream)'}}>
                      {selectMode && (
                        <td className="px-4 py-3">
                          <div className="w-5 h-5 rounded border-2 flex items-center justify-center"
                            style={{borderColor:isChecked?'var(--tn-red)':'var(--tn-border)', background:isChecked?'var(--tn-red)':'white'}}>
                            {isChecked && <span className="text-white text-xs">✓</span>}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono text-xs" style={{color:'var(--tn-red)'}}>{order.id}</td>
                      <td className="px-4 py-3 text-sm font-medium">{clientName(order)}</td>
                      <td className="px-4 py-3 text-sm max-w-xs truncate" style={{color:'var(--tn-gold)'}}>{order.address}</td>
                      <td className="px-4 py-3 text-sm">{hasDriver ? driverName(order) : <span className="badge badge-danger">Unassigned</span>}</td>
                      <td className="px-4 py-3 text-sm">{order.boxes}</td>
                      <td className="px-4 py-3 text-sm font-semibold">${parseFloat(order.amount||0).toFixed(2)}</td>
                      <td className="px-4 py-3"><span className={`badge ${b.cls}`}>{b.label}</span></td>
                      <td className="px-4 py-3 text-xs" style={{color:'var(--tn-gold)'}}>{String(order.date||'').split('T')[0]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="text-center py-12 text-sm" style={{color:'var(--tn-gold)'}}>No orders found</div>}
          </div>

          <div className="space-y-2 md:hidden">
            {filtered.length === 0 && <div className="card p-8 text-center text-sm" style={{color:'var(--tn-gold)'}}>No orders found</div>}
            {filtered.map(order => {
              const b = STATUS_BADGE[order.status] || STATUS_BADGE.waiting;
              const hasDriver = order.driver || order.driver_id;
              const isChecked = selectedIds.has(order.id);
              return (
                <div key={order.id} className="card p-4 cursor-pointer"
                  onClick={() => selectMode ? toggleSelect(order.id) : setSelected(order)}
                  style={{background:isChecked?'rgba(192,57,43,0.05)':'white', border:isChecked?'1px solid var(--tn-red)':'none'}}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    {selectMode && (
                      <div className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{borderColor:isChecked?'var(--tn-red)':'var(--tn-border)', background:isChecked?'var(--tn-red)':'white'}}>
                        {isChecked && <span className="text-white text-xs">✓</span>}
                      </div>
                    )}
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
                <div className="space-y-2">
                  {selected.photo_url && (
                    <div>
                      <p className="text-xs mb-1 font-medium" style={{color:'var(--tn-gold)'}}>📷 Delivery photo</p>
                      <img src={selected.photo_url} alt="Delivery proof"
                        className="w-full rounded-xl object-cover" style={{maxHeight:'200px'}}/>
                    </div>
                  )}
                  {selected.signature_url && (
                    <div>
                      <p className="text-xs mb-1 font-medium" style={{color:'var(--tn-gold)'}}>✍️ Signature — {selected.recipient_name}</p>
                      <img src={selected.signature_url} alt="Signature"
                        className="w-full rounded-xl" style={{maxHeight:'120px', background:'white', padding:'8px', border:'0.5px solid var(--tn-border)'}}/>
                    </div>
                  )}
                  {!selected.photo_url && !selected.signature_url && (
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
                  <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                    <p className="text-xs font-medium mb-2" style={{color:'var(--tn-gold)'}}>📤 Upload proof of delivery</p>
                    <input type="file" accept="image/*" id="proof-upload" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const base64 = ev.target.result.split(',')[1];
                          try {
                            const res = await fetch(`/api/upload/delivery-photo`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ imageBase64: base64, orderId: selected.id }),
                            });
                            const data = await res.json();
                            if (data.url) {
                              await fetch(`/api/orders/${selected.id}/status`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'delivered', photo_url: data.url }),
                              });
                              setSelected(prev => ({ ...prev, photo_url: data.url }));
                              if (period === 'today') fetchOrders();
                            }
                          } catch(err) { console.error(err); }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                    <label htmlFor="proof-upload" className="btn btn-outline btn-sm w-full justify-center cursor-pointer text-xs">
                      📷 {selected.photo_url ? 'Replace photo proof' : 'Upload photo proof'}
                    </label>
                    <a href={`/api/orders/${selected.id}/proof-pdf`} target="_blank" rel="noreferrer"
                      className="btn btn-sm w-full justify-center text-xs mt-2"
                      style={{background:'var(--tn-red)', color:'white', display:'block', textAlign:'center'}}>
                      ⬇ Download proof of delivery
                    </a>
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => handleDelete(selected.id)} disabled={deleting}
                  className="btn btn-sm px-3" style={{background:'#FEE2E2',color:'#991B1B'}}>
                  {deleting ? '...' : '🗑 Delete'}
                </button>
                <button onClick={() => openEdit(selected)}
                  className="btn btn-sm px-3" style={{background:'var(--tn-warm)',color:'var(--tn-dark)',border:'0.5px solid var(--tn-border)'}}>
                  ✏️ Edit
                </button>
                {selected.status !== 'delivered' && selected.status !== 'attempted' && (
                  <button onClick={async () => {
                    const now = new Date().toLocaleString('en-CA');
                    await updateOrderStatus(selected.id, 'delivered', { delivered_at: now, recipient_name: 'Admin' });
                    setSelected(prev => ({ ...prev, status: 'delivered', delivered_at: now }));
                    if (period !== 'today') setAllOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: 'delivered', delivered_at: now } : o));
                  }} className="btn btn-sm flex-1 justify-center" style={{background:'#0F6E56',color:'white'}}>
                    ✓ Mark delivered
                  </button>
                )}
                {selected.status !== 'attempted' && selected.status !== 'delivered' && (
                  <button onClick={async () => {
                    const note = window.prompt('Reason for attempted delivery (optional):') || '';
                    await updateOrderStatus(selected.id, 'attempted', { notes: note ? `[Attempted delivery] ${note}` : '[Attempted delivery]' });
                    setSelected(prev => ({ ...prev, status: 'attempted' }));
                    if (period !== 'today') setAllOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: 'attempted' } : o));
                  }} className="btn btn-sm flex-1 justify-center" style={{background:'#FEF3C7',color:'#92400E',border:'0.5px solid #D97706'}}>
                    ⚠️ Attempted
                  </button>
                )}
                {selected.status === 'attempted' && (
                  <button onClick={async () => {
                    await updateOrderStatus(selected.id, 'waiting', {});
                    setSelected(prev => ({ ...prev, status: 'waiting' }));
                    if (period !== 'today') setAllOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: 'waiting' } : o));
                  }} className="btn btn-sm flex-1 justify-center" style={{background:'var(--tn-gold)',color:'white'}}>
                    ↺ Reschedule
                  </button>
                )}
                {(selected.status === 'enroute' || selected.status === 'picked') && (
                  <a href={`/track/${selected.id}`} target="_blank" rel="noreferrer"
                    className="btn btn-sm flex-1 justify-center" style={{background:'#185FA5',color:'white'}}>
                    🗺️ Track live
                  </a>
                )}
                <button onClick={() => setSelected(null)} className="btn flex-1 justify-center" style={{background:'var(--tn-red)',color:'white'}}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit order modal */}
      {showEdit && selected && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4" style={{background:'rgba(26,18,8,0.7)'}}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{background:'var(--tn-cream)'}}>
            <div className="px-5 py-4 flex items-center justify-between sticky top-0" style={{background:'var(--tn-dark)',borderRadius:'16px 16px 0 0'}}>
              <p className="font-semibold" style={{color:'var(--tn-cream)'}}>✏️ Edit order — {selected.id}</p>
              <button onClick={() => setShowEdit(false)} className="text-xl" style={{color:'rgba(250,247,240,0.4)'}}>×</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label">Delivery address</label>
                <input className="input" value={editForm.address} onChange={e=>setEditForm(f=>({...f,address:e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Boxes</label>
                  <input type="number" className="input" value={editForm.boxes} onChange={e=>setEditForm(f=>({...f,boxes:parseInt(e.target.value)||1}))} />
                </div>
                <div>
                  <label className="label">Amount ($)</label>
                  <input type="number" step="0.01" className="input" value={editForm.amount} onChange={e=>setEditForm(f=>({...f,amount:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={editForm.date} onChange={e=>setEditForm(f=>({...f,date:e.target.value}))} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={editForm.status} onChange={e=>setEditForm(f=>({...f,status:e.target.value}))}>
                  <option value="waiting">Waiting</option>
                  <option value="picked">Picked up</option>
                  <option value="enroute">En route</option>
                  <option value="delivered">Delivered</option>
                  <option value="attempted">Attempted delivery</option>
                </select>
              </div>
              <div>
                <label className="label">Driver</label>
                <select className="input" value={editForm.driver_id} onChange={e=>setEditForm(f=>({...f,driver_id:e.target.value}))}>
                  <option value="">— Unassigned —</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={3} style={{resize:'none'}} value={editForm.notes}
                  onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowEdit(false)} className="btn btn-outline flex-1 justify-center">Cancel</button>
                <button onClick={handleSaveEdit} disabled={saving}
                  className="btn flex-1 justify-center" style={{background:'var(--tn-red)',color:'white',opacity:saving?0.6:1}}>
                  {saving ? '⏳ Saving...' : '💾 Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create order modal */}
      {showCreate && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.7)'}}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{background:'var(--tn-cream)'}}>
            <div className="px-5 py-4 flex items-center justify-between sticky top-0" style={{background:'var(--tn-dark)',borderRadius:'16px 16px 0 0'}}>
              <p className="font-semibold" style={{color:'var(--tn-cream)'}}>+ New order</p>
              <button onClick={() => setShowCreate(false)} className="text-xl" style={{color:'rgba(250,247,240,0.4)'}}>×</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label">Order ID (optional — auto-generated if blank)</label>
                <input className="input font-mono" placeholder="e.g. DEL-2026-9999"
                  value={createForm.id} onChange={e=>setCreateForm(f=>({...f,id:e.target.value}))} />
              </div>
              <div>
                <label className="label">Delivery address *</label>
                <input className="input" placeholder="123 Rue Example, Montréal"
                  value={createForm.address} onChange={e=>setCreateForm(f=>({...f,address:e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Boxes</label>
                  <input type="number" className="input" value={createForm.boxes}
                    onChange={e=>setCreateForm(f=>({...f,boxes:parseInt(e.target.value)||1}))} />
                </div>
                <div>
                  <label className="label">Amount ($)</label>
                  <input type="number" step="0.01" className="input" placeholder="0.00"
                    value={createForm.amount} onChange={e=>setCreateForm(f=>({...f,amount:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={createForm.date}
                  onChange={e=>setCreateForm(f=>({...f,date:e.target.value}))} />
              </div>
              <div>
                <label className="label">Assign driver (optional)</label>
                <select className="input" value={createForm.driver_id}
                  onChange={e=>setCreateForm(f=>({...f,driver_id:e.target.value}))}>
                  <option value="">— Unassigned —</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Notes (optional)</label>
                <textarea className="input" rows={3} style={{resize:'none'}} placeholder="Delivery notes..."
                  value={createForm.notes} onChange={e=>setCreateForm(f=>({...f,notes:e.target.value}))} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowCreate(false)} className="btn btn-outline flex-1 justify-center">Cancel</button>
                <button onClick={handleCreateOrder} disabled={saving || !createForm.address}
                  className="btn flex-1 justify-center"
                  style={{background:'var(--tn-red)',color:'white',opacity:saving||!createForm.address?0.6:1}}>
                  {saving ? '⏳ Creating...' : '+ Create order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
