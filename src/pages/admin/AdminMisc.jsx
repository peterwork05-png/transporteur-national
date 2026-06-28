import { useState } from 'react';
import { useApp } from '../../context/AppContext';

const DRIVER_ROLES = { local:'Local deliveries', ontario:'Ontario / Gatineau route', quebec:'Québec route' };

export function AdminDrivers() {
  const { orders, ontarioRoute, quebecRoute } = useApp();
  const todayOrders = orders.filter(o => o.date === '2026-06-26');

  const drivers = [
    { id:'marc',    name:'Marc Dumont',       role:'local',   initials:'MD', color:'#C0392B', pin:'1111' },
    { id:'peter',   name:'Peter',             role:'local',   initials:'PE', color:'#7C3AED', pin:'2222' },
    { id:'jeanluc', name:'Jean-Luc Bergeron', role:'ontario', initials:'JL', color:'#8B4513', pin:'3333' },
    { id:'pierre',  name:'Pierre Tremblay',   role:'quebec',  initials:'PT', color:'#0F6E56', pin:'4444' },
  ];

  const driverStats = {
    marc:    `${todayOrders.filter(o=>o.driver==='marc'&&o.status==='delivered').length} delivered · ${todayOrders.filter(o=>o.driver==='marc'&&['picked','enroute'].includes(o.status)).length} active`,
    peter:   `${todayOrders.filter(o=>o.driver==='peter'&&o.status==='delivered').length} delivered · ${todayOrders.filter(o=>o.driver==='peter'&&['picked','enroute'].includes(o.status)).length} active`,
    jeanluc: `Ontario · ${ontarioRoute.stopStatus.filter(s=>s==='delivered').length}/15 stops`,
    pierre:  `Québec · ${quebecRoute.stopStatus.filter(s=>s==='delivered').length}/10 stops`,
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{color:'var(--tn-dark)'}}>Drivers</h1>
          <p className="text-sm mt-0.5" style={{color:'var(--tn-gold)'}}>Manage drivers and PIN codes</p>
        </div>
        <button className="btn btn-sm" style={{background:'var(--tn-red)',color:'white'}}>+ Add driver</button>
      </div>
      <div className="card max-w-2xl overflow-hidden">
        {drivers.map((driver, i) => (
          <div key={driver.id} className="flex items-center gap-4 p-4" style={{borderBottom:'0.5px solid var(--tn-border)'}}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{background:driver.color}}>
              {driver.initials}
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{driver.name}</p>
              <p className="text-xs mt-0.5" style={{color:'var(--tn-gold)'}}>{DRIVER_ROLES[driver.role]} · {driverStats[driver.id]}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-lg font-mono" style={{background:'var(--tn-warm)',color:'var(--tn-gold)'}}>PIN: {driver.pin}</span>
              <button className="btn btn-outline btn-sm">Edit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminSettings() {
  const [clients, setClients] = useState([
    { id:'beg',     name:'Bureau en Gros #299',  email:'beg@staples.ca',       password:'staples2026',  active:true },
    { id:'jonarts', name:'Jonarts Printing',      email:'orders@jonarts.ca',    password:'jonarts2026',  active:true },
    { id:'aebath',  name:'A&E Bath and Shower',   email:'aebath@gmail.com',     password:'aebath2026',   active:true },
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
    <div className="p-6 space-y-6 max-w-2xl">
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

        {/* Add client form */}
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
