import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

const NAV = [
  { to: '/admin',           label: 'Today',           icon: '📊', end: true },
  { to: '/admin/orders',    label: 'Local orders',    icon: '📦' },
  { to: '/admin/routes',    label: 'Contract routes', icon: '🗺️' },
  { to: '/admin/invoices',  label: 'Invoices',        icon: '🧾' },
  { to: '/admin/payments',  label: 'Payments',        icon: '💳' },
  { to: '/admin/drivers',   label: 'Drivers',         icon: '👥' },
  { to: '/admin/settings',  label: 'Settings',        icon: '⚙️' },
];

export default function AdminLayout() {
  const { user, logout } = useApp();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background:'var(--tn-cream)' }}>
      {/* Sidebar */}
      <aside className="w-52 flex flex-col flex-shrink-0" style={{ background:'var(--tn-dark)' }}>
        {/* Logo */}
        <div className="px-4 py-4" style={{ borderBottom:'0.5px solid rgba(139,105,20,0.15)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xl flex-shrink-0" style={{ background:'rgba(139,105,20,0.15)', border:'0.5px solid rgba(139,105,20,0.25)' }}>🦅</div>
            <div>
              <p className="text-xs font-semibold leading-tight" style={{ color:'var(--tn-cream)' }}>Transporteur</p>
              <p className="text-xs" style={{ color:'rgba(250,247,240,0.3)' }}>National MC</p>
            </div>
          </div>
        </div>

        {/* Nav sections */}
        <div className="flex-1 py-3 px-2 overflow-y-auto">
          <p className="text-xs px-2 pb-1 uppercase tracking-wider" style={{ color:'rgba(250,247,240,0.2)' }}>Overview</p>
          {NAV.slice(0,3).map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => `nav-item mb-0.5 ${isActive ? 'active' : ''}`}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          <p className="text-xs px-2 pt-3 pb-1 uppercase tracking-wider" style={{ color:'rgba(250,247,240,0.2)' }}>Finance</p>
          {NAV.slice(3,5).map(item => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) => `nav-item mb-0.5 ${isActive ? 'active' : ''}`}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          <p className="text-xs px-2 pt-3 pb-1 uppercase tracking-wider" style={{ color:'rgba(250,247,240,0.2)' }}>Team</p>
          {NAV.slice(5).map(item => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) => `nav-item mb-0.5 ${isActive ? 'active' : ''}`}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3" style={{ borderTop:'0.5px solid rgba(139,105,20,0.15)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background:'var(--tn-red)' }}>
              {user?.initials || 'AD'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color:'var(--tn-cream)' }}>Admin</p>
              <p className="text-xs" style={{ color:'rgba(250,247,240,0.3)' }}>Owner</p>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/'); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors"
            style={{ color:'rgba(250,247,240,0.3)' }}
            onMouseEnter={e => e.currentTarget.style.color='rgba(250,247,240,0.7)'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(250,247,240,0.3)'}>
            🚪 Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto" style={{ background:'var(--tn-cream)' }}>
        <Outlet />
      </main>
    </div>
  );
}
