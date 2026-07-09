import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

const DRIVER_PATHS = {
  local: (id) => `/driver/local/${id}`,
  ontario: () => '/driver/ontario',
  quebec: () => '/driver/quebec',
};

const PinPad = ({ title, subtitle, onSuccess, onBack, onPinComplete }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDigit = async (d) => {
    if (pin.length >= 4 || loading) return;
    const newPin = pin + d;
    setPin(newPin);
    setError('');
    if (newPin.length === 4) {
      setLoading(true);
      const result = await onPinComplete(newPin);
      setLoading(false);
      if (result.success) {
        onSuccess(result);
      } else {
        setShake(true);
        setError('Incorrect PIN');
        setTimeout(() => { setPin(''); setShake(false); }, 600);
      }
    }
  };

  const handleDelete = () => { if (!loading) { setPin(p => p.slice(0, -1)); setError(''); } };
  const digits = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];

  return (
    <div className="w-full max-w-xs mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-sm mb-6" style={{color:'rgba(250,247,240,0.4)'}}>← Back</button>
      <div className="text-center mb-8">
        <p className="text-lg font-semibold mb-1" style={{color:'var(--tn-cream)'}}>{title}</p>
        <p className="text-sm" style={{color:'rgba(250,247,240,0.35)'}}>{subtitle}</p>
      </div>
      <div className={`flex justify-center gap-4 mb-2 ${shake?'animate-bounce':''}`}>
        {[0,1,2,3].map(i => (
          <div key={i} className="w-4 h-4 rounded-full transition-all" style={{
            background: i<pin.length?'var(--tn-red)':'rgba(250,247,240,0.15)',
            transform: i<pin.length?'scale(1.2)':'scale(1)',
          }}/>
        ))}
      </div>
      {error && <p className="text-center text-xs mb-4" style={{color:'#F87171'}}>{error}</p>}
      {!error && <div className="mb-4 h-4"/>}
      <div className="space-y-3">
        {digits.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-3">
            {row.map((d, di) => (
              <button key={di} onClick={() => d==='⌫'?handleDelete():d?handleDigit(d):null}
                disabled={!d||loading}
                className="h-14 rounded-2xl text-xl font-medium transition-all"
                style={{
                  background: d?'rgba(250,247,240,0.07)':'transparent',
                  color: d?'var(--tn-cream)':'transparent',
                  border: d?'0.5px solid rgba(139,105,20,0.2)':'none',
                  opacity: loading?0.5:1,
                }}>
                {loading && d && pin.length===4 ? '...' : d}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function Login() {
  const { login, verifyPin, drivers, fetchDrivers } = useApp();
  const navigate = useNavigate();
  const [screen, setScreen] = useState('home');
  const [selectedDriver, setSelectedDriver] = useState(null);

  useEffect(() => { fetchDrivers(); }, []);

  const enterAdmin = () => { login('admin', 'Admin'); navigate('/admin'); };
  const enterDriver = (driver) => {
    login(driver.id, driver.name);
    const path = DRIVER_PATHS[driver.role] ? DRIVER_PATHS[driver.role](driver.id) : `/driver/local/${driver.id}`;
    navigate(path);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'var(--tn-dark)'}}>
      <div style={{position:'fixed',top:'-80px',right:'-80px',width:'300px',height:'300px',background:'var(--tn-red)',borderRadius:'50%',opacity:0.06,pointerEvents:'none'}}/>
      <div style={{position:'fixed',bottom:'-60px',left:'-60px',width:'200px',height:'200px',background:'var(--tn-gold)',borderRadius:'50%',opacity:0.08,pointerEvents:'none'}}/>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{background:'rgba(139,105,20,0.15)',border:'1px solid rgba(139,105,20,0.25)'}}>
            <span className="text-4xl">🦅</span>
          </div>
          <h1 className="text-2xl font-semibold" style={{color:'var(--tn-cream)'}}>Transporteur National</h1>
          <p className="text-sm mt-1" style={{color:'rgba(250,247,240,0.35)'}}>Delivery management system</p>
        </div>

        {screen === 'home' && (
          <div className="rounded-2xl p-5" style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
            <p className="text-xs uppercase tracking-wider mb-4" style={{color:'rgba(250,247,240,0.3)'}}>Select access</p>
            <div className="space-y-2">
              <button onClick={() => setScreen('admin-pin')}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                style={{background:'rgba(192,57,43,0.08)',border:'0.5px solid rgba(192,57,43,0.2)'}}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{background:'rgba(192,57,43,0.15)'}}>⚙️</div>
                <div>
                  <p className="text-sm font-medium" style={{color:'var(--tn-cream)'}}>Admin</p>
                  <p className="text-xs" style={{color:'rgba(250,247,240,0.3)'}}>Full dashboard access · PIN required</p>
                </div>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{background:'rgba(192,57,43,0.2)',color:'var(--tn-red)'}}>🔒</span>
              </button>

              <button onClick={() => setScreen('drivers')}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                style={{background:'rgba(139,105,20,0.08)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{background:'rgba(139,105,20,0.15)'}}>🚚</div>
                <div>
                  <p className="text-sm font-medium" style={{color:'var(--tn-cream)'}}>Drivers</p>
                  <p className="text-xs" style={{color:'rgba(250,247,240,0.3)'}}>Select your name · PIN required</p>
                </div>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{background:'rgba(139,105,20,0.2)',color:'var(--tn-gold)'}}>🔒</span>
              </button>

              <button onClick={() => navigate('/portal')}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(250,247,240,0.08)'}}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{background:'rgba(250,247,240,0.06)'}}>🏢</div>
                <div>
                  <p className="text-sm font-medium" style={{color:'var(--tn-cream)'}}>Client portal</p>
                  <p className="text-xs" style={{color:'rgba(250,247,240,0.3)'}}>Orders, invoices & proof of delivery</p>
                </div>
              </button>

              <button onClick={() => navigate('/track')}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(250,247,240,0.08)'}}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{background:'rgba(250,247,240,0.06)'}}>📦</div>
                <div>
                  <p className="text-sm font-medium" style={{color:'var(--tn-cream)'}}>Track an order</p>
                  <p className="text-xs" style={{color:'rgba(250,247,240,0.3)'}}>Search by order number, date or address</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {screen === 'admin-pin' && (
          <PinPad
            title="Admin access"
            subtitle="Enter your 4-digit PIN"
            onBack={() => setScreen('home')}
            onPinComplete={async (pin) => verifyPin('admin', pin)}
            onSuccess={enterAdmin}
          />
        )}

        {screen === 'drivers' && (
          <div className="rounded-2xl p-5" style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.2)'}}>
            <button onClick={() => setScreen('home')} className="flex items-center gap-2 text-sm mb-4" style={{color:'rgba(250,247,240,0.4)'}}>← Back</button>
            <p className="text-xs uppercase tracking-wider mb-4" style={{color:'rgba(250,247,240,0.3)'}}>Select your name</p>
            <div className="space-y-2">
              {drivers.map(driver => (
                <button key={driver.id} onClick={() => { setSelectedDriver(driver); setScreen('driver-pin'); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                  style={{background:'rgba(250,247,240,0.04)',border:'0.5px solid rgba(139,105,20,0.15)'}}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{background:driver.color}}>
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
