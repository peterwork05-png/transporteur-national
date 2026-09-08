import { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { CLIENTS, TPS, TVQ, CONTRACT_RATES } from '../../data/store';

const STATUS_BADGE = { paid:'badge-success', pending:'badge-warning', overdue:'badge-danger', draft:'badge-gray' };
const STATUS_OPTIONS = ['pending','paid','overdue','draft'];

export default function AdminInvoices() {
  const { invoices, addInvoice, fetchInvoices } = useApp();
  const [tab, setTab] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const fileRef = useRef(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genType, setGenType] = useState('local');
  const [genDateFrom, setGenDateFrom] = useState('');
  const [genDateTo, setGenDateTo] = useState('');
  const [genClient, setGenClient] = useState('');
  const [genDays, setGenDays] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);
  const [showEditContract, setShowEditContract] = useState(false);
  const [editDays, setEditDays] = useState(5);
  const [editRoute, setEditRoute] = useState('ontario');
  const [savingContract, setSavingContract] = useState(false);
  const [showClientSelect, setShowClientSelect] = useState(false);
  const [allClients, setAllClients] = useState([]);
  const [savingClient, setSavingClient] = useState(false);
  const [invoiceOrders, setInvoiceOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [addOrderSearch, setAddOrderSearch] = useState('');
  const [addOrderResults, setAddOrderResults] = useState([]);
  const [addingOrder, setAddingOrder] = useState(false);
  const [invoiceExtras, setInvoiceExtras] = useState([]);
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [extraDesc, setExtraDesc] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [addingExtra, setAddingExtra] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreviewData, setEmailPreviewData] = useState(null);
  const [editEmailTo, setEditEmailTo] = useState('');
  const [editEmailSubject, setEditEmailSubject] = useState('');
  const [editEmailNote, setEditEmailNote] = useState('');
  const [showEmailBody, setShowEmailBody] = useState(false);
  const [form, setForm] = useState({ invNum:'', type:'local', route:'ontario', client:'', days:5, dateFrom:'', dateTo:'', amount:'', status:'pending' });
  const [sortBy, setSortBy] = useState('id_desc');
  const [search, setSearch] = useState('');

  const fmt = n => `$${parseFloat(n||0).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const getClientName = inv => CLIENTS[inv.client]?.name || inv.client_name || inv.client || '—';
  const TABS = [['all','All'],['pending','Pending'],['paid','Paid'],['overdue','Overdue'],['draft','Draft']];
  const calcTotals = () => { const sub=(CONTRACT_RATES[form.route]||0)*(form.days||0); return {sub,tps:sub*TPS,tvq:sub*TVQ,total:sub*(1+TPS+TVQ)}; };

  const filtered = invoices
    .filter(inv => tab==='all'?true:inv.status===tab)
    .filter(inv => { if(!search)return true; const s=search.toLowerCase(); return String(inv.id).includes(s)||(inv.client_name||'').toLowerCase().includes(s)||(inv.type||'').toLowerCase().includes(s); })
    .sort((a,b) => {
      switch(sortBy) {
        case 'id_asc': return parseInt(a.id)-parseInt(b.id);
        case 'id_desc': return parseInt(b.id)-parseInt(a.id);
        case 'amount_asc': return parseFloat(a.amount||0)-parseFloat(b.amount||0);
        case 'amount_desc': return parseFloat(b.amount||0)-parseFloat(a.amount||0);
        case 'date_asc': return new Date(a.date_from||0)-new Date(b.date_from||0);
        case 'date_desc': return new Date(b.date_from||0)-new Date(a.date_from||0);
        case 'client': return (a.client_name||'').localeCompare(b.client_name||'');
        default: return parseInt(b.id)-parseInt(a.id);
      }
    });

  const fetchAllClients = async () => {
    try {
      const res = await fetch('/api/clients/portal');
      const data = await res.json();
      const seen = new Set();
      setAllClients((Array.isArray(data)?data:[]).filter(c => { const k=c.client_group||c.id; if(seen.has(k))return false; seen.add(k); return true; }));
    } catch(e) { console.error(e); }
  };

  const handleChangeClient = async (clientId) => {
    setSavingClient(true);
    try {
      await fetch(`/api/invoices/${selected.id}/set-client`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({client_id:clientId||null}) });
      await fetchInvoices();
      const res=await fetch('/api/invoices'); const data=await res.json();
      const updated=data.find(i=>i.id===selected.id);
      if(updated) setSelected(prev=>({...prev,...updated}));
      setShowClientSelect(false);
    } catch(e) { console.error(e); }
    setSavingClient(false);
  };

  const handleSaveContractEdit = async () => {
    setSavingContract(true);
    try {
      const rate=CONTRACT_RATES[editRoute]?.daily||0; const sub=rate*editDays; const tps=sub*TPS; const tvq=sub*TVQ; const total=sub+tps+tvq;
      await fetch(`/api/invoices/${selected.id}/edit-contract`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({days:editDays,route:editRoute,subtotal:sub.toFixed(2),tps:tps.toFixed(2),tvq:tvq.toFixed(2),total:total.toFixed(2)}) });
      await fetchInvoices();
      setSelected(prev=>({...prev,days:editDays,route:editRoute,subtotal:sub.toFixed(2),tps:tps.toFixed(2),tvq:tvq.toFixed(2),total:total.toFixed(2),amount:total}));
      setShowEditContract(false);
    } catch(e) { console.error(e); }
    setSavingContract(false);
  };

  const setCurrentPeriod = () => {
    const today=new Date(); const day=today.getDate(); const year=today.getFullYear(); const month=String(today.getMonth()+1).padStart(2,'0'); const lastDay=new Date(year,today.getMonth()+1,0).getDate();
    if(genType==='contract') {
      const d=new Date(today); const dow=d.getDay(); const monday=new Date(d); monday.setDate(d.getDate()-(dow===0?6:dow-1)); const friday=new Date(monday); friday.setDate(monday.getDate()+4);
      setGenDateFrom(monday.toISOString().split('T')[0]); setGenDateTo(friday.toISOString().split('T')[0]);
    } else {
      if(day<=15){setGenDateFrom(`${year}-${month}-01`);setGenDateTo(`${year}-${month}-15`);}
      else{setGenDateFrom(`${year}-${month}-16`);setGenDateTo(`${year}-${month}-${lastDay}`);}
    }
  };

  const handleGenerateInvoices = async () => {
    if(!genDateFrom||!genDateTo)return; setGenerating(true); setGenResult(null);
    try {
      const endpoint=genType==='contract'?'/api/invoices/generate-contract':'/api/invoices/generate-local';
      const body=genType==='contract'?{dateFrom:genDateFrom,dateTo:genDateTo,days:genDays}:{dateFrom:genDateFrom,dateTo:genDateTo,clientGroup:genClient||undefined};
      const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await res.json(); setGenResult(data); if(data.success)await fetchInvoices();
    } catch(e){setGenResult({success:false,error:e.message});}
    setGenerating(false);
  };

  const handleCreate = async () => {
    let total=parseFloat(form.amount)||0; if(form.type==='contract'&&!form.amount)total=calcTotals().total;
    await addInvoice({id:form.invNum,type:form.type,route:form.route,client:form.client||null,dates:`${form.dateFrom} – ${form.dateTo}`,amount:Math.round(total*100)/100,days:form.days,status:form.status,date_from:form.dateFrom,date_to:form.dateTo});
    await fetchInvoices(); setShowNew(false); setForm({invNum:'',type:'local',route:'ontario',client:'',days:5,dateFrom:'',dateTo:'',amount:'',status:'pending'});
  };

  const handleDelete = async () => {
    if(!window.confirm(`Delete invoice #${selected.id}?`))return; setDeleting(true);
    try { await fetch(`/api/invoices/${selected.id}`,{method:'DELETE'}); await fetchInvoices(); setSelected(null); } catch(e){console.error(e);}
    setDeleting(false);
  };

  const fetchInvoiceOrders = async (invoiceId, invoiceType) => {
    setLoadingOrders(true);
    try {
      const res=await fetch(`/api/invoices/${invoiceId}/orders`); const data=await res.json(); setInvoiceOrders(data.orders||[]);
      if(invoiceType==='local'){await fetch(`/api/invoices/${invoiceId}/recalculate`,{method:'POST'});await fetchInvoices();}
    } catch(e){console.error(e);}
    setLoadingOrders(false);
  };

  const fetchInvoiceExtras = async (invoiceId) => {
    try { const res=await fetch(`/api/invoices/${invoiceId}/extras`); const data=await res.json(); setInvoiceExtras(Array.isArray(data)?data:[]); } catch(e){console.error(e);}
  };

  const handleRemoveOrder = async (orderId) => {
    if(!window.confirm('Remove this order?'))return;
    try { await fetch(`/api/invoices/${selected.id}/orders/${orderId}`,{method:'DELETE'}); await fetchInvoiceOrders(selected.id,'local'); await fetchInvoices(); } catch(e){console.error(e);}
  };

  const handleSearchOrders = async (q) => {
    setAddOrderSearch(q); if(!q||q.length<2){setAddOrderResults([]);return;}
    try { const res=await fetch(`/api/orders/search?q=${encodeURIComponent(q)}`); const data=await res.json(); setAddOrderResults(Array.isArray(data)?data.filter(o=>!invoiceOrders.find(io=>io.id===o.id)):[]); } catch(e){console.error(e);}
  };

  const handleAddOrder = async (orderId) => {
    setAddingOrder(true);
    try {
      await fetch(`/api/invoices/${selected.id}/orders`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order_id:orderId})});
      await fetchInvoiceOrders(selected.id,'local'); await fetchInvoices();
      const res=await fetch('/api/invoices'); const data=await res.json(); const updated=data.find(i=>i.id===selected.id);
      if(updated)setSelected(prev=>({...prev,...updated,amount:parseFloat(updated.total||0)}));
      setAddOrderSearch(''); setAddOrderResults([]); setShowAddOrder(false);
    } catch(e){console.error(e);}
    setAddingOrder(false);
  };

  const handleAddExtra = async () => {
    if(!extraDesc||!extraAmount)return; setAddingExtra(true);
    try {
      await fetch(`/api/invoices/${selected.id}/extras`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({description:extraDesc,amount:parseFloat(extraAmount)})});
      await fetchInvoiceExtras(selected.id); await fetchInvoices();
      const res=await fetch('/api/invoices'); const data=await res.json(); const updated=data.find(i=>i.id===selected.id);
      if(updated)setSelected(prev=>({...prev,...updated}));
      setExtraDesc(''); setExtraAmount(''); setShowAddExtra(false);
    } catch(e){console.error(e);}
    setAddingExtra(false);
  };

  const handleDeleteExtra = async (extraId) => {
    if(!window.confirm('Remove this extra fee?'))return;
    try {
      await fetch(`/api/invoices/${selected.id}/extras/${extraId}`,{method:'DELETE'});
      await fetchInvoiceExtras(selected.id); await fetchInvoices();
      const res=await fetch('/api/invoices'); const data=await res.json(); const updated=data.find(i=>i.id===selected.id);
      if(updated)setSelected(prev=>({...prev,...updated}));
    } catch(e){console.error(e);}
  };

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      await fetch(`/api/invoices/${selected.id}/pay`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(newStatus==='paid'?{eft_number:selected.eft||null}:{status:newStatus})});
      await fetchInvoices(); setSelected(prev=>({...prev,status:newStatus}));
    } catch(e){console.error(e);}
    setUpdatingStatus(false);
  };

  const handleTypeChange = async (newType) => {
    try { await fetch(`/api/invoices/${selected.id}/type`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:newType})}); await fetchInvoices(); setSelected(prev=>({...prev,type:newType})); } catch(e){console.error(e);}
  };

  const handleGeneratePDF = async () => {
    setUploading(true); setUploadMsg('Generating PDF...');
    try {
      const res=await fetch(`/api/invoices/${selected.id}/generate-pdf`,{method:'POST'}); const data=await res.json();
      if(data.success){setUploadMsg('✅ PDF generated!');await fetchInvoices();setSelected(prev=>prev?{...prev,pdf_url:data.pdf_url}:null);}
      else setUploadMsg(`❌ ${data.error}`);
    } catch(e){setUploadMsg(`❌ ${e.message}`);}
    setUploading(false); setTimeout(()=>setUploadMsg(''),4000);
  };

  const handlePreview = () => window.open(`/api/invoices/${selected.id}/preview`,'_blank');

  const handlePDFUpload = async (invoiceId, file) => {
    setUploading(true); setUploadMsg('Uploading PDF...');
    try {
      const reader=new FileReader();
      reader.onload=async(e)=>{
        const base64=e.target.result.split(',')[1];
        const res=await fetch(`/api/invoices/${invoiceId}/upload-pdf`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pdfBase64:base64,filename:file.name})});
        const data=await res.json();
        if(data.success){setUploadMsg('✅ PDF uploaded!');await fetchInvoices();setSelected(prev=>prev?{...prev,pdf_url:data.pdf_url}:null);}
        else setUploadMsg(`❌ ${data.error}`);
        setUploading(false); setTimeout(()=>setUploadMsg(''),3000);
      };
      reader.readAsDataURL(file);
    } catch(err){setUploadMsg(`❌ ${err.message}`);setUploading(false);}
  };

  const handlePreviewEmail = async () => {
    try {
      const res=await fetch(`/api/invoices/${selected.id}/email-preview`); const data=await res.json();
      if(data.success){setEmailPreviewData(data);setEditEmailTo(data.to);setEditEmailSubject(data.subject);setEditEmailNote('');setShowEmailBody(false);setShowEmailPreview(true);}
      else setEmailMsg(`❌ ${data.error}`);
    } catch(e){setEmailMsg(`❌ ${e.message}`);}
  };

  const handleSendEmail = async () => {
    setSendingEmail(true); setEmailMsg('');
    try {
      const res=await fetch(`/api/invoices/${selected.id}/send-email`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:editEmailTo,subject:editEmailSubject,note:editEmailNote})});
      const data=await res.json();
      if(data.success){setEmailMsg(`✅ Sent to ${data.sentTo}`);setShowEmailPreview(false);}else setEmailMsg(`❌ ${data.error}`);
    } catch(e){setEmailMsg(`❌ ${e.message}`);}
    setSendingEmail(false); setTimeout(()=>setEmailMsg(''),5000);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Invoices</h1>
          <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>Manage and upload invoice PDFs</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>{setShowGenerate(true);setGenResult(null);setGenClient('');setGenType('local');setCurrentPeriod();}} className="btn btn-sm" style={{background:'var(--tn-gold)',color:'white'}}>⚡ Generate</button>
          <button onClick={()=>setShowNew(true)} className="btn btn-sm" style={{background:'var(--tn-red)',color:'white'}}>+ New</button>
        </div>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        {TABS.map(([val,label])=>(
          <button key={val} onClick={()=>setTab(val)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{background:tab===val?'var(--tn-red)':'white',color:tab===val?'white':'var(--tn-gold)',border:'0.5px solid var(--tn-border)'}}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <input className="input flex-1 text-sm" placeholder="🔍 Search by invoice #, client, date..." value={search} onChange={e=>setSearch(e.target.value)} style={{minWidth:'180px'}}/>
        <select className="input text-sm flex-shrink-0" value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{width:'auto'}}>
          <option value="id_desc">Invoice # ↓</option><option value="id_asc">Invoice # ↑</option>
          <option value="date_desc">Date ↓</option><option value="date_asc">Date ↑</option>
          <option value="amount_desc">Amount ↓</option><option value="amount_asc">Amount ↑</option>
          <option value="client">Client A→Z</option>
        </select>
      </div>

      {/* Desktop */}
      <div className="card overflow-hidden hidden md:block">
        <table className="w-full">
          <thead><tr style={{borderBottom:'0.5px solid var(--tn-border)'}}>
            {['Invoice #','Type','Client','Period','Amount','Status','PDF'].map(h=>(
              <th key={h} className="text-left text-xs font-medium px-4 py-3" style={{color:'var(--tn-gold)'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((inv,i)=>(
              <tr key={inv.id} onClick={()=>{setSelected(inv);if(inv.type==='local')fetchInvoiceOrders(inv.id,'local');else{setInvoiceOrders([]);fetchInvoiceExtras(inv.id);}}}
                className="cursor-pointer hover:opacity-80" style={{borderBottom:'0.5px solid var(--tn-border)',background:i%2===0?'white':'var(--tn-cream)'}}>
                <td className="px-4 py-3 font-mono text-sm font-semibold" style={{color:'var(--tn-red)'}}>#{inv.id}</td>
                <td className="px-4 py-3"><span className={`badge ${inv.type==='contract'?'badge-info':'badge-gray'}`}>{inv.type==='contract'?`Contract · ${inv.route}`:'Local'}</span></td>
                <td className="px-4 py-3 text-sm">{getClientName(inv)}</td>
                <td className="px-4 py-3 text-sm" style={{color:'var(--tn-gold)'}}>{String(inv.date_from||'').split('T')[0]} – {String(inv.date_to||'').split('T')[0]}</td>
                <td className="px-4 py-3 text-sm font-semibold">{fmt(inv.amount)}</td>
                <td className="px-4 py-3"><span className={`badge ${STATUS_BADGE[inv.status]||'badge-gray'}`}>{inv.status?.charAt(0).toUpperCase()+inv.status?.slice(1)}</span></td>
                <td className="px-4 py-3">{inv.pdf_url?<span className="badge badge-success">📄 PDF</span>:<span className="badge badge-gray">No PDF</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&<div className="text-center py-12 text-sm" style={{color:'var(--tn-gold)'}}>No invoices found</div>}
      </div>

      {/* Mobile */}
      <div className="space-y-2 md:hidden">
        {filtered.map(inv=>(
          <div key={inv.id} className="card p-4 cursor-pointer" onClick={()=>{setSelected(inv);if(inv.type==='local')fetchInvoiceOrders(inv.id,'local');else{setInvoiceOrders([]);fetchInvoiceExtras(inv.id);}}}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-mono text-sm font-bold" style={{color:'var(--tn-red)'}}>#{inv.id}</p>
                <p className="text-sm font-medium mt-0.5">{getClientName(inv)}</p>
                <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>{String(inv.date_from||'').split('T')[0]} – {String(inv.date_to||'').split('T')[0]}</p>
              </div>
              <span className={`badge ${STATUS_BADGE[inv.status]||'badge-gray'} flex-shrink-0`}>{inv.status?.charAt(0).toUpperCase()+inv.status?.slice(1)}</span>
            </div>
            <div className="flex items-center justify-between pt-2" style={{borderTop:'0.5px solid var(--tn-border)'}}>
              <p className="font-semibold text-sm">{fmt(inv.amount)}</p>
              {inv.pdf_url?<span className="badge badge-success">📄 PDF</span>:<span className="badge badge-gray">No PDF</span>}
            </div>
          </div>
        ))}
        {filtered.length===0&&<div className="card p-8 text-center text-sm" style={{color:'var(--tn-gold)'}}>No invoices found</div>}
      </div>

      {/* Invoice detail modal */}
      {selected&&(
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.6)'}} onClick={()=>setSelected(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" style={{background:'var(--tn-cream)'}} onClick={e=>e.stopPropagation()}>
            <div className="px-6 flex items-center justify-between sticky top-0" style={{background:'var(--tn-dark)',paddingTop:'max(16px, env(safe-area-inset-top))',paddingBottom:'16px'}}>
              <div>
                <p className="font-mono text-xs" style={{color:'rgba(250,247,240,0.4)'}}>Invoice #{selected.id}</p>
                <p className="font-semibold" style={{color:'var(--tn-cream)'}}>Invoice details</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${STATUS_BADGE[selected.status]||'badge-gray'}`}>{selected.status?.charAt(0).toUpperCase()+selected.status?.slice(1)}</span>
                <button onClick={()=>setSelected(null)} className="text-xl" style={{color:'rgba(250,247,240,0.4)'}}>×</button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Status */}
              <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs font-medium mb-2" style={{color:'var(--tn-gold)'}}>Status</p>
                <div className="flex gap-1 flex-wrap">
                  {STATUS_OPTIONS.map(s=>(
                    <button key={s} onClick={()=>handleStatusChange(s)} disabled={updatingStatus}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
                      style={{background:selected.status===s?(s==='paid'?'#0F6E56':s==='overdue'?'#991B1B':s==='draft'?'#6B7280':'var(--tn-gold)'):'white',color:selected.status===s?'white':'var(--tn-gold)',border:'0.5px solid var(--tn-border)',opacity:updatingStatus?0.6:1}}>
                      {s==='paid'?'✅ Paid':s==='pending'?'⏳ Pending':s==='overdue'?'🔴 Overdue':'📝 Draft'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type */}
              <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs font-medium mb-2" style={{color:'var(--tn-gold)'}}>Type</p>
                <div className="flex gap-1">
                  {['local','contract'].map(t=>(
                    <button key={t} onClick={()=>handleTypeChange(t)} className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                      style={{background:selected.type===t?'var(--tn-red)':'white',color:selected.type===t?'white':'var(--tn-gold)',border:'0.5px solid var(--tn-border)'}}>
                      {t==='local'?'📦 Local':'🗺️ Contract'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info grid with clickable client */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {label:'Client', val:getClientName(selected), clickable:true},
                  {label:'Type', val:selected.type==='contract'?`Contract · ${selected.route}`:'Local'},
                  {label:'Period', val:`${String(selected.date_from||'').split('T')[0]} – ${String(selected.date_to||'').split('T')[0]}`},
                  selected.type==='contract'&&selected.days?{label:'Days', val:`${selected.days} days`}:null,
                ].filter(Boolean).filter(i=>i.val).map((item,i)=>(
                  <div key={i} className="rounded-xl p-3" style={{background:'var(--tn-warm)',cursor:item.clickable?'pointer':'default'}}
                    onClick={item.clickable?()=>{fetchAllClients();setShowClientSelect(true);}:undefined}>
                    <p className="text-xs" style={{color:'var(--tn-gold)'}}>{item.label} {item.clickable&&<span style={{color:'var(--tn-red)'}}>✏️</span>}</p>
                    <p className="font-semibold text-sm mt-0.5">{item.val}</p>
                  </div>
                ))}
              </div>

              {/* Client selector */}
              {showClientSelect&&(
                <div className="rounded-xl p-4" style={{background:'#EFF6FF',border:'0.5px solid #185FA5'}}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium" style={{color:'#185FA5'}}>Select client</p>
                    <button onClick={()=>setShowClientSelect(false)} className="text-xs" style={{color:'#185FA5'}}>✕ Cancel</button>
                  </div>
                  <select className="input" onChange={e=>handleChangeClient(e.target.value)} disabled={savingClient} defaultValue="">
                    <option value="">— No client (manual invoice) —</option>
                    {allClients.map(c=>(<option key={c.id} value={c.client_group||c.id}>{c.name}</option>))}
                  </select>
                  {savingClient&&<p className="text-xs mt-1" style={{color:'#185FA5'}}>⏳ Saving...</p>}
                </div>
              )}

              {/* Contract edit */}
              {selected.type==='contract'&&(
                <button onClick={()=>{setEditDays(selected.days||5);setEditRoute(selected.route||'ontario');setShowEditContract(true);}} className="btn btn-outline btn-sm w-full justify-center text-xs">
                  ✏️ Edit days / route
                </button>
              )}
              {showEditContract&&selected.type==='contract'&&(
                <div className="rounded-xl p-4" style={{background:'#EFF6FF',border:'0.5px solid #185FA5'}}>
                  <p className="text-xs font-medium mb-3" style={{color:'#185FA5'}}>✏️ Edit contract invoice</p>
                  <div className="space-y-3">
                    <div><label className="label">Route</label>
                      <select className="input" value={editRoute} onChange={e=>setEditRoute(e.target.value)}>
                        <option value="ontario">Ontario / Gatineau ($749.99/day)</option>
                        <option value="quebec">Québec ($585.00/day)</option>
                      </select>
                    </div>
                    <div><label className="label">Days worked</label>
                      <select className="input" value={editDays} onChange={e=>setEditDays(parseInt(e.target.value))}>
                        {[1,2,3,4,5,6].map(d=><option key={d} value={d}>{d} day{d>1?'s':''}</option>)}
                      </select>
                    </div>
                    {(()=>{const rate=CONTRACT_RATES[editRoute]?.daily||0;const sub=rate*editDays;const tps=sub*TPS;const tvq=sub*TVQ;const total=sub+tps+tvq;return(
                      <div className="rounded-lg p-3 text-xs space-y-1" style={{background:'white'}}>
                        <div className="flex justify-between"><span style={{color:'var(--tn-gold)'}}>Subtotal</span><span>{fmt(sub)}</span></div>
                        <div className="flex justify-between"><span style={{color:'var(--tn-gold)'}}>TPS 5%</span><span>{fmt(tps)}</span></div>
                        <div className="flex justify-between"><span style={{color:'var(--tn-gold)'}}>TVQ 9.975%</span><span>{fmt(tvq)}</span></div>
                        <div className="flex justify-between font-bold pt-1" style={{borderTop:'0.5px solid var(--tn-border)'}}><span>Total</span><span style={{color:'var(--tn-red)'}}>{fmt(total)}</span></div>
                      </div>
                    );})()}
                    <div className="flex gap-2">
                      <button onClick={()=>setShowEditContract(false)} className="btn btn-outline flex-1 justify-center text-xs">Cancel</button>
                      <button onClick={handleSaveContractEdit} disabled={savingContract} className="btn flex-1 justify-center text-xs" style={{background:'var(--tn-red)',color:'white',opacity:savingContract?0.6:1}}>
                        {savingContract?'⏳ Saving...':'💾 Save & recalculate'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Extra fees */}
              {selected.type==='contract'&&(
                <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium" style={{color:'var(--tn-gold)'}}>➕ Extra fees</p>
                    <button onClick={()=>setShowAddExtra(true)} className="btn btn-sm text-xs" style={{background:'var(--tn-red)',color:'white'}}>+ Add fee</button>
                  </div>
                  {invoiceExtras.length===0?<p className="text-xs text-center py-2" style={{color:'var(--tn-gold)'}}>No extra fees</p>:(
                    <div className="space-y-2">
                      {invoiceExtras.map(extra=>(
                        <div key={extra.id} className="flex items-center gap-2 p-2 rounded-lg" style={{background:'white'}}>
                          <p className="flex-1 text-xs font-medium">{extra.description}</p>
                          <p className="text-xs font-semibold">${parseFloat(extra.amount||0).toFixed(2)}</p>
                          <button onClick={()=>handleDeleteExtra(extra.id)} className="text-xs px-2 py-1 rounded" style={{background:'#FEE2E2',color:'#991B1B'}}>❌</button>
                        </div>
                      ))}
                      <div className="rounded-lg p-2 text-xs" style={{background:'#FEF3C7',color:'#92400E'}}>⚠️ Click <strong>🔄 Regenerate PDF</strong> to update after changes.</div>
                    </div>
                  )}
                  {showAddExtra&&(
                    <div className="mt-3 rounded-xl p-3" style={{background:'#EFF6FF',border:'0.5px solid #185FA5'}}>
                      <p className="text-xs font-medium mb-2" style={{color:'#185FA5'}}>New extra fee</p>
                      <div className="space-y-2">
                        <select className="input mb-1" value={extraDesc} onChange={e=>setExtraDesc(e.target.value)}>
                          <option value="">— Select —</option>
                          <option value="Extra driver">Extra driver</option>
                          <option value="Extra truck">Extra truck</option>
                          <option value="Fuel surcharge">Fuel surcharge</option>
                          <option value="Other">Other</option>
                        </select>
                        <input className="input" placeholder="Or type custom description..." value={extraDesc} onChange={e=>setExtraDesc(e.target.value)}/>
                        <input type="number" step="0.01" className="input" placeholder="Amount (pre-tax $)" value={extraAmount} onChange={e=>setExtraAmount(e.target.value)}/>
                        <div className="flex gap-2">
                          <button onClick={()=>{setShowAddExtra(false);setExtraDesc('');setExtraAmount('');}} className="btn btn-outline flex-1 justify-center text-xs">Cancel</button>
                          <button onClick={handleAddExtra} disabled={addingExtra||!extraDesc||!extraAmount} className="btn flex-1 justify-center text-xs" style={{background:'var(--tn-red)',color:'white',opacity:addingExtra||!extraDesc||!extraAmount?0.6:1}}>
                            {addingExtra?'⏳...':'+ Add'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Amount breakdown */}
              <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs font-medium mb-3" style={{color:'var(--tn-gold)'}}>Amount breakdown</p>
                {(()=>{
                  const liveSubtotal=selected.type==='local'&&invoiceOrders.length>0?invoiceOrders.reduce((s,o)=>s+parseFloat(o.amount||0),0):null;
                  const sub=liveSubtotal!==null?liveSubtotal:(selected.subtotal?parseFloat(selected.subtotal):parseFloat(selected.amount||0)/(1+TPS+TVQ));
                  const tps=sub*TPS; const tvq=sub*TVQ; const total=sub+tps+tvq;
                  return(<div className="space-y-1.5">
                    <div className="flex justify-between text-sm"><span style={{color:'var(--tn-gold)'}}>Subtotal</span><span>{fmt(sub)}</span></div>
                    <div className="flex justify-between text-sm"><span style={{color:'var(--tn-gold)'}}>TPS (5%)</span><span>{fmt(tps)}</span></div>
                    <div className="flex justify-between text-sm"><span style={{color:'var(--tn-gold)'}}>TVQ (9.975%)</span><span>{fmt(tvq)}</span></div>
                    <div className="flex justify-between font-bold pt-2 text-sm" style={{borderTop:'0.5px solid var(--tn-border)'}}><span>Total</span><span style={{color:'var(--tn-red)'}}>{fmt(total)}</span></div>
                  </div>);
                })()}
              </div>

              {selected.eft&&(
                <div className="rounded-xl p-3 flex items-center gap-2" style={{background:'#E8F5EF'}}>
                  <span>💳</span>
                  <div><p className="text-xs font-medium" style={{color:'#0F6E56'}}>Payment received</p><p className="text-sm font-semibold" style={{color:'#0F6E56'}}>EFT #{selected.eft}</p></div>
                </div>
              )}

              {/* Orders — local only */}
              {selected.type==='local'&&(
                <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium" style={{color:'var(--tn-gold)'}}>📦 Orders included</p>
                    <button onClick={()=>setShowAddOrder(true)} className="btn btn-sm text-xs" style={{background:'var(--tn-red)',color:'white'}}>+ Add order</button>
                  </div>
                  {loadingOrders?<p className="text-xs text-center py-2" style={{color:'var(--tn-gold)'}}>Loading...</p>:invoiceOrders.length===0?<p className="text-xs text-center py-2" style={{color:'var(--tn-gold)'}}>No orders linked</p>:(
                    <div className="space-y-2">
                      {invoiceOrders.map(order=>(
                        <div key={order.id} className="flex items-center gap-2 p-2 rounded-lg" style={{background:'white'}}>
                          <div className="flex-1 min-w-0"><p className="font-mono text-xs" style={{color:'var(--tn-red)'}}>{order.id}</p><p className="text-xs truncate" style={{color:'var(--tn-gold)'}}>{order.address}</p></div>
                          <p className="text-xs font-semibold flex-shrink-0">${parseFloat(order.amount||0).toFixed(2)}</p>
                          <button onClick={()=>handleRemoveOrder(order.id)} className="text-xs flex-shrink-0 px-2 py-1 rounded" style={{background:'#FEE2E2',color:'#991B1B'}}>❌</button>
                        </div>
                      ))}
                      <div className="rounded-lg p-2 text-xs" style={{background:'#FEF3C7',color:'#92400E'}}>⚠️ After changes, click <strong>🔄 Regenerate PDF</strong>.</div>
                    </div>
                  )}
                </div>
              )}

              {showAddOrder&&(
                <div className="rounded-xl p-4" style={{background:'#EFF6FF',border:'0.5px solid #185FA5'}}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium" style={{color:'#185FA5'}}>Search order to add</p>
                    <button onClick={()=>{setShowAddOrder(false);setAddOrderSearch('');setAddOrderResults([]);}} className="text-xs" style={{color:'#185FA5'}}>✕ Cancel</button>
                  </div>
                  <input className="input mb-2" placeholder="Search by order ID, address..." value={addOrderSearch} onChange={e=>handleSearchOrders(e.target.value)}/>
                  {addOrderResults.length>0&&(
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {addOrderResults.map(o=>(
                        <button key={o.id} onClick={()=>handleAddOrder(o.id)} disabled={addingOrder} className="w-full text-left p-2 rounded-lg text-xs" style={{background:'white',border:'0.5px solid #185FA5'}}>
                          <span className="font-mono" style={{color:'var(--tn-red)'}}>{o.id}</span>
                          <span className="ml-2" style={{color:'var(--tn-gold)'}}>{o.address}</span>
                          <span className="float-right font-semibold">${parseFloat(o.amount||0).toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PDF */}
              <div className="rounded-xl p-4" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs font-medium mb-3" style={{color:'var(--tn-gold)'}}>📄 Invoice PDF</p>
                {selected.pdf_url?(
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 rounded-xl" style={{background:'#E8F5EF'}}>
                      <span>📄</span><p className="text-sm font-medium flex-1" style={{color:'#0F6E56'}}>PDF attached</p>
                      <a href={selected.pdf_url} target="_blank" rel="noreferrer" className="btn btn-sm" style={{background:'#0F6E56',color:'white'}}>⬇ Download</a>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleGeneratePDF} disabled={uploading} className="btn btn-outline btn-sm flex-1 justify-center text-xs" style={{opacity:uploading?0.6:1}}>{uploading?'⏳...':'🔄 Regenerate PDF'}</button>
                      <button onClick={handlePreview} className="btn btn-outline btn-sm flex-1 justify-center text-xs">👁 Preview</button>
                    </div>
                  </div>
                ):(
                  <div className="space-y-2">
                    {(selected.type==='local'||selected.type==='contract')&&(
                      <button onClick={handleGeneratePDF} disabled={uploading} className="btn w-full justify-center" style={{background:'var(--tn-red)',color:'white',opacity:uploading?0.6:1}}>
                        {uploading?'⏳ Generating PDF...':'✨ Generate PDF'}
                      </button>
                    )}
                    <button onClick={handlePreview} className="btn btn-outline w-full justify-center text-xs">👁 Preview HTML</button>
                    <div className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer" style={{borderColor:'var(--tn-border-strong)'}} onClick={()=>fileRef.current?.click()}>
                      <p className="text-2xl mb-2">📤</p><p className="text-sm font-medium">Or upload existing PDF</p>
                      <p className="text-xs mt-1" style={{color:'var(--tn-gold)'}}>Click to select PDF file</p>
                    </div>
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)handlePDFUpload(selected.id,file);e.target.value='';}}/>
                {uploadMsg&&<p className="text-xs mt-2 text-center font-medium" style={{color:uploadMsg.includes('✅')?'#0F6E56':'#991B1B'}}>{uploadMsg}</p>}
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <button onClick={handleDelete} disabled={deleting} className="btn btn-sm px-3" style={{background:'#FEE2E2',color:'#991B1B'}}>{deleting?'...':'🗑 Delete'}</button>
                <button onClick={()=>setSelected(null)} className="btn btn-outline flex-1 justify-center">Close</button>
                {selected.pdf_url&&(
                  <>
                    <button onClick={handlePreviewEmail} className="btn flex-1 justify-center" style={{background:'#0F6E56',color:'white'}}>📧 Send to client</button>
                    <a href={selected.pdf_url} target="_blank" rel="noreferrer" className="btn flex-1 justify-center" style={{background:'var(--tn-red)',color:'white'}}>⬇ PDF</a>
                  </>
                )}
              </div>
              {emailMsg&&<p className="text-xs mt-2 text-center font-medium" style={{color:emailMsg.includes('✅')?'#0F6E56':'#991B1B'}}>{emailMsg}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Email modal */}
      {showEmailPreview&&emailPreviewData&&(
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.7)'}}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{background:'var(--tn-cream)'}}>
            <div className="px-5 py-4 flex items-center justify-between sticky top-0" style={{background:'var(--tn-dark)',borderRadius:'16px 16px 0 0'}}>
              <p className="font-semibold" style={{color:'var(--tn-cream)'}}>📧 Email preview & edit</p>
              <button onClick={()=>setShowEmailPreview(false)} className="text-xl" style={{color:'rgba(250,247,240,0.4)'}}>×</button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">To</label><input className="input" value={editEmailTo} onChange={e=>setEditEmailTo(e.target.value)} placeholder="email@company.com"/><p className="text-xs mt-1" style={{color:'var(--tn-gold)'}}>Separate multiple emails with commas</p></div>
              <div><label className="label">Subject</label><input className="input" value={editEmailSubject} onChange={e=>setEditEmailSubject(e.target.value)}/></div>
              <div className="rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs mb-2 font-medium" style={{color:'var(--tn-gold)'}}>Invoice details</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm"><span style={{color:'var(--tn-gold)'}}>Invoice #</span><span className="font-medium">#{emailPreviewData.invoiceId}</span></div>
                  <div className="flex justify-between text-sm"><span style={{color:'var(--tn-gold)'}}>Period</span><span className="font-medium">{emailPreviewData.dateFrom} – {emailPreviewData.dateTo}</span></div>
                  <div className="flex justify-between text-sm font-bold pt-1" style={{borderTop:'0.5px solid var(--tn-border)'}}><span>Total</span><span style={{color:'var(--tn-red)'}}>{emailPreviewData.total}</span></div>
                </div>
              </div>
              <div><label className="label">Personal note (optional)</label><textarea className="input" rows={3} placeholder="Add a personal message..." value={editEmailNote} onChange={e=>setEditEmailNote(e.target.value)} style={{resize:'none'}}/></div>
              <div className="rounded-xl overflow-hidden" style={{border:'0.5px solid var(--tn-border)'}}>
                <button onClick={()=>setShowEmailBody(p=>!p)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium" style={{background:'var(--tn-warm)'}}>
                  <span>👁 Preview full email</span><span style={{color:'var(--tn-gold)'}}>{showEmailBody?'▲ Hide':'▼ Show'}</span>
                </button>
                {showEmailBody&&(
                  <div className="p-4 text-xs space-y-2" style={{background:'white',color:'#1A1208',lineHeight:'1.6'}}>
                    {editEmailNote&&<div style={{background:'#FEF3C7',borderRadius:'6px',padding:'8px',border:'1px solid #D97706'}}><p style={{color:'#92400E',margin:0}}>{editEmailNote}</p></div>}
                    <p>Bonjour / Hello,</p>
                    <p>Veuillez trouver ci-joint votre facture. / Please find your invoice below.</p>
                    <div style={{background:'#FAF7F0',borderRadius:'8px',padding:'12px',border:'1px solid #e0d9cc',margin:'8px 0'}}>
                      <p style={{margin:'2px 0'}}><strong>Invoice #:</strong> #{emailPreviewData.invoiceId}</p>
                      <p style={{margin:'2px 0'}}><strong>Period:</strong> {emailPreviewData.dateFrom} – {emailPreviewData.dateTo}</p>
                      <p style={{margin:'8px 0 2px',fontWeight:'bold',color:'#C0392B'}}><strong>TOTAL: {emailPreviewData.total}</strong></p>
                    </div>
                    <p>Merci / Thank you,<br/><strong>Transporteur National MC INC.</strong></p>
                  </div>
                )}
              </div>
              {emailMsg&&<p className="text-xs text-center font-medium" style={{color:emailMsg.includes('✅')?'#0F6E56':'#991B1B'}}>{emailMsg}</p>}
              <div className="flex gap-2">
                <button onClick={()=>setShowEmailPreview(false)} className="btn btn-outline flex-1 justify-center">Cancel</button>
                <button onClick={handleSendEmail} disabled={sendingEmail||!editEmailTo} className="btn flex-1 justify-center" style={{background:'#0F6E56',color:'white',opacity:sendingEmail||!editEmailTo?0.7:1}}>
                  {sendingEmail?'⏳ Sending...':'📧 Send now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate modal */}
      {showGenerate&&(
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.6)'}}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto" style={{background:'var(--tn-cream)'}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">⚡ Generate invoices</h2>
              <button onClick={()=>setShowGenerate(false)} className="text-xl" style={{color:'var(--tn-gold)'}}>×</button>
            </div>
            <div className="flex gap-1 p-1 rounded-xl mb-4" style={{background:'var(--tn-warm)'}}>
              {[['local','📦 Local'],['contract','🗺️ Contract']].map(([val,label])=>(
                <button key={val} onClick={()=>{setGenType(val);setGenResult(null);}} className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{background:genType===val?'var(--tn-red)':'transparent',color:genType===val?'white':'var(--tn-gold)'}}>
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              <button onClick={setCurrentPeriod} className="btn btn-outline btn-sm text-xs">{genType==='contract'?'Previous week':'Current period'}</button>
              {genType==='local'&&(<div><label className="label">Client</label><select className="input" value={genClient} onChange={e=>setGenClient(e.target.value)}><option value="">All clients</option><option value="beg">Bureau en Gros only</option><option value="jonarts">Jonarts only</option><option value="aebath">A&E Bath only</option></select></div>)}
              {genType==='contract'&&(<div><label className="label">Days worked</label><select className="input" value={genDays} onChange={e=>setGenDays(parseInt(e.target.value))}>{[1,2,3,4,5,6].map(d=><option key={d} value={d}>{d} day{d>1?'s':''}</option>)}</select></div>)}
              <div><label className="label">From</label><input type="date" className="input" value={genDateFrom} onChange={e=>setGenDateFrom(e.target.value)}/></div>
              <div><label className="label">To</label><input type="date" className="input" value={genDateTo} onChange={e=>setGenDateTo(e.target.value)}/></div>
            </div>
            {genResult&&(
              <div className="mt-4 rounded-xl p-3" style={{background:genResult.success?'#E8F5EF':'#FEE2E2'}}>
                {genResult.success?(<><p className="text-sm font-medium" style={{color:'#0F6E56'}}>✅ {genResult.invoices?.length||0} invoice(s) generated!</p>{genResult.invoices?.map((inv,i)=>(<p key={i} className="text-xs mt-1" style={{color:'#0F6E56'}}>#{inv.invoiceId} — {inv.clientName||inv.route} — ${inv.total}</p>))}</>):(<p className="text-sm" style={{color:'#991B1B'}}>❌ {genResult.error}</p>)}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowGenerate(false)} className="btn btn-outline flex-1 justify-center">{genResult?.success?'Close':'Cancel'}</button>
              {!genResult?.success&&(<button onClick={handleGenerateInvoices} disabled={generating||!genDateFrom||!genDateTo} className="btn flex-1 justify-center" style={{background:'var(--tn-red)',color:'white',opacity:generating||!genDateFrom||!genDateTo?0.6:1}}>{generating?'⏳ Generating...':'⚡ Generate'}</button>)}
            </div>
          </div>
        </div>
      )}

      {/* New invoice modal */}
      {showNew&&(
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.6)'}}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" style={{background:'var(--tn-cream)'}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">New invoice</h2>
              <button onClick={()=>setShowNew(false)} className="text-xl leading-none" style={{color:'var(--tn-gold)'}}>×</button>
            </div>
            <div className="space-y-3">
              <div><label className="label">Invoice #</label><input className="input" placeholder="e.g. 607" value={form.invNum} onChange={e=>setForm(f=>({...f,invNum:e.target.value}))}/></div>
              <div><label className="label">Type</label><select className="input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option value="local">Local deliveries</option><option value="contract">Contract route</option></select></div>
              {form.type==='contract'&&(<div><label className="label">Route</label><select className="input" value={form.route} onChange={e=>setForm(f=>({...f,route:e.target.value}))}><option value="ontario">Ontario / Gatineau ($749.99/day)</option><option value="quebec">Québec ($585.00/day)</option></select></div>)}
              <div><label className="label">Client (optional)</label><select className="input" value={form.client} onChange={e=>setForm(f=>({...f,client:e.target.value}))}><option value="">— No client —</option>{Object.values(CLIENTS).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">From</label><input type="date" className="input" value={form.dateFrom} onChange={e=>setForm(f=>({...f,dateFrom:e.target.value}))}/></div>
                <div><label className="label">To</label><input type="date" className="input" value={form.dateTo} onChange={e=>setForm(f=>({...f,dateTo:e.target.value}))}/></div>
              </div>
              {form.type==='contract'&&(<div><label className="label">Days driven</label><select className="input" value={form.days} onChange={e=>setForm(f=>({...f,days:parseInt(e.target.value)}))}>{[1,2,3,4,5,6].map(d=><option key={d} value={d}>{d} day{d>1?'s':''}</option>)}</select></div>)}
              {form.type==='contract'&&(<div><label className="label">Total amount (leave blank to auto-calculate)</label><input type="number" className="input" placeholder="e.g. 4311.51" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/></div>)}
              {form.type==='local'&&(<div className="rounded-xl p-3" style={{background:'#EFF6FF',border:'0.5px solid #185FA5'}}><p className="text-xs" style={{color:'#185FA5'}}>ℹ️ Amount calculated automatically when you open the invoice.</p></div>)}
              <div><label className="label">Status</label><select className="input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}><option value="pending">Pending</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select></div>
            </div>
            {form.type==='contract'&&!form.amount&&(()=>{const{sub,tps,tvq,total}=calcTotals();return(<div className="mt-4 rounded-xl p-3 text-xs space-y-1" style={{background:'var(--tn-warm)'}}><div className="flex justify-between" style={{color:'var(--tn-gold)'}}><span>Subtotal</span><span>{fmt(sub)}</span></div><div className="flex justify-between" style={{color:'var(--tn-gold)'}}><span>TPS 5%</span><span>{fmt(tps)}</span></div><div className="flex justify-between" style={{color:'var(--tn-gold)'}}><span>TVQ 9.975%</span><span>{fmt(tvq)}</span></div><div className="flex justify-between font-bold pt-1" style={{borderTop:'0.5px solid var(--tn-border)',color:'var(--tn-dark)'}}><span>Total</span><span>{fmt(total)}</span></div></div>);})()}
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowNew(false)} className="btn btn-outline flex-1">Cancel</button>
              <button onClick={handleCreate} disabled={!form.invNum} className="btn flex-1 justify-center" style={{background:'var(--tn-red)',color:'white',opacity:form.invNum?1:0.5}}>Create invoice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
