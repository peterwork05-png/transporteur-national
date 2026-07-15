import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

const DRIVER_PATHS = {
  local:   (id) => `/driver/local/${id}`,
  ontario: ()   => '/driver/ontario',
  quebec:  ()   => '/driver/quebec',
};

function PinPad({ title, subtitle, onBack, onPinComplete, onSuccess }) {
  const [pin,     setPin]     = useState('');
  const [error,   setError]   = useState('');
  const [shake,   setShake]   = useState(false);
  const [loading, setLoading] = useState(false);

  const submitPin = useCallback(async (p) => {
    setLoading(true);
    const result = await onPinComplete(p);
    setLoading(false);
    if (result.success) {
      onSuccess(result);
    } else {
      setShake(true);
      setError('Incorrect PIN');
      setTimeout(() => { setPin(''); setShake(false); setError(''); }, 700);
    }
  }, [onPinComplete, onSuccess]);

  const handleDigit = useCallback((d) => {
    if (loading) return;
    setPin(prev => {
      if (prev.length >= 4) return prev;
      const next = prev + d;
      if (next.length === 4) {
        setTimeout(() => submitPin(next), 100);
      }
      return next;
    });
    setError('');
  }, [loading, submitPin]);

  const handleDelete = useCallback(() => {
    if (!loading) { setPin(p => p.slice(0, -1)); setError(''); }
  }, [loading]);

  // ── Keyboard support ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      else if (e.key === 'Backspace' || e.key === 'Delete') handleDelete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleDigit, handleDelete]);

  const rows = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];

  return (
    <div className="w-full max-w-xs mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-sm mb-6"
        style={{color:'rgba(250,247,240,0.4)'}}>← Back</button>

      <div className="text-center mb-8">
        <p className="text-lg font-semibold mb-1" style={{color:'var(--tn-cream)'}}>{title}</p>
        <p className="text-sm" style={{color:'rgba(250,247,240,0.35)'}}>{subtitle}</p>
        <p className="text-xs mt-1" style={{color:'rgba(250,247,240,0.2)'}}>Type on your keyboard or tap below</p>
      </div>

      {/* PIN dots */}
      <div className={`flex justify-center gap-4 mb-2 transition-all ${shake ? 'translate-x-2' : ''}`}>
        {[0,1,2,3].map(i => (
          <div key={i} className="w-4 h-4 rounded-full transition-all"
            style={{
              background: i < pin.length ? 'var(--tn-red)' : 'rgba(250,247,240,0.15)',
              transform: i < pin.length ? 'scale(1.2)' : 'scale(1)',
            }} />
        ))}
      </div>

      {error
        ? <p className="text-center text-xs mb-4" style={{color:'#F87171'}}>{error}</p>
        : <div className="mb-4 h-4" />
      }

      {/* Keypad */}
      <div className="space-y-3">
        {rows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-3">
            {row.map((d, di) => (
              <button key={di}
                onClick={() => d === '⌫' ? handleDelete() : d ? handleDigit(d) : null}
                disabled={!d || loading}
                className="h-14 rounded-2xl text-xl font-medium transition-all active:scale-95"
                style={{
                  background: d ? 'rgba(250,247,240,0.07)' : 'transparent',
                  color:      d ? 'var(--tn-cream)' : 'transparent',
                  border:     d ? '0.5px solid rgba(139,105,20,0.2)' : 'none',
                  opacity:    loading ? 0.5 : 1,
                }}>
                {loading && pin.length === 4 && d !== '⌫' ? '' : d}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Login() {
  const { login, verifyPin, drivers, fetchDrivers } = useApp();
  const navigate = useNavigate();
  const [screen, setScreen] = useState('home');
  const [selectedDriver, setSelectedDriver] = useState(null);

  useEffect(() => { fetchDrivers(); }, []);

  const enterAdmin  = () => { login('admin', 'Admin'); navigate('/admin'); };
  const enterDriver = (driver) => {
    login(driver.id, driver.name);
    const path = DRIVER_PATHS[driver.role]?.(driver.id) || `/driver/local/${driver.id}`;
    navigate(path);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'var(--tn-dark)'}}>
      {/* Ambient circles */}
      <div style={{position:'fixed',top:'-80px',right:'-80px',width:'300px',height:'300px',background:'var(--tn-red)',borderRadius:'50%',opacity:0.06,pointerEvents:'none'}}/>
      <div style={{position:'fixed',bottom:'-60px',left:'-60px',width:'200px',height:'200px',background:'var(--tn-gold)',borderRadius:'50%',opacity:0.08,pointerEvents:'none'}}/>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{background:'rgba(139,105,20,0.15)',border:'1px solid rgba(139,105,20,0.25)'}}>
            <span className="text-4xl">🦅</span>
          </div>
          <h1 className="text-2xl font-semibold" style={{color:'var(--tn-cream)'}}>Transporteur National</h1>
          <p className="text-sm mt-1" style={{color:'rgba(250,247,240,0.35)'}}>Delivery management system</p>
        </div>

        {/* Home screen */}
        {screen === 'home' && (
          <div className="rounded-2xl p-5" style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
            <p className="text-xs uppercase tracking-wider mb-4" style={{color:'rgba(250,247,240,0.3)'}}>Select access</p>
            <div className="space-y-2">
              {[
                { label:'Admin', desc:'Full dashboard access · PIN required', icon:'⚙️', accent:'rgba(192,57,43,0.15)', border:'rgba(192,57,43,0.2)', bg:'rgba(192,57,43,0.08)', action:() => setScreen('admin-pin') },
                { label:'Drivers', desc:'Select your name · PIN required', icon:'🚚', accent:'rgba(139,105,20,0.15)', border:'rgba(139,105,20,0.2)', bg:'rgba(139,105,20,0.08)', action:() => setScreen('drivers') },
                { label:'Client portal', desc:'Orders, invoices & proof of delivery', icon:'🏢', accent:'rgba(250,247,240,0.06)', border:'rgba(250,247,240,0.08)', bg:'rgba(250,247,240,0.04)', action:() => navigate('/portal') },
                { label:'Track an order', desc:'Search by order number, date or address', icon:'📦', accent:'rgba(250,247,240,0.06)', border:'rgba(250,247,240,0.08)', bg:'rgba(250,247,240,0.04)', action:() => navigate('/track') },
              ].map((item, i) => (
                <button key={i} onClick={item.action}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                  style={{background:item.bg, border:`0.5px solid ${item.border}`}}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{background:item.accent}}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{color:'var(--tn-cream)'}}>{item.label}</p>
                    <p className="text-xs" style={{color:'rgba(250,247,240,0.3)'}}>{item.desc}</p>
                  </div>
                  {(i === 0 || i === 1) && (
                    <span className="ml-auto text-xs" style={{color:'rgba(250,247,240,0.3)'}}>🔒</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Admin PIN */}
        {screen === 'admin-pin' && (
          <PinPad
            title="Admin access"
            subtitle="Enter your 4-digit PIN"
            onBack={() => setScreen('home')}
            onPinComplete={async (pin) => verifyPin('admin', pin)}
            onSuccess={enterAdmin}
          />
        )}

        {/* Drivers list */}
        {screen === 'drivers' && (
          <div className="rounded-2xl p-5" style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
            <button onClick={() => setScreen('home')} className="flex items-center gap-2 text-sm mb-4"
              style={{color:'rgba(250,247,240,0.4)'}}>← Back</button>
            <p className="text-xs uppercase tracking-wider mb-4" style={{color:'rgba(250,247,240,0.3)'}}>Select your name</p>
            <div className="space-y-2">
              {(drivers || []).map(driver => (
                <button key={driver.id}
                  onClick={() => { setSelectedDriver(driver); setScreen('driver-pin'); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                  style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.15)'}}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{background: driver.color}}>
                    {driver.initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{color:'var(--tn-cream)'}}>{driver.name}</p>
                    <p className="text-xs" style={{color:'rgba(250,247,240,0.3)'}}>
                      {driver.role==='local'?'Local deliveries':driver.role==='ontario'?'Ontario / Gatineau route':'Québec route'}
                    </p>
                  </div>
                  <span className="ml-auto" style={{color:'rgba(250,247,240,0.2)'}}>→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Driver PIN */}
        {screen === 'driver-pin' && selectedDriver && (
          <PinPad
            title={selectedDriver.name}
            subtitle="Enter your 4-digit PIN"
            onBack={() => setScreen('drivers')}
            onPinComplete={async (pin) => verifyPin('driver', pin, selectedDriver.id)}
            onSuccess={() => enterDriver(selectedDriver)}
          />
        )}

        <p className="text-center text-xs mt-6" style={{color:'rgba(250,247,240,0.15)'}}>
          Transporteur National MC INC · Terrebonne, QC
        </p>
      </div>
    </div>
  );
}
