import { useState } from 'react';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export default function AdminImport() {
  const [month,    setMonth]    = useState(new Date().getMonth() + 1);
  const [year,     setYear]     = useState(new Date().getFullYear());
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);

  const runImport = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/import/woocommerce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data);
    } catch(e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Import WooCommerce orders</h1>
        <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>Pull historical orders directly from your WordPress site</p>
      </div>

      <div className="card p-5 mb-4">
        <h2 className="font-semibold text-sm mb-4">Select period to import</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">Month</label>
            <select className="input" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
              {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select className="input" value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-xl p-3 mb-4" style={{background:'#FEF3C7'}}>
          <p className="text-xs font-medium" style={{color:'#92400E'}}>⚠️ Important</p>
          <p className="text-xs mt-1" style={{color:'#92400E'}}>
            Orders already in the system will be skipped automatically. Safe to run multiple times.
          </p>
        </div>

        <button onClick={runImport} disabled={loading}
          className="btn w-full justify-center"
          style={{background:'var(--tn-red)', color:'white', opacity:loading?0.7:1}}>
          {loading ? '📦 Importing orders...' : `📦 Import ${MONTHS[month-1]} ${year} orders`}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-sm">Import complete!</h2>

          <div className="grid grid-cols-3 gap-3">
            {[
              {label:'Total found',  val:result.total,    color:'var(--tn-gold)'},
              {label:'Imported',     val:result.imported, color:'#0F6E56'},
              {label:'Already existed', val:result.skipped, color:'#185FA5'},
            ].map((s,i) => (
              <div key={i} className="rounded-xl p-3 text-center" style={{background:'var(--tn-warm)'}}>
                <p className="text-2xl font-bold" style={{color:s.color}}>{s.val}</p>
                <p className="text-xs mt-1" style={{color:'var(--tn-gold)'}}>{s.label}</p>
              </div>
            ))}
          </div>

          {result.errors > 0 && (
            <div className="rounded-xl p-3" style={{background:'#FEE2E2'}}>
              <p className="text-xs font-medium" style={{color:'#991B1B'}}>{result.errors} orders had errors — check Railway logs</p>
            </div>
          )}

          {result.sample?.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{color:'var(--tn-gold)'}}>Sample of imported orders:</p>
              {result.sample.map((o,i) => (
                <div key={i} className="flex items-center justify-between py-2" style={{borderBottom:'0.5px solid var(--tn-border)'}}>
                  <div>
                    <p className="text-sm font-mono" style={{color:'var(--tn-red)'}}>{o.id}</p>
                    <p className="text-xs truncate" style={{color:'var(--tn-gold)'}}>{o.address}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">${parseFloat(o.amount).toFixed(2)}</p>
                    <span className="badge badge-gray text-xs">{o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-center" style={{color:'var(--tn-gold)'}}>
            Go to Local orders → All orders tab to see everything
          </p>
        </div>
      )}

      {error && (
        <div className="card p-4" style={{background:'#FEE2E2'}}>
          <p className="text-sm font-medium" style={{color:'#991B1B'}}>Error: {error}</p>
        </div>
      )}
    </div>
  );
}
