import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';

export function CoordinatorDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/command-center?month=${month}&year=${year}`);
      setData(res.data);
    } catch (err) {
      void notifyError('Failed to load command center reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, [month, year]);

  if (loading || !data) return <div className="page">Loading Command Center...</div>;

  return (
    <div className="page">
      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>🌍 Global Clinic Command Center</h2>
          <p className="muted">Deep analytics across all university clinics.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {data.campuses.map((campus: any) => (
        <section className="panel" key={campus.campus_code} style={{ marginTop: '1.5rem' }}>
          <h3 style={{ borderBottom: '2px solid #d44974', paddingBottom: '0.5rem', display: 'inline-block' }}>
            🏥 {campus.campus_name}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginTop: '1rem' }}>
            <div className="metric-card">
              <span className="muted small">Consultations</span>
              <h2>{campus.metrics.total_consultations}</h2>
            </div>
            <div className="metric-card">
              <span className="muted small">Telemed</span>
              <h2>{campus.metrics.total_telemed}</h2>
            </div>
            <div className="metric-card">
              <span className="muted small">Referrals</span>
              <h2>{campus.metrics.total_referrals}</h2>
            </div>
            <div className="metric-card">
              <span className="muted small">Injuries</span>
              <h2>{campus.metrics.total_injuries}</h2>
            </div>
            <div className="metric-card" style={{ background: campus.inventory.low_stock_alerts > 0 ? '#fee2e2' : '#f0fdf4' }}>
              <span className="muted small">Low Stock</span>
              <h2>{campus.inventory.low_stock_alerts}</h2>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <h4>Patient Demographics</h4>
              <ul>
                {Object.entries(campus.patient_demographics).map(([cat, count]) => (
                  <li key={cat}><strong>{cat.replace('_', ' ').toUpperCase()}:</strong> {count as number}</li>
                ))}
                {Object.keys(campus.patient_demographics).length === 0 && <li>No patients.</li>}
              </ul>
            </div>

            <div>
              <h4>Top 5 Diseases</h4>
              <ul>
                {campus.top_diseases.map((d: any) => (
                  <li key={d.diagnosis}><strong>{d.diagnosis}:</strong> {d.count}</li>
                ))}
                {campus.top_diseases.length === 0 && <li>No diagnoses.</li>}
              </ul>
            </div>

            <div>
              <h4>Inventory Snapshot</h4>
              <p>Total Stock: <strong>{campus.inventory.total_stock_available}</strong></p>
              <p style={{ color: campus.inventory.expiring_soon_alerts > 0 ? 'red' : 'green' }}>
                Expiring Soon: <strong>{campus.inventory.expiring_soon_alerts}</strong>
              </p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}