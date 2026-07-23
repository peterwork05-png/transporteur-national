import { useState, useCallback, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

const ROLE_OPTIONS = [
  { value: 'local',   label: 'Local deliveries' },
  { value: 'ontario', label: 'Ontario / Gatineau route' },
  { value: 'quebec',  label: 'Québec route' },
];

const DRIVER_COLORS = [
  '#C0392B', '#7C3AED', '#8B4513', '#0F6E56',
  '#185FA5', '#B45309', '#1F2937', '#BE185D',
];

const autoInitials = (name) =>
  name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);

export function AdminDrivers() {
  const { orders, ontarioRoute, quebecRoute, drivers, fetchDrivers } = useApp();
  const todayDate = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.date?.split('T')[0] === todayDate);

  const [mode,       setMode]       = useState(null); // null | 'edit' | 'add'
  const [editTarget, setEditTarget] = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [showDelete, setShowDelete] = useState(null);

  const [name,     setName]     = useState('');
  const [initials, setInitials] = useState('');
  const [role,     setRole]     = useState('local');
  const [pin,      setPin]      = useState('');
  const [color,    setColor]    = useState('#C0392B');

  const openEdit = useCallback((driver) => {
    setName(driver.name);
    setInitials(driver.initials || autoInitials(driver.name));
    setRole(driver.role);
    setPin(driver.pin);
    setColor(driver.color);
    setEditTarget(driver);
    setMode('edit');
  }, []);

  const openAdd = useCallback(() => {
    setName(''); setInitials(''); setRole('local'); setPin(''); setColor('#185FA5');
    setEditTarget(null);
    setMode('add');
  }, []);

  const closeModal = useCallback(() => { setMode(null); setEditTarget(null); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/drivers/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role, pin, color, initials: initials || autoInitials(name) }),
      });
      await fetchDrivers();
      closeModal();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
      await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, role, pin, color, initials: initials || autoInitials(name) }),
      });
      await fetchDrivers();
      closeModal();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await fetch(`/api/drivers/${showDelete.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      });
      await fetchDrivers();
      setShowDelete(null);
      closeModal();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const driverStats = (driver) => {
    if (driver.role === 'local') {
      const del = todayOrders.filter(o => o.driver_id === driver.id && o.status === 'delivered').length;
      const act = todayOrders.filter(o => o.driver_id === driver.id && ['picked','enroute'].includes(o.status)).length;
      return `Local · ${del} delivered · ${act} active today`;
    }
    if (driver.role === 'ontario') return `Ontario / Gatineau · ${ontarioRoute.stopStatus.filter(s=>s==='delivered').length}/15 stops`;
    if (driver.role === 'quebec')  return `Québec route · ${quebecRoute.stopStatus.filter(s=>s==='delivered').length}/10 stops`;
    return driver.role;
  };

  const isOpen = mode === 'edit' || mode === 'add';
  const canSave = name.trim() && pin.trim() && !saving;

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Drivers</h1>
          <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>Manage drivers and PIN codes</p>
        </div>
        <button onClick={openAdd} className="btn btn-sm" style={{background:'var(--tn-red)',color:'white'}}>+ Add driver</button>
      </div>

      <div className="card max-w-2xl overflow-hidden">
        {(drivers || []).map(driver => (
          <div key={driver.id} className="flex items-center gap-4 p-4" style={{borderBottom:'0.5px solid var(--tn-border)'}}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{background: driver.color}}>
              {driver.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{driver.name}</p>
              <p className="text-xs mt-0.5 truncate" style={{color:'var(--tn-gold)'}}>{driverStats(driver)}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs px-2 py-1 rounded-lg font-mono" style={{background:'var(--tn-warm)',color:'var(--tn-gold)'}}>
                PIN: {driver.pin}
              </span>
              <button onClick={() => openEdit(driver)} className="btn btn-outline btn-sm">Edit</button>
            </div>
          </div>
        ))}
        {(!drivers || drivers.length === 0) && (
          <div className="text-center py-8 text-sm" style={{color:'var(--tn-gold)'}}>No drivers found</div>
        )}
      </div>

      {/* Edit / Add modal — inline JSX, no sub-component */}
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.6)'}} onClick={closeModal}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] overflow-y-auto"
            style={{background:'var(--tn-cream)'}} onClick={e => e.stopPropagation()}>

            <div className="px-5 py-4 flex items-center justify-between sticky top-0" style={{background:'var(--tn-dark)'}}>
              <p className="font-semibold" style={{color:'var(--tn-cream)'}}>
                {mode === 'edit' ? `Edit — ${editTarget?.name}` : 'Add new driver'}
              </p>
              <button onClick={closeModal} className="text-xl" style={{color:'rgba(250,247,240,0.4)'}}>×</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Avatar preview */}
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md"
                  style={{background: color}}>
                  {initials || autoInitials(name) || '?'}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="label">Full name</label>
                <input
                  className="input"
                  placeholder="e.g. Marc Dumont"
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    setInitials(autoInitials(e.target.value));
                  }}
                />
              </div>

              {/* Initials */}
              <div>
                <label className="label">Initials</label>
                <input
                  className="input"
                  placeholder="e.g. MD"
                  maxLength={2}
                  value={initials}
                  onChange={e => setInitials(e.target.value.toUpperCase())}
                />
              </div>

              {/* Role */}
              <div>
                <label className="label">Route / Role</label>
                <select className="input" value={role} onChange={e => setRole(e.target.value)}>
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              {/* PIN */}
              <div>
                <label className="label">4-digit PIN</label>
                <input
                  className="input"
                  type="number"
                  placeholder="e.g. 1234"
                  value={pin}
                  onChange={e => setPin(e.target.value.slice(0, 4))}
                />
                <p className="text-xs mt-1" style={{color:'var(--tn-gold)'}}>Driver uses this to log in</p>
              </div>

              {/* Color */}
              <div>
                <label className="label">Avatar color</label>
                <div className="flex gap-2 flex-wrap">
                  {DRIVER_COLORS.map(c => (
                    <button key={c} onClick={() => setColor(c)}
                      className="w-8 h-8 rounded-full transition-all"
                      style={{
                        background: c,
                        outline: color === c ? `3px solid ${c}` : 'none',
                        outlineOffset: '2px',
                        transform: color === c ? 'scale(1.2)' : 'scale(1)',
                      }} />
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button onClick={closeModal} className="btn btn-outline flex-1 justify-center">Cancel</button>
                {mode === 'edit' && (
                  <button onClick={() => setShowDelete(editTarget)}
                    className="btn btn-sm px-3" style={{background:'#FEE2E2',color:'#991B1B'}}>
                    🗑
                  </button>
                )}
                <button
                  onClick={mode === 'edit' ? handleSave : handleAdd}
                  disabled={!canSave}
                  className="btn flex-1 justify-center"
                  style={{background:'var(--tn-red)',color:'white',opacity:canSave?1:0.5}}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.6)'}}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm p-6" style={{background:'var(--tn-cream)'}}>
            <p className="font-semibold text-lg mb-2">Remove driver?</p>
            <p className="text-sm mb-6" style={{color:'var(--tn-gold)'}}>
              This will remove <strong>{showDelete.name}</strong> from the system. Their past orders will be kept.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowDelete(null)} className="btn btn-outline flex-1 justify-center">Cancel</button>
              <button onClick={handleDelete} disabled={saving}
                className="btn flex-1 justify-center" style={{background:'#991B1B',color:'white'}}>
                {saving ? 'Removing...' : 'Remove driver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminSettings() {
  const [clients,       setClients]       = useState([]);
  const [loadingClients,setLoadingClients]= useState(true);
  const [showAdd,       setShowAdd]       = useState(false);
  const [newClient,     setNewClient]     = useState({ name:'', email:'', password:'', role:'ops', client_group:'' });
  const [showPasswords, setShowPasswords] = useState({});
  const [saving,        setSaving]        = useState(false);
  const [editClient,    setEditClient]    = useState(null);

  // Admin PIN
  const [showPinModal,  setShowPinModal]  = useState(false);
  const [currentPin,    setCurrentPin]    = useState('');
  const [newPin,        setNewPin]        = useState('');
  const [confirmPin,    setConfirmPin]    = useState('');
  const [pinError,      setPinError]      = useState('');
  const [pinSuccess,    setPinSuccess]    = useState(false);
  const [adminPin,      setAdminPin]      = useState('••••');

  const togglePass = (id) => setShowPasswords(p => ({...p, [id]: !p[id]}));

  const fetchClients = async () => {
    try {
      const res  = await fetch('/api/clients/portal');
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch(e) { console.error(e); }
    setLoadingClients(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const handleAddClient = async () => {
    if (!newClient.name || !newClient.email || !newClient.password) return;
    setSaving(true);
    try {
      const id = newClient.name.toLowerCase().replace(/\s+/g,'_') + '_' + Date.now();
      const group = newClient.client_group || id;
      await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newClient, id, language:'fr', signoff:'MERCI DE VOTRE CONFIANCE!', client_group: group }),
      });
      await fetchClients();
      setNewClient({ name:'', email:'', password:'', role:'ops', client_group:'' });
      setShowAdd(false);
    } catch(e) { console.error(e); }
    setSaving(false);
  };

  const handleDisable = async (id) => {
    if (!window.confirm('Disable this login? The client will no longer be able to sign in.')) return;
    try {
      await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      });
      await fetchClients();
    } catch(e) { console.error(e); }
  };

  const handleUpdateRole = async (id, newRole) => {
    try {
      await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      await fetchClients();
    } catch(e) { console.error(e); }
  };

  const handleChangePin = async () => {
    setPinError('');
    if (newPin.length !== 4 || isNaN(newPin)) return setPinError('PIN must be exactly 4 digits');
    if (newPin !== confirmPin) return setPinError('PINs do not match');
    try {
      const res  = await fetch('/api/admin/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json();
      if (data.success) {
        setPinSuccess(true);
        setAdminPin('••••');
        setTimeout(() => { setShowPinModal(false); setPinSuccess(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); }, 1500);
      } else {
        setPinError(data.error || 'Current PIN is incorrect');
      }
    } catch(e) { setPinError('Error changing PIN'); }
  };

  // Group clients by client_group
  const grouped = clients.reduce((acc, c) => {
    const group = c.client_group || c.id;
    if (!acc[group]) acc[group] = { name: c.name, logins: [] };
    acc[group].logins.push(c);
    return acc;
  }, {});

  // Unique company groups for dropdown
  const companyGroups = Object.entries(grouped).map(([group, { name }]) => ({ group, name }));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Settings</h1>
        <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>Admin users, client logins & preferences</p>
      </div>

      {/* Admin PIN */}
      <div className="card p-4">
        <h2 className="font-semibold text-sm mb-3">Admin PIN</h2>
        <div className="flex items-center justify-between p-3 rounded-xl" style={{background:'var(--tn-warm)'}}>
          <div>
            <p className="text-sm font-medium">Admin access PIN</p>
            <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>Used to access the admin dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm px-3 py-1 rounded-lg" style={{background:'white',border:'0.5px solid var(--tn-border)'}}>
              {adminPin}
            </span>
            <button onClick={() => setShowPinModal(true)} className="btn btn-outline btn-sm">Change</button>
          </div>
        </div>
      </div>

      {/* Client portal logins */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4" style={{borderBottom:'0.5px solid var(--tn-border)'}}>
          <div>
            <h2 className="font-semibold text-sm">Client portal logins</h2>
            <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>Manage who can access the client portal and what they see</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn btn-sm" style={{background:'var(--tn-red)',color:'white'}}>+ Add</button>
        </div>

        {loadingClients ? (
          <div className="p-6 text-center text-sm" style={{color:'var(--tn-gold)'}}>Loading...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="p-6 text-center text-sm" style={{color:'var(--tn-gold)'}}>No client logins found</div>
        ) : Object.entries(grouped).map(([group, { name, logins }]) => (
          <div key={group} className="p-4" style={{borderBottom:'0.5px solid var(--tn-border)'}}>
            <p className="font-semibold text-sm mb-3" style={{color:'var(--tn-dark)'}}>{name}</p>
            {logins.map(client => (
              <div key={client.id} className="mb-3 last:mb-0 rounded-xl p-3" style={{background:'var(--tn-warm)'}}>
                {/* Email row */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium truncate flex-1">{client.email}</p>
                  <button onClick={() => handleDisable(client.id)}
                    className="text-xs ml-2 flex-shrink-0 px-2 py-1 rounded-lg"
                    style={{background:'#FEE2E2',color:'#991B1B'}}>
                    Disable
                  </button>
                </div>

                {/* Password row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs" style={{color:'var(--tn-gold)'}}>Password:</p>
                    <p className="text-sm font-mono">{showPasswords[client.id] ? client.password : '••••••••'}</p>
                  </div>
                  <button onClick={() => togglePass(client.id)} className="text-xs" style={{color:'var(--tn-gold)'}}>
                    {showPasswords[client.id] ? 'Hide' : 'Show'}
                  </button>
                </div>

                {/* Access level toggle */}
                <div>
                  <p className="text-xs mb-1.5" style={{color:'var(--tn-gold)'}}>Access level</p>
                  <div className="flex gap-1 p-1 rounded-xl" style={{background:'rgba(139,105,20,0.08)',width:'fit-content'}}>
                    <button
                      onClick={() => handleUpdateRole(client.id, 'ops')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: client.role === 'ops' ? 'var(--tn-red)' : 'transparent',
                        color: client.role === 'ops' ? 'white' : 'var(--tn-gold)',
                      }}>
                      📦 Orders only
                    </button>
                    <button
                      onClick={() => handleUpdateRole(client.id, 'finance')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: client.role === 'finance' ? 'var(--tn-red)' : 'transparent',
                        color: client.role === 'finance' ? 'white' : 'var(--tn-gold)',
                      }}>
                      💳 Orders + Invoices
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Add new client form */}
        {showAdd && (
          <div className="p-4" style={{background:'var(--tn-warm)'}}>
            <p className="font-medium text-sm mb-3">New client login</p>
            <div className="space-y-2">
              <div>
                <label className="label">Client company</label>
                <div className="flex gap-2">
                  <select className="input flex-1" value={newClient.client_group}
                    onChange={e => {
                      const g = e.target.value;
                      const found = companyGroups.find(c => c.group === g);
                      setNewClient(c => ({...c, client_group: g, name: found?.name || c.name}));
                    }}>
                    <option value="">— New company —</option>
                    {companyGroups.map(cg => <option key={cg.group} value={cg.group}>{cg.name}</option>)}
                  </select>
                </div>
                {!newClient.client_group && (
                  <input className="input mt-2" placeholder="Company name (e.g. Jonarts Printing)"
                    value={newClient.name} onChange={e=>setNewClient(c=>({...c,name:e.target.value}))} />
                )}
              </div>
              <div><label className="label">Email</label>
                <input type="email" className="input" placeholder="client@company.com"
                  value={newClient.email} onChange={e=>setNewClient(c=>({...c,email:e.target.value}))} /></div>
              <div><label className="label">Password</label>
                <input className="input" placeholder="Set a password"
                  value={newClient.password} onChange={e=>setNewClient(c=>({...c,password:e.target.value}))} /></div>
              <div>
                <label className="label">Access level</label>
                <div className="flex gap-1 p-1 rounded-xl" style={{background:'rgba(139,105,20,0.08)',width:'fit-content'}}>
                  {[['ops','📦 Orders only'],['finance','💳 Orders + Invoices']].map(([val,label]) => (
                    <button key={val} onClick={() => setNewClient(c=>({...c,role:val}))}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{background:newClient.role===val?'var(--tn-red)':'transparent', color:newClient.role===val?'white':'var(--tn-gold)'}}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowAdd(false)} className="btn btn-outline btn-sm flex-1 justify-center">Cancel</button>
              <button onClick={handleAddClient} disabled={saving}
                className="btn btn-sm flex-1 justify-center" style={{background:'var(--tn-red)',color:'white'}}>
                {saving ? 'Creating...' : 'Create login'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Change PIN modal */}
      {showPinModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.6)'}}
          onClick={() => setShowPinModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            style={{background:'var(--tn-cream)'}} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between" style={{background:'var(--tn-dark)'}}>
              <p className="font-semibold" style={{color:'var(--tn-cream)'}}>Change admin PIN</p>
              <button onClick={() => setShowPinModal(false)} className="text-xl" style={{color:'rgba(250,247,240,0.4)'}}>×</button>
            </div>
            <div className="p-5 space-y-3">
              {pinSuccess ? (
                <div className="text-center py-4">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="font-semibold">PIN changed successfully!</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="label">Current PIN</label>
                    <input type="password" className="input" placeholder="Enter current PIN" maxLength={4}
                      value={currentPin} onChange={e=>setCurrentPin(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">New PIN</label>
                    <input type="password" className="input" placeholder="4-digit PIN" maxLength={4}
                      value={newPin} onChange={e=>setNewPin(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Confirm new PIN</label>
                    <input type="password" className="input" placeholder="Repeat new PIN" maxLength={4}
                      value={confirmPin} onChange={e=>setConfirmPin(e.target.value)} />
                  </div>
                  {pinError && <p className="text-xs px-3 py-2 rounded-lg" style={{background:'#FEE2E2',color:'#991B1B'}}>{pinError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setShowPinModal(false)} className="btn btn-outline flex-1 justify-center">Cancel</button>
                    <button onClick={handleChangePin} disabled={!currentPin||!newPin||!confirmPin}
                      className="btn flex-1 justify-center" style={{background:'var(--tn-red)',color:'white',opacity:currentPin&&newPin&&confirmPin?1:0.5}}>
                      Save new PIN
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
