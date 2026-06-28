import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CLIENTS, TPS, TVQ, CONTRACT_RATES } from '../../data/store';

const STATUS_BADGE = { paid:'badge-success', pending:'badge-warning', overdue:'badge-danger' };

export default function AdminInvoices() {
  const { invoices, addInvoice } = useApp();
  const [tab, setTab] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ type:'contract', route:'ontario', client:'beg', days:5, dateFrom:'', dateTo:'', invNum:583 });

  const filtered = invoices.filter(inv => tab==='all' ? true : inv.status===tab);

  const calcTotals = () => {
    const sub = form.type==='contract' ? (CONTRACT_RATES[form.route]||0) * form.days : 0;
    return { sub, tps:sub*TPS, tvq:sub*TVQ, total:sub*(1+TPS+TVQ) };
  };

  const handleCreate = () => {
    const { total } = calcTotals();
    addInvoice({ id:form.invNum, type:form.type, route:form.route, dates:`${form.dateFrom} – ${form.dateTo}`, amount:Math.round(total*100)/100, days:form.days, status:'pending', client:form.client });
    setShowNew(false);
    setForm(f => ({ ...f, invNum:f.invNum+1 }));
  };

  const { sub, tps, tvq, total } = calcTotals();
  const fmt = n => `$${n.toLocaleString('fr-CA',{minimumFractionDigits:2})}`;

  const TABS = [['all','All'],['pending','Pending'],['paid','Paid'],['overdue','Overdue']];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Invoices</h1>
          <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>Auto-sends weekly (contract) and bi-weekly (local)</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn" style={{background:'var(--tn-red)',color:'white'}}>
          + New invoice
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {TABS.map(([val,label]) => (
          <button key={val} onClick={() => setTab(val)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{background:tab===val?'var(--tn-red)':'white', color:tab===val?'white':'var(--tn-gold)', border:'0.5px solid var(--tn-border)'}}>
            {label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{borderBottom:'0.5px solid var(--tn-border)'}}>
              {['Invoice #','Type','Client','Period','Amount','Status','EFT Ref'].map(h => (
                <th key={h} className="text-left text-xs font-medium px-4 py-3" style={{color:'var(--tn-gold)'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv, i) => (
              <tr key={inv.id} style={{borderBottom:'0.5px solid var(--tn-border)', background:i%2===0?'white':'var(--tn-cream)'}}>
                <td className="px-4 py-3 font-mono text-sm font-semibold" style={{color:'var(--tn-dark)'}}>#{inv.id}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${inv.type==='contract'?'badge-info':'badge-gray'}`}>
                    {inv.type==='contract'?`Contract · ${inv.route}`:'Local'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{CLIENTS[inv.client]?.name||inv.client}</td>
                <td className="px-4 py-3 text-sm" style={{color:'var(--tn-gold)'}}>{inv.dates}</td>
                <td className="px-4 py-3 text-sm font-semibold">{fmt(inv.amount)}</td>
                <td className="px-4 py-3"><span className={`badge ${STATUS_BADGE[inv.status]||'badge-gray'}`}>{inv.status.charAt(0).toUpperCase()+inv.status.slice(1)}</span></td>
                <td className="px-4 py-3 text-xs font-mono" style={{color:'var(--tn-gold)'}}>{inv.eft?`EFT #${inv.eft}`:'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0 && <div className="text-center py-12 text-sm" style={{color:'var(--tn-gold)'}}>No invoices found</div>}
      </div>

      {/* New invoice modal */}
      {showNew && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.6)'}}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md p-6" style={{background:'var(--tn-cream)'}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">New invoice</h2>
              <button onClick={() => setShowNew(false)} className="text-xl leading-none" style={{color:'var(--tn-gold)'}}>×</button>
            </div>
            <div className="space-y-3">
              <div><label className="label">Type</label>
                <select className="input" value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
                  <option value="contract">Contract route</option>
                  <option value="local">Local deliveries</option>
                </select>
              </div>
              {form.type==='contract' && (
                <div><label className="label">Route</label>
                  <select className="input" value={form.route} onChange={e => setForm(f=>({...f,route:e.target.value}))}>
                    <option value="ontario">Ontario / Gatineau ($749.99/day)</option>
                    <option value="quebec">Québec ($585.00/day)</option>
                  </select>
                </div>
              )}
              <div><label className="label">Client</label>
                <select className="input" value={form.client} onChange={e => setForm(f=>({...f,client:e.target.value}))}>
                  {Object.values(CLIENTS).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">From</label><input type="date" className="input" value={form.dateFrom} onChange={e=>setForm(f=>({...f,dateFrom:e.target.value}))} /></div>
                <div><label className="label">To</label><input type="date" className="input" value={form.dateTo} onChange={e=>setForm(f=>({...f,dateTo:e.target.value}))} /></div>
              </div>
              {form.type==='contract' && (
                <div><label className="label">Days driven</label>
                  <input type="number" className="input" value={form.days} min={1} max={5} onChange={e=>setForm(f=>({...f,days:parseInt(e.target.value)}))} />
                </div>
              )}
              <div><label className="label">Invoice #</label>
                <input type="number" className="input" value={form.invNum} onChange={e=>setForm(f=>({...f,invNum:parseInt(e.target.value)}))} />
              </div>
            </div>
            {form.type==='contract' && (
              <div className="mt-4 rounded-xl p-3 text-xs space-y-1" style={{background:'var(--tn-warm)'}}>
                <div className="flex justify-between" style={{color:'var(--tn-gold)'}}><span>Subtotal</span><span>{fmt(sub)}</span></div>
                <div className="flex justify-between" style={{color:'var(--tn-gold)'}}><span>TPS 5%</span><span>{fmt(tps)}</span></div>
                <div className="flex justify-between" style={{color:'var(--tn-gold)'}}><span>TVQ 9.975%</span><span>{fmt(tvq)}</span></div>
                <div className="flex justify-between font-bold pt-1" style={{borderTop:'0.5px solid var(--tn-border)',color:'var(--tn-dark)'}}><span>Total</span><span>{fmt(total)}</span></div>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNew(false)} className="btn btn-outline flex-1">Cancel</button>
              <button onClick={handleCreate} className="btn flex-1 justify-center" style={{background:'var(--tn-red)',color:'white'}}>Create invoice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
