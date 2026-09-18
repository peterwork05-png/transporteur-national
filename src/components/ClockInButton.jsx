import { useState, useEffect } from 'react';

export default function ClockInButton({ driverId }) {
  const [onDuty,    setOnDuty]    = useState(false);
  const [clockedAt, setClockedAt] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    fetch(`/api/drivers/${driverId}/duty-status`)
      .then(r => r.json())
      .then(data => {
        setOnDuty(data.on_duty || false);
        setClockedAt(data.clocked_in_at || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [driverId]);

  const handleClockIn = async () => {
    setSaving(true);
    try {
      await fetch(`/api/drivers/${driverId}/clock-in`, { method: 'POST' });
      setOnDuty(true);
      setClockedAt(new Date().toISOString());
    } catch(e) { console.error(e); }
    setSaving(false);
  };

  const handleClockOut = async () => {
    if (!window.confirm('Clock out? This will stop GPS sharing.')) return;
    setSaving(true);
    try {
      await fetch(`/api/drivers/${driverId}/clock-out`, { method: 'POST' });
      setOnDuty(false);
      setClockedAt(null);
    } catch(e) { console.error(e); }
    setSaving(false);
  };

  if (loading) return null;

  return (
    <button
      onClick={onDuty ? handleClockOut : handleClockIn}
      disabled={saving}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all"
      style={{
        background: onDuty ? 'rgba(15,110,86,0.2)' : 'rgba(192,57,43,0.15)',
        color: onDuty ? '#4ADE80' : 'rgba(250,247,240,0.5)',
        border: `0.5px solid ${onDuty ? 'rgba(74,222,128,0.3)' : 'rgba(192,57,43,0.3)'}`,
        opacity: saving ? 0.6 : 1,
        minHeight: '32px',
      }}>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${onDuty ? 'animate-pulse' : ''}`}
        style={{background: onDuty ? '#4ADE80' : 'rgba(250,247,240,0.3)'}}/>
      {saving ? '...' : onDuty ? '🟢 On duty' : '⚫ Clock in'}
    </button>
  );
}
