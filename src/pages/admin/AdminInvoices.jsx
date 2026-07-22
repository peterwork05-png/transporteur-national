import { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { CLIENTS, TPS, TVQ, CONTRACT_RATES } from '../../data/store';

const STATUS_BADGE = { paid:'badge-success', pending:'badge-warning', overdue:'badge-danger' };

export default function AdminInvoices() {
  const { invoices, addInvoice, fetchInvoices } = useApp();
  const [tab,       setTab]       = useState('all');
  const [showNew,   setShowNew]   = useState(false);
  const [selected,  setSelected]  = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileRef = useRef(null);

  // New invoice form
  const [form, setForm] = useState({
    invNum: '', type:'contract', route:'ontario', client:'beg',
    days:5, dateFrom:'', dateTo:'', amount:'', status:'pending',
  });

  const filtered = invoices.filter(inv => tab==='all' ? true : inv.status===tab);
  const fmt = n => `$${parseFloat(n||0).toLocaleString('en-CA',{minimumFractionDigits:2, maximumFractionDigits:2})}`;
  const getClientName = inv => CLIENTS[inv.client]?.name || inv.client_name || inv.client || '—';
  const TABS = [['all','All'],['pending','Pending'],['paid','Paid'],['overdue','Overdue']];

  const calcTotals = () => {
    const sub = (CONTRACT_RATES[form.route]||0) * (form.days||0);
    return { sub, tps:sub*TPS, tvq:sub*TVQ, total:sub*(1+TPS+TVQ) };
  };

  const handleCreate = async () => {
    let total = parseFloat(form.amount) || 0;
    if (form.type === 'contract' && !form.amount) {
      total = calcTotals().total;
    }
    await addInvoice({
      id: form.invNum,
      type: form.type,
      route: form.route,
      client: form.client,
      dates: `${form.dateFrom} – ${form.dateTo}`,
      amount: Math.round(total * 100) / 100,
      days: form.days,
      status: form.status,
      date_from: form.dateFrom,
      date_to: form.dateTo,
    });
    await fetchInvoices();
    setShowNew(false);
    setForm({ invNum:'', type:'contract', route:'ontario', client:'beg', days:5, dateFrom:'', dateTo:'', amount:'', status:'pending' });
  };

  const handlePDFUpload = async (invoiceId, file) => {
    setUploading(true);
    setUploadMsg('Uploading PDF...');
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        const res = await fetch(`/api/invoices/${invoiceId}/upload-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64, filename: file.name }),
        });
        const data = await res.json();
        if (data.success) {
          setUploadMsg('✅ PDF uploaded successfully!');
          await fetchInvoices();
          // Update selected invoice with new pdf_url
          setSelected(prev => prev ? { ...prev, pdf_url: data.pdf_url } : null);
        } else {
          setUploadMsg(`❌ Error: ${data.error}`);
        }
        setUploading(false);
        setTimeout(() => setUploadMsg(''), 3000);
      };
      reader.readAsDataURL(file);
    } catch(err) {
      setUploadMsg(`❌ ${err.message}`);
      setUploading(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Invoices</h1>
          <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>Manage and upload invoice PDFs</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn btn-sm" style={{background:'var(--tn-red)',color:'white'}}>+ New</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map(([val,label]) => (
          <button key={val} onClick={() => setTab(val)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{background:tab===val?'var(--tn-red)':'white', color:tab===val?'white':'var(--tn-gold)', border:'0.5px solid var(--tn-border)'}}>
            {label}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="card overflow-hidden hidden md:block">
        <table className="w-full">
          <thead>
            <tr style={{borderBottom:'0.5px solid var(--tn-border)'}}>
              {['Invoice #','Type','Client','Period','Amount','Status','PDF'].map(h => (
                <th key={h} className="text-left text-xs font-medium px-4 py-3" style={{color:'var(--tn-gold)'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv, i) => (
              <tr key={inv.id} onClick={() => setSelected(inv)}
                className="cursor-pointer hover:opacity-80"
                style={{borderBottom:'0.5px solid var(--tn-border)', background:i%2===0?'white':'var(--tn-cream)'}}>
                <td className="px-4 py-3 font-mono text-sm font-semibold" style={{color:'var(--tn-red)'}}>#{inv.id}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${inv.type==='contract'?'badge-info':'badge-gray'}`}>
                    {inv.type==='contract'?`Contract · ${inv.route}`:'Local'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{getClientName(inv)}</td>
                <td className="px-4 py-3 text-sm" style={{color:'var(--tn-gold)'}}>{String(inv.date_from||'').split('T')[0]} – {String(inv.date_to||'').split('T')[0]}</td>
                <td className="px-4 py-3 text-sm font-semibold">{fmt(inv.amount)}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${STATUS_BADGE[inv.status]||'badge-gray'}`}>
                    {inv.status?.charAt(0).toUpperCase()+inv.status?.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {inv.pdf_url
                    ? <span className="badge badge-success">📄 PDF</span>
                    : <span className="badge badge-gray">No PDF</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0 && <div className="text-center py-12 text-sm" style={{color:'var(--tn-gold)'}}>No invoices found</div>}
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {filtered.map(inv => (
          <div key={inv.id} className="card p-4 cursor-pointer" onClick={() => setSelected(inv)}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-mono text-sm font-bold" style={{color:'var(--tn-red)'}}>#{inv.id}</p>
                <p className="text-sm font-medium mt-0.5">{getClientName(inv)}</p>
                <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>{inv.dates || `${inv.date_from||''} – ${inv.date_to||''}`}</p>
              </div>
              <span className={`badge ${STATUS_BADGE[inv.status]||'badge-gray'} flex-shrink-0`}>
                {inv.status?.charAt(0).toUpperCase()+inv.status?.slice(1)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2" style={{borderTop:'0.5px solid var(--tn-border)'}}>
              <p className="font-semibold text-sm">{fmt(inv.amount)}</p>
              {inv.pdf_url
                ? <span className="badge badge-success">📄 PDF attached</span>
                : <span className="badge badge-gray">No PDF</span>
              }
            </div>
          </div>
        ))}
        {filtered.length===0 && <div className="card p-8 text-center text-sm" style={{color:'var(--tn-gold)'}}>No invoices found</div>}
      </div>

      {/* Invoice detail modal */}
      {selected && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{background:'rgba(26,18,8,0.6)'}} onClick={() => setSelected(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto"
            style={{background:'var(--tn-cream)'}} onClick={e=>e.stopPropagation()}>

            <div className="px-6 py-4 flex items-center justify-between sticky top-0" style={{background:'var(--tn-dark)'}}>
              <div>
                <p className="font-mono text-xs" style={{color:'rgba(250,247,240,0.4)'}}>Invoice #{selected.id}</p>
                <p className="font-semibold" style={{color:'var(--tn-cream)'}}>Invoice details</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${STATUS_BADGE[selected.status]||'badge-gray'}`}>
                  {selected.status?.charAt(0).toUpperCase()+selected.status?.slice(1)}
                </span>
                <button onClick={() => setSelected(null)} className="text-xl" style={{color:'rgba(250,247,240,0.4)'}}>×</button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Invoice info */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {label:'Client',     val: getClientName(selected)},
                  {label:'Type',       val: selected.type==='contract'?`Contract · ${selected.route}`:'Local'},
                  {label:'Period',     val: selected.dates || `${selected.date_from||''} – ${selected.date_to||''}`},
                  {label:'Days',       val: selected.days ? `${selected.days} days` : null},
                ].filter(i=>i.val).map((item,i)=>(
                  <div key={i} className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                    <p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.label}</p>
                    <p className="font-semibold text-sm mt-0.5">{item.val}</p>
                  </div>
                ))}
              </div>

              {/* Amount breakdown */}
              <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs font-medium mb-3" style={{color:'var(--tn-gold)'}}>Amount breakdown</p>
                {(() => {
                  const total = parseFloat(selected.amount||0);
                  const sub = total / (1 + TPS + TVQ);
                  return (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm"><span style={{color:'var(--tn-gold)'}}>Subtotal</span><span>{fmt(sub)}</span></div>
                      <div className="flex justify-between text-sm"><span style={{color:'var(--tn-gold)'}}>TPS (5%)</span><span>{fmt(sub*TPS)}</span></div>
                      <div className="flex justify-between text-sm"><span style={{color:'var(--tn-gold)'}}>TVQ (9.975%)</span><span>{fmt(sub*TVQ)}</span></div>
                      <div className="flex justify-between font-bold pt-2 text-sm" style={{borderTop:'0.5px solid var(--tn-border)'}}>
                        <span>Total</span><span style={{color:'var(--tn-red)'}}>{fmt(total)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {selected.eft && (
                <div className="rounded-xl p-3 flex items-center gap-2" style={{background:'#E8F5EF'}}>
                  <span>💳</span>
                  <div>
                    <p className="text-xs font-medium" style={{color:'#0F6E56'}}>Payment received</p>
                    <p className="text-sm font-semibold" style={{color:'#0F6E56'}}>EFT #{selected.eft}</p>
                  </div>
                </div>
              )}

              {/* PDF section */}
              <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs font-medium mb-3" style={{color:'var(--tn-gold)'}}>📄 Invoice PDF</p>
                {selected.pdf_url ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 rounded-xl" style={{background:'#E8F5EF'}}>
                      <span>📄</span>
                      <p className="text-sm font-medium flex-1" style={{color:'#0F6E56'}}>PDF attached</p>
                      <a href={selected.pdf_url} target="_blank" rel="noreferrer"
                        className="btn btn-sm" style={{background:'#0F6E56',color:'white'}}>
                        View PDF
                      </a>
                    </div>
                    <button onClick={() => fileRef.current?.click()}
                      className="btn btn-outline btn-sm w-full justify-center text-xs">
                      Replace PDF
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer"
                      style={{borderColor:'var(--tn-border-strong)'}}
                      onClick={() => fileRef.current?.click()}>
                      <p className="text-2xl mb-2">📤</p>
                      <p className="text-sm font-medium">Upload invoice PDF</p>
                      <p className="text-xs mt-1" style={{color:'var(--tn-gold)'}}>Click to select PDF file</p>
                    </div>
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handlePDFUpload(selected.id, file);
                    e.target.value = '';
                  }} />
                {uploadMsg && (
                  <p className="text-xs mt-2 text-center font-medium" style={{color:uploadMsg.includes('✅')?'#0F6E56':'#991B1B'}}>
                    {uploadMsg}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setSelected(null)} className="btn btn-outline flex-1 justify-center">Close</button>
                {selected.pdf_url && (
                  <a href={selected.pdf_url} target="_blank" rel="noreferrer"
                    className="btn flex-1 justify-center" style={{background:'var(--tn-red)',color:'white'}}>
                    ⬇ Download PDF
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New invoice modal */}
      {showNew && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.6)'}}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" style={{background:'var(--tn-cream)'}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">New invoice</h2>
              <button onClick={() => setShowNew(false)} className="text-xl leading-none" style={{color:'var(--tn-gold)'}}>×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Invoice #</label>
                <input className="input" placeholder="e.g. 599" value={form.invNum}
                  onChange={e=>setForm(f=>({...f,invNum:e.target.value}))} />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  <option value="contract">Contract route</option>
                  <option value="local">Local deliveries</option>
                </select>
              </div>
              {form.type==='contract' && (
                <div>
                  <label className="label">Route</label>
                  <select className="input" value={form.route} onChange={e=>setForm(f=>({...f,route:e.target.value}))}>
                    <option value="ontario">Ontario / Gatineau ($749.99/day)</option>
                    <option value="quebec">Québec ($585.00/day)</option>
                  </select>
                </div>
              )}
              <div>
                <label className="label">Client</label>
                <select className="input" value={form.client} onChange={e=>setForm(f=>({...f,client:e.target.value}))}>
                  {Object.values(CLIENTS).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">From</label><input type="date" className="input" value={form.dateFrom} onChange={e=>setForm(f=>({...f,dateFrom:e.target.value}))} /></div>
                <div><label className="label">To</label><input type="date" className="input" value={form.dateTo} onChange={e=>setForm(f=>({...f,dateTo:e.target.value}))} /></div>
              </div>
              {form.type==='contract' && (
                <div>
                  <label className="label">Days driven</label>
                  <input type="number" className="input" value={form.days} min={1} max={5}
                    onChange={e=>setForm(f=>({...f,days:parseInt(e.target.value)}))} />
                </div>
              )}
              <div>
                <label className="label">Total amount (with taxes) — leave blank to auto-calculate</label>
                <input type="number" className="input" placeholder="e.g. 4311.51" step="0.01"
                  value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>

            {form.type==='contract' && !form.amount && (() => {
              const {sub,tps,tvq,total} = calcTotals();
              return (
                <div className="mt-4 rounded-xl p-3 text-xs space-y-1" style={{background:'var(--tn-warm)'}}>
                  <div className="flex justify-between" style={{color:'var(--tn-gold)'}}><span>Subtotal</span><span>{fmt(sub)}</span></div>
                  <div className="flex justify-between" style={{color:'var(--tn-gold)'}}><span>TPS 5%</span><span>{fmt(tps)}</span></div>
                  <div className="flex justify-between" style={{color:'var(--tn-gold)'}}><span>TVQ 9.975%</span><span>{fmt(tvq)}</span></div>
                  <div className="flex justify-between font-bold pt-1" style={{borderTop:'0.5px solid var(--tn-border)',color:'var(--tn-dark)'}}><span>Total</span><span>{fmt(total)}</span></div>
                </div>
              );
            })()}

            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNew(false)} className="btn btn-outline flex-1">Cancel</button>
              <button onClick={handleCreate} disabled={!form.invNum}
                className="btn flex-1 justify-center" style={{background:'var(--tn-red)',color:'white',opacity:form.invNum?1:0.5}}>
                Create invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
