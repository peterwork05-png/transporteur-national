import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CLIENTS } from '../../data/store';

const HISTORY_STATIC = [
  { eft:'5044508', date:'June 25, 2026', client:'Bureau en Gros', invoices:['#558 ($3,363.02)','#559 ($4,311.51)'], total:7674.53 },
  { eft:'5044191', date:'June 18, 2026', client:'Bureau en Gros', invoices:['#551 ($1,379.80)','#553 ($3,363.02)'], total:9054.33 },
];

export default function AdminPayments() {
  const { invoices, markInvoicePaid, fetchInvoices } = useApp();
  const [tab,        setTab]        = useState('gmail');
  const [eftNo,      setEftNo]      = useState('');
  const [payDate,    setPayDate]    = useState('');
  const [amount,     setAmount]     = useState('');
  const [checked,    setChecked]    = useState(new Set());
  const [gmailStatus,setGmailStatus]= useState(null);
  const [checking,   setChecking]   = useState(false);
  const [gmailResult,setGmailResult]= useState(null);
  const [stats,      setStats]      = useState({ collected_ytd:0, pending:0, overdue:0 });

  useEffect(() => {
    fetch('/api/gmail/status').then(r=>r.json()).then(setGmailStatus).catch(()=>{});
    fetch('/api/stats/payments').then(r=>r.json()).then(setStats).catch(()=>{});
  }, []);

  // Refresh stats when invoices change
  useEffect(() => {
    fetch('/api/stats/payments').then(r=>r.json()).then(setStats).catch(()=>{});
  }, [invoices]);

  const runGmailCheck = async () => {
    setChecking(true);
    setGmailResult(null);
    try {
      const res = await fetch('/api/gmail/check', { method:'POST' });
      const data = await res.json();
      setGmailResult(data);
      if (data.matched?.length > 0) await fetchInvoices();
    } catch (err) {
      setGmailResult({ errors: [err.message] });
    }
    setChecking(false);
  };

  const unpaid = invoices.filter(i => i.status !== 'paid');
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const selectedTotal = Array.from(checked).reduce((s, id) => {
    const inv = invoices.find(i => i.id === id);
    return s + (parseFloat(inv?.amount)||0);
  }, 0);
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

  const fmt = n => `$${parseFloat(n||0).toLocaleString('en-CA',{minimumFractionDigits:2, maximumFractionDigits:2})}`;
  const pendingTotal = unpaid.filter(i=>i.status==='pending').reduce((s,i)=>s+parseFloat(i.amount||0),0);
  const overdueTotal = unpaid.filter(i=>i.status==='overdue').reduce((s,i)=>s+parseFloat(i.amount||0),0);

  const TABS = [
    ['gmail',   '📧 Gmail auto-match'],
    ['record',  '✏️ Record manually'],
    ['history', '📋 Payment history'],
    ['pending', '⏳ Pending'],
  ];

  const getClientName = (inv) => CLIENTS[inv.client]?.name || inv.client_name || inv.client || '—';

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Payment tracker</h1>
        <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>EFT remittance matching</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          {val:fmt(stats.collected_ytd), label:'Collected YTD', color:'#0F6E56'},
          {val:fmt(stats.pending),       label:'Pending',        color:'var(--tn-gold)'},
          {val:fmt(stats.overdue),       label:'Overdue',        color:'#991B1B'},
        ].map((k,i)=>(
          <div key={i} className="card p-3 md:p-4">
            <div className="text-lg md:text-2xl font-semibold" style={{color:k.color}}>{k.val}</div>
            <div className="text-xs mt-1" style={{color:'var(--tn-gold)'}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map(([val,label])=>(
          <button key={val} onClick={()=>setTab(val)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{background:tab===val?'var(--tn-red)':'white', color:tab===val?'white':'var(--tn-gold)', border:'0.5px solid var(--tn-border)'}}>
            {label}
          </button>
        ))}
      </div>

      {/* Gmail auto-match tab */}
      {tab==='gmail' && (
        <div className="max-w-2xl space-y-4">
          {/* Gmail status */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-sm">Gmail auto-matching</h2>
                <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>
                  Scans your inbox for remittance emails and matches them to pending invoices automatically
                </p>
              </div>
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${gmailStatus?.configured ? 'bg-green-500' : 'bg-gray-300'}`} />
            </div>

            {gmailStatus?.configured ? (
              <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={{background:'#E8F5EF'}}>
                <span>✅</span>
                <div>
                  <p className="text-xs font-medium" style={{color:'#0F6E56'}}>Gmail connected</p>
                  <p className="text-xs" style={{color:'#0F6E56'}}>{gmailStatus.email}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-3 mb-4" style={{background:'#FEF3C7'}}>
                <p className="text-xs font-medium" style={{color:'#92400E'}}>⚠️ Gmail not configured — add GMAIL_USER and GMAIL_APP_PASSWORD to Railway variables</p>
              </div>
            )}

            <button onClick={runGmailCheck} disabled={checking || !gmailStatus?.configured}
              className="btn w-full justify-center"
              style={{background:gmailStatus?.configured?'var(--tn-red)':'var(--tn-warm)', color:gmailStatus?.configured?'white':'var(--tn-gold)'}}>
              {checking ? '📧 Scanning Gmail...' : '📧 Scan Gmail for remittances'}
            </button>
          </div>

          {/* Results */}
          {gmailResult && (
            <div className="card p-4 space-y-3">
              <h3 className="font-semibold text-sm">Scan results</h3>

              {gmailResult.matched?.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{color:'#0F6E56'}}>✅ Auto-matched ({gmailResult.matched.length})</p>
                  {gmailResult.matched.map((m,i)=>(
                    <div key={i} className="rounded-xl p-3 mb-2" style={{background:'#E8F5EF'}}>
                      {m.status === 'already_processed' ? (
                        <p className="text-xs" style={{color:'#0F6E56'}}>EFT #{m.eftNumber} — already processed</p>
                      ) : (
                        <>
                          <p className="text-sm font-medium" style={{color:'#0F6E56'}}>EFT #{m.eftNumber} — {fmt(m.amount)}</p>
                          <p className="text-xs mt-0.5" style={{color:'#0F6E56'}}>Invoices matched: #{m.invoicesMatched?.join(', #')}</p>
                          {m.emailFrom && <p className="text-xs mt-0.5" style={{color:'#0F6E56'}}>From: {m.emailFrom}</p>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {gmailResult.unmatched?.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{color:'#92400E'}}>⚠️ Could not match ({gmailResult.unmatched.length})</p>
                  {gmailResult.unmatched.map((m,i)=>(
                    <div key={i} className="rounded-xl p-3 mb-2" style={{background:'#FEF3C7'}}>
                      <p className="text-sm font-medium" style={{color:'#92400E'}}>
                        {m.eftNumber ? `EFT #${m.eftNumber}` : 'Unknown EFT'} — {m.amount ? fmt(m.amount) : 'Amount unknown'}
                      </p>
                      <p className="text-xs mt-0.5" style={{color:'#92400E'}}>{m.reason}</p>
                      {m.emailFrom && <p className="text-xs mt-0.5" style={{color:'#92400E'}}>From: {m.emailFrom}</p>}
                    </div>
                  ))}
                  <p className="text-xs mt-2" style={{color:'var(--tn-gold)'}}>Use "Record manually" tab to match these</p>
                </div>
              )}

              {gmailResult.message && (
                <p className="text-sm text-center py-3" style={{color:'var(--tn-gold)'}}>{gmailResult.message}</p>
              )}

              {gmailResult.errors?.length > 0 && (
                <div className="rounded-xl p-3" style={{background:'#FEE2E2'}}>
                  <p className="text-xs font-medium" style={{color:'#991B1B'}}>Error: {gmailResult.errors.join(', ')}</p>
                </div>
              )}

              {gmailResult.matched?.length === 0 && gmailResult.unmatched?.length === 0 && !gmailResult.message && !gmailResult.errors?.length && (
                <p className="text-sm text-center py-3" style={{color:'var(--tn-gold)'}}>No new remittance emails found in the last 30 days</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Manual record tab */}
      {tab==='record' && (
        <div className="max-w-2xl space-y-4">
          <div className="card p-4">
            <h2 className="font-medium text-sm mb-3">Enter remittance details</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="label">EFT No.</label><input className="input" placeholder="e.g. 5044508" value={eftNo} onChange={e=>setEftNo(e.target.value)}/></div>
              <div><label className="label">Payment date</label><input type="date" className="input" value={payDate} onChange={e=>setPayDate(e.target.value)}/></div>
            </div>
            <div><label className="label">Total amount received ($)</label><input type="number" className="input" placeholder="e.g. 7674.53" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
          </div>

          {isMatch    && <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{background:'#E8F5EF',color:'#0F6E56'}}>✅ Amount matches — ready to confirm</div>}
          {isMismatch && <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{background:'#FEE2E2',color:'#991B1B'}}>⚠️ Mismatch — entered {fmt(enteredAmount)}, selected {fmt(selectedTotal)}</div>}

          <div className="card p-4">
            <h2 className="font-medium text-sm mb-3">Select invoices covered</h2>
            {unpaid.length===0
              ? <p className="text-sm text-center py-4" style={{color:'var(--tn-gold)'}}>All invoices paid ✓</p>
              : unpaid.map(inv=>(
                <label key={inv.id} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer mb-1" style={{background:'var(--tn-warm)'}}>
                  <div onClick={()=>toggleCheck(inv.id)}
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                    style={{background:checked.has(inv.id)?'var(--tn-red)':'white', border:`1.5px solid ${checked.has(inv.id)?'var(--tn-red)':'var(--tn-border-strong)'}`}}>
                    {checked.has(inv.id)&&<svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Invoice #{inv.id} — {inv.type==='contract'?`${inv.route} route`:'Local'}</p>
                    <p className="text-xs" style={{color:'var(--tn-gold)'}}>{getClientName(inv)} · {inv.dates}</p>
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

      {/* History tab */}
      {tab==='history' && (
        <div className="card overflow-hidden max-w-2xl">
          {paidInvoices.length === 0 && HISTORY_STATIC.length === 0 && (
            <div className="text-center py-12 text-sm" style={{color:'var(--tn-gold)'}}>No payment history yet</div>
          )}
          {/* Real paid invoices from DB */}
          {paidInvoices.map((inv,i)=>(
            <div key={inv.id} className="flex items-start gap-3 p-4" style={{borderBottom:'0.5px solid var(--tn-border)'}}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'#E8F5EF'}}>✅</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">Invoice #{inv.id} — {getClientName(inv)}</p>
                  <span className="badge badge-success">Paid</span>
                </div>
                <p className="text-xs" style={{color:'var(--tn-gold)'}}>
                  {inv.dates} · {fmt(inv.amount)}
                  {inv.eft ? ` · EFT #${inv.eft}` : ''}
                </p>
              </div>
            </div>
          ))}
          {/* Static history */}
          {HISTORY_STATIC.map((h,i)=>(
            <div key={i} className="flex items-start gap-3 p-4" style={{borderBottom:'0.5px solid var(--tn-border)'}}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'#E8F5EF'}}>✅</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">EFT #{h.eft} — {h.client}</p>
                  <span className="badge badge-success">Paid</span>
                </div>
                <p className="text-xs" style={{color:'var(--tn-gold)'}}>{h.invoices.join(' + ')} · {h.date} · {fmt(h.total)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending tab */}
      {tab==='pending' && (
        <div className="card overflow-hidden max-w-2xl">
          {unpaid.length===0
            ? <div className="text-center py-12 text-sm" style={{color:'var(--tn-gold)'}}>All invoices paid ✓</div>
            : unpaid.map(inv=>(
              <div key={inv.id} className="flex items-center gap-3 p-4" style={{borderBottom:'0.5px solid var(--tn-border)'}}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">Invoice #{inv.id} — {inv.type==='contract'?`${inv.route} route`:'Local'}</p>
                    <span className={`badge ${inv.status==='overdue'?'badge-danger':'badge-warning'}`}>{inv.status}</span>
                  </div>
                  <p className="text-xs" style={{color:'var(--tn-gold)'}}>{getClientName(inv)} · {inv.dates} · {fmt(inv.amount)}</p>
                </div>
                <ReminderButton inv={inv} getClientName={getClientName} fmt={fmt} />
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

function ReminderButton({ inv, getClientName, fmt }) {
  const [sending,       setSending]       = useState(false);
  const [sent,          setSent]          = useState(false);
  const [error,         setError]         = useState(null);
  const [preview,       setPreview]       = useState(null);
  const [loadingPreview,setLoadingPreview]= useState(false);

  // Editable fields
  const [editTo,      setEditTo]      = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editNote,    setEditNote]    = useState('');

  const loadPreview = async () => {
    setLoadingPreview(true);
    try {
      const res  = await fetch('/api/invoices/reminder-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: inv.id }),
      });
      const data = await res.json();
      if (data.success) {
        setPreview(data);
        setEditTo(data.to);
        setEditSubject(data.subject);
        setEditNote('');
      } else { setError(data.error || 'Could not load preview'); }
    } catch(e) { setError(e.message); }
    setLoadingPreview(false);
  };

  const sendReminder = async () => {
    setSending(true);
    setError(null);
    try {
      const res  = await fetch('/api/invoices/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: inv.id, to: editTo, subject: editSubject, note: editNote }),
      });
      const data = await res.json();
      if (data.success) { setSent(true); setPreview(null); }
      else { setError(data.error || 'Failed to send'); }
    } catch(e) { setError(e.message); }
    setSending(false);
  };

  if (sent) return <span className="text-xs font-medium flex-shrink-0" style={{color:'#0F6E56'}}>✅ Sent!</span>;
  if (error) return <span className="text-xs flex-shrink-0" style={{color:'#991B1B'}}>❌ {error}</span>;

  return (
    <>
      <button onClick={loadPreview} disabled={loadingPreview}
        className="btn btn-outline btn-sm flex-shrink-0"
        style={{opacity:loadingPreview?0.6:1}}>
        {loadingPreview ? '...' : '📧 Remind'}
      </button>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.7)'}}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{background:'var(--tn-cream)'}}>
            
            <div className="px-5 py-4 flex items-center justify-between sticky top-0" style={{background:'var(--tn-dark)',borderRadius:'16px 16px 0 0'}}>
              <p className="font-semibold" style={{color:'var(--tn-cream)'}}>📧 Email preview & edit</p>
              <button onClick={() => setPreview(null)} className="text-xl" style={{color:'rgba(250,247,240,0.4)'}}>×</button>
            </div>

            <div className="p-5 space-y-4">

              {/* Editable To field */}
              <div>
                <label className="label">To (edit to add/remove recipients)</label>
                <input className="input" value={editTo} onChange={e=>setEditTo(e.target.value)}
                  placeholder="email@company.com, email2@company.com" />
                <p className="text-xs mt-1" style={{color:'var(--tn-gold)'}}>Separate multiple emails with commas</p>
              </div>

              {/* Editable Subject */}
              <div>
                <label className="label">Subject</label>
                <input className="input" value={editSubject} onChange={e=>setEditSubject(e.target.value)} />
              </div>

              {/* Invoice summary — read only */}
              <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs mb-2 font-medium" style={{color:'var(--tn-gold)'}}>Invoice details (auto-included)</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span style={{color:'var(--tn-gold)'}}>Invoice #</span>
                    <span className="font-medium">#{inv.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{color:'var(--tn-gold)'}}>Period</span>
                    <span className="font-medium">{preview.dateFrom} – {preview.dateTo}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{color:'var(--tn-gold)'}}>Type</span>
                    <span className="font-medium">{inv.type==='contract'?`Contract · ${inv.route} route`:'Local deliveries'}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-1" style={{borderTop:'0.5px solid var(--tn-border)'}}>
                    <span>Total due</span>
                    <span style={{color:'var(--tn-red)'}}>{preview.total}</span>
                  </div>
                </div>
              </div>

              {/* Personal note */}
              <div>
                <label className="label">Personal note (optional)</label>
                <textarea className="input" rows={3}
                  placeholder="Add a personal message... e.g. Please don't hesitate to call if you have any questions."
                  value={editNote} onChange={e=>setEditNote(e.target.value)}
                  style={{resize:'none', minHeight:'80px'}} />
                <p className="text-xs mt-1" style={{color:'var(--tn-gold)'}}>This will appear at the top of the email</p>
              </div>

              {/* PDF note */}
              {preview.hasPdf && (
                <div className="rounded-xl p-3 flex items-center gap-2" style={{background:'#E8F5EF'}}>
                  <span>📄</span>
                  <p className="text-sm" style={{color:'#0F6E56'}}>PDF invoice link will be included automatically</p>
                </div>
              )}

              <div className="rounded-xl p-3" style={{background:'#EFF6FF'}}>
                <p className="text-xs" style={{color:'#185FA5'}}>ℹ️ Email is sent in both French and English</p>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setPreview(null)} className="btn btn-outline flex-1 justify-center">
                  Cancel
                </button>
                <button onClick={sendReminder} disabled={sending || !editTo}
                  className="btn flex-1 justify-center" style={{background:'var(--tn-red)',color:'white',opacity:sending||!editTo?0.7:1}}>
                  {sending ? 'Sending...' : '📧 Send reminder'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
