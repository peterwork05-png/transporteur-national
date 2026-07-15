import { useState } from 'react';
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

const autoInitials = (name) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

// Defined OUTSIDE AdminDrivers to prevent re-creation on every keystroke
function DriverForm({ title, form, setForm, saving, onSave, onCancel, onDelete }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(26,18,8,0.6)'}} onClick={onCancel}>
      <div className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] overflow-y-auto" style={{background:'var(--tn-cream)'}} onClick={e=>e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between sticky top-0" style={{background:'var(--tn-dark)'}}>
          <p className="font-semibold" style={{color:'var(--tn-cream)'}}>{title}</p>
          <button onClick={onCancel} className="text-xl" style={{color:'rgba(250,247,240,0.4)'}}>×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Preview avatar */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md"
              style={{background: form.color}}>
              {form.initials || autoInitials(form.name) || '?'}
            </div>
          </div>

          <div>
            <label className="label">Full name</label>
            <input className="input" placeholder="e.g. Marc Dumont" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value, initials: autoInitials(e.target.value) }))} />
          </div>

          <div>
            <label className="label">Initials (editable)</label>
            <input className="input" placeholder="e.g. MD" maxLength={2} value={form.initials}
              onChange={e => setForm(f => ({ ...f, initials: e.target.value.toUpperCase() }))} />
          </div>

          <div>
            <label className="label">Route / Role</label>
            <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div>
            <label className="label">4-digit PIN</label>
            <input className="input" type="number" placeholder="e.g. 1234" maxLength={4}
              value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value.slice(0,4) }))} />
            <p className="text-xs mt-1" style={{color:'var(--tn-gold)'}}>Driver uses this to log in</p>
          </div>

          <div>
            <label className="label">Avatar color</label>
            <div className="flex gap-2 flex-wrap">
              {DRIVER_COLORS.map(color => (
                <button key={color} onClick={() => setForm(f => ({ ...f, color }))}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: color,
                    outline: form.color === color ? `3px solid ${color}` : 'none',
                    outlineOffset: '2px',
                    transform: form.color === color ? 'scale(1.2)' : 'scale(1)',
                  }} />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onCancel} className="btn btn-outline flex-1 justify-center">Cancel</button>
            {onDelete && (
              <button onClick={onDelete} className="btn btn-sm px-3" style={{background:'#FEE2E2',color:'#991B1B'}}>🗑</button>
            )}
            <button onClick={onSave} disabled={!form.name || !form.pin || saving}
              className="btn flex-1 justify-center"
              style={{background:'var(--tn-red)',color:'white',opacity:(!form.name||!form.pin||saving)?0.5:1}}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminDrivers() {
  const { orders, ontarioRoute, quebecRoute, drivers, fetchDrivers } = useApp();
  const todayOrders = orders.filter(o => o.date?.split('T')[0] === new Date().toISOString().split('T')[0]);

  const [editDriver, setEditDriver]   = useState(null);
  const [showAdd,    setShowAdd]      = useState(false);
  const [saving,     setSaving]       = useState(false);
  const [showDelete, setShowDelete]   = useState(null);

  const [form, setForm] = useState({
    name: '', role: 'local', pin: '', color: '#C0392B', initials: '',
  });

  const openEdit = (driver) => {
    setForm({ name: driver.name, role: driver.role, pin: driver.pin, color: driver.color, initials: driver.initials });
    setEditDriver(driver);
  };

  const openAdd = () => {
    setForm({ name: '', role: 'local', pin: '', color: '#185FA5', initials: '' });
    setShowAdd(true);
  };
    setSaving(true);
    try {
      await fetch(`/api/drivers/${editDriver.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          role: form.role,
          pin: form.pin,
          color: form.color,
          initials: form.initials || autoInitials(form.name),
        }),
      });
      await fetchDrivers();
      setEditDriver(null);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      const id = form.name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
      await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: form.name,
          role: form.role,
          pin: form.pin,
          color: form.color,
          initials: form.initials || autoInitials(form.name),
        }),
      });
      await fetchDrivers();
      setShowAdd(false);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleDelete = async (driver) => {
    setSaving(true);
    try {
      await fetch(`/api/drivers/${driver.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      });
      await fetchDrivers();
      setShowDelete(null);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const driverStats = (driver) => {
    if (driver.role === 'local') {
      const del = todayOrders.filter(o => o.driver_id === driver.id && o.status === 'delivered').length;
      const act = todayOrders.filter(o => o.driver_id === driver.id && ['picked','enroute'].includes(o.status)).length;
      return `Local deliveries · ${del} delivered · ${act} active`;
    }
    if (driver.role === 'ontario') return `Ontario / Gatineau route · Ontario · ${ontarioRoute.stopStatus.filter(s=>s==='delivered').length}/15 stops`;
    if (driver.role === 'quebec')  return `Québec route · Québec · ${quebecRoute.stopStatus.filter(s=>s==='delivered').length}/10 stops`;
    return driver.role;
  };

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
        {(drivers || []).map((driver, i) => (
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

      {/* Edit modal */}
      {editDriver && (
        <DriverForm
          title={`Edit — ${editDriver.name}`}
          form={form} setForm={setForm} saving={saving}
          onSave={handleSave}
          onCancel={() => setEditDriver(null)}
          onDelete={() => setShowDelete(editDriver)}
        />
      )}

      {/* Add modal */}
      {showAdd && (
        <DriverForm
          title="Add new driver"
          form={form} setForm={setForm} saving={saving}
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
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
              <button onClick={() => handleDelete(showDelete)} disabled={saving}
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
  const [clients, setClients] = useState([
    { id:'beg',     name:'Bureau en Gros #299',  email:'beg@staples.ca',    password:'staples2026',  active:true },
    { id:'jonarts', name:'Jonarts Printing',      email:'orders@jonarts.ca', password:'jonarts2026',  active:true },
    { id:'aebath',  name:'A&E Bath and Shower',   email:'aebath@gmail.com',  password:'aebath2026',   active:true },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newClient, setNewClient] = useState({ name:'', email:'', password:'' });
  const [showPasswords, setShowPasswords] = useState({});

  const togglePass = (id) => setShowPasswords(p => ({...p, [id]: !p[id]}));

  const admins = [
    { initials:'AD', name:'Admin (You)',  role:'Owner',          color:'var(--tn-red)' },
    { initials:'SB', name:'Sophie B.',    role:'Office Manager', color:'var(--tn-gold)' },
    { initials:'KL', name:'Kevin L.',     role:'Dispatcher',     color:'#185FA5' },
  ];

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
            <span className="font-mono text-sm px-3 py-1 rounded-lg" style={{background:'white',border:'0.5px solid var(--tn-border)'}}>••••</span>
            <button className="btn btn-outline btn-sm">Change</button>
          </div>
        </div>
      </div>

      {/* Client logins */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4" style={{borderBottom:'0.5px solid var(--tn-border)'}}>
          <h2 className="font-semibold text-sm">Client portal logins</h2>
          <button onClick={() => setShowAdd(true)} className="btn btn-sm" style={{background:'var(--tn-red)',color:'white'}}>+ Add client</button>
        </div>
        {clients.map(client => (
          <div key={client.id} className="p-4" style={{borderBottom:'0.5px solid var(--tn-border)'}}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-sm">{client.name}</p>
              <div className="flex gap-2">
                <button className="btn btn-outline btn-sm">Edit</button>
                <button className="btn btn-sm" style={{background:'#FEE2E2',color:'#991B1B'}}>Disable</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-2" style={{background:'var(--tn-warm)'}}>
                <p className="text-xs" style={{color:'var(--tn-gold)'}}>Email</p>
                <p className="text-sm font-medium truncate">{client.email}</p>
              </div>
              <div className="rounded-lg p-2 flex items-center justify-between" style={{background:'var(--tn-warm)'}}>
                <div>
                  <p className="text-xs" style={{color:'var(--tn-gold)'}}>Password</p>
                  <p className="text-sm font-mono">{showPasswords[client.id] ? client.password : '••••••••'}</p>
                </div>
                <button onClick={() => togglePass(client.id)} className="text-xs" style={{color:'var(--tn-gold)'}}>
                  {showPasswords[client.id] ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>
        ))}
        {showAdd && (
          <div className="p-4" style={{background:'var(--tn-warm)'}}>
            <p className="font-medium text-sm mb-3">New client login</p>
            <div className="space-y-2">
              <div><label className="label">Client name</label><input className="input" placeholder="e.g. New Client Inc." value={newClient.name} onChange={e=>setNewClient(c=>({...c,name:e.target.value}))} /></div>
              <div><label className="label">Email</label><input type="email" className="input" placeholder="client@company.com" value={newClient.email} onChange={e=>setNewClient(c=>({...c,email:e.target.value}))} /></div>
              <div><label className="label">Password</label><input className="input" placeholder="Set a password" value={newClient.password} onChange={e=>setNewClient(c=>({...c,password:e.target.value}))} /></div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowAdd(false)} className="btn btn-outline btn-sm flex-1 justify-center">Cancel</button>
              <button onClick={() => {
                if (newClient.name && newClient.email && newClient.password) {
                  setClients(prev => [...prev, { id: Date.now().toString(), ...newClient, active:true }]);
                  setNewClient({ name:'', email:'', password:'' });
                  setShowAdd(false);
                }
              }} className="btn btn-sm flex-1 justify-center" style={{background:'var(--tn-red)',color:'white'}}>
                Create login
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Admin users */}
      <div className="card overflow-hidden">
        <div className="p-4" style={{borderBottom:'0.5px solid var(--tn-border)'}}>
          <h2 className="font-semibold text-sm">Admin users</h2>
        </div>
        {admins.map((a, i) => (
          <div key={i} className="flex items-center gap-3 p-4" style={{borderBottom:'0.5px solid var(--tn-border)'}}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:a.color}}>{a.initials}</div>
            <div className="flex-1">
              <p className="font-medium text-sm">{a.name}</p>
              <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>{a.role}</p>
            </div>
            <button className="btn btn-outline btn-sm">Edit</button>
          </div>
        ))}
        <div className="p-4">
          <button className="btn btn-sm" style={{background:'var(--tn-red)',color:'white'}}>+ Add admin user</button>
        </div>
      </div>
    </div>
  );
}
