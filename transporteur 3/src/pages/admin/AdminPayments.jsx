import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CLIENTS } from '../../data/store';

const HISTORY = [
  { eft:'5044508', date:'June 25, 2026', client:'Bureau en Gros', invoices:['#558 ($3,363.02)','#559 ($4,311.51)'], total:7674.53 },
  { eft:'5044191', date:'June 18, 2026', client:'Bureau en Gros', invoices:['#551 ($1,379.80)','#553 ($3,363.02)','#554 ($4,311.51)'], total:9054.33 },
];

export default function AdminPayments() {
  const { invoices, markInvoicePaid } = useApp();
  const [tab, setTab] = useState('record');
  const [eftNo, setEftNo] = useState('');
  const [payDate, setPayDate] = useState('');
  const [amount, setAmount] = useState('');
  const [checked, setChecked] = useState(new Set());

  const unpaid = invoices.filter(i => i.status !== 'paid');
  const selectedTotal = Array.from(checked).reduce((s, id) => { const inv = invoices.find(i=>i.id===id); return s+(inv?.amount||0); }, 0);
  const enteredAmount = parseFloat(amount)||0;
  const diff = Math.abs(enteredAmount - selectedTotal);
  const isMatch = checked.size>0 && eftNo && enteredAmount>0 && diff<0.02;
  const isMismatch = checked.size>0 && eftNo && enteredAmount>0 && diff>=0.02;

  const toggleCheck = id => setChecked(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

  const confirm = () => {
    markInvoicePaid(Array.from(checked), eftNo);
    setChecked(new Set()); setEftNo(''); setPayDate(''); setAmount('');
    setTab('history');
  };

  const fmt = n => `$${n.toLocaleString('fr-CA',{minimumFractionDigits:2})}`;
  const pendingTotal = unpaid.filter(i=>i.status==='pending').reduce((s,i)=>s+i.amount,0);
  const overdueTotal = unpaid.filter(i=>i.status==='overdue').reduce((s,i)=>s+i.amount,0);

  const TABS = [['record','Record payment'],['history','Payment history'],['pending','Pending / overdue']];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Payment tracker</h1>
        <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>EFT remittance matching · auto-reads from Gmail</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {val:'$32,418', label:'Collected YTD',    color:'#0F6E56'},
          {val:fmt(pendingTotal), label:'Pending',   color:'var(--tn-gold)'},
          {val:fmt(overdueTotal), label:'Overdue',   color:'#991B1B'},
        ].map((k,i) => (
          <div key={i} className="card p-4">
            <div className="text-2xl font-semibold" style={{color:k.color}}>{k.val}</div>
            <div className="text-xs mt-1" style={{color:'var(--tn-gold)'}}>{k.label}</div>
          </div>
        ))}
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

      {tab==='record' && (
        <div className="max-w-2xl space-y-4">
          <div className="card p-4">
            <h2 className="font-medium text-sm mb-3">Enter remittance details</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="label">EFT No.</label><input className="input" placeholder="e.g. 5044508" value={eftNo} onChange={e=>setEftNo(e.target.value)} /></div>
              <div><label className="label">Payment date</label><input type="date" className="input" value={payDate} onChange={e=>setPayDate(e.target.value)} /></div>
            </div>
            <div><label className="label">Total amount received ($)</label><input type="number" className="input" placeholder="e.g. 7674.53" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} /></div>
          </div>

          {isMatch && <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{background:'#E8F5EF',color:'#0F6E56'}}>✅ Amount matches — ready to confirm</div>}
          {isMismatch && <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{background:'#FEE2E2',color:'#991B1B'}}>⚠️ Mismatch — entered {fmt(enteredAmount)}, selected {fmt(selectedTotal)} (diff: {fmt(diff)})</div>}

          <div className="card p-4">
            <h2 className="font-medium text-sm mb-3">Select invoices covered</h2>
            {unpaid.length===0
              ? <p className="text-sm text-center py-4" style={{color:'var(--tn-gold)'}}>All invoices paid ✓</p>
              : unpaid.map(inv => (
                <label key={inv.id} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer mb-1" style={{background:'var(--tn-warm)'}}>
                  <div onClick={() => toggleCheck(inv.id)}
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                    style={{background:checked.has(inv.id)?'var(--tn-red)':'white', border:`1.5px solid ${checked.has(inv.id)?'var(--tn-red)':'var(--tn-border-strong)'}`}}>
                    {checked.has(inv.id) && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Invoice #{inv.id} — {inv.type==='contract'?`${inv.route} route`:'Local'}</p>
                    <p className="text-xs" style={{color:'var(--tn-gold)'}}>{CLIENTS[inv.client]?.name} · {inv.dates}</p>
                  </div>
                  <p className="text-sm font-semibold">{fmt(inv.amount)}</p>
                  <span className={`badge ${inv.status==='overdue'?'badge-danger':'badge-warning'}`}>{inv.status}</span>
                </label>
              ))
            }
            <div className="flex items-center justify-between mt-4 pt-3" style={{borderTop:'0.5px solid var(--tn-border)'}}>
              <div>
                <p className="text-xs" style={{color:'var(--tn-gold)'}}>Selected total</p>
                <p className="text-lg font-bold">{fmt(selectedTotal)}</p>
              </div>
              <button onClick={confirm} disabled={!isMatch}
                className="btn"
                style={{background:isMatch?'#0F6E56':'var(--tn-warm)', color:isMatch?'white':'var(--tn-gold)', cursor:isMatch?'pointer':'not-allowed'}}>
                ✓ Confirm payment
              </button>
            </div>
          </div>
        </div>
      )}

      {tab==='history' && (
        <div className="card overflow-hidden max-w-2xl">
          {HISTORY.map((h,i) => (
            <div key={i} className="flex items-start gap-3 p-4" style={{borderBottom:'0.5px solid var(--tn-border)'}}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'#E8F5EF'}}>✅</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">EFT #{h.eft} — {h.client}</p>
                  <span className="badge badge-success">Paid</span>
                </div>
                <p className="text-xs" style={{color:'var(--tn-gold)'}}>{h.invoices.join(' + ')} · {h.date}</p>
                <p className="text-sm font-semibold mt-1">{fmt(h.total)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='pending' && (
        <div className="card overflow-hidden max-w-2xl">
          {unpaid.length===0
            ? <div className="text-center py-12 text-sm" style={{color:'var(--tn-gold)'}}>All invoices paid ✓</div>
            : unpaid.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 p-4" style={{borderBottom:'0.5px solid var(--tn-border)'}}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">Invoice #{inv.id} — {inv.type==='contract'?`${inv.route} route`:'Local'}</p>
                    <span className={`badge ${inv.status==='overdue'?'badge-danger':'badge-warning'}`}>{inv.status}</span>
                  </div>
                  <p className="text-xs" style={{color:'var(--tn-gold)'}}>{CLIENTS[inv.client]?.name} · {inv.dates} · {fmt(inv.amount)}</p>
                </div>
                <button className="btn btn-outline btn-sm">Send reminder</button>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}
