import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // <-- Added for navigation
import { 
  Activity, 
  AlertTriangle, 
  Building2, 
  Package, 
  Stethoscope, 
  Users, 
  Video, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';

// Types
interface CampusMetrics {
  total_consultations: number;
  total_telemed: number;
  total_referrals: number;
  total_injuries: number;
}

interface CampusInventory {
  low_stock_alerts: number;
  total_stock_available: number;
  expiring_soon_alerts: number;
}

interface Disease {
  diagnosis: string;
  count: number;
}

interface CampusData {
  campus_code: string;
  campus_name: string;
  metrics: CampusMetrics;
  inventory: CampusInventory;
  patient_demographics: Record<string, number>;
  top_diseases: Disease[];
}

interface CommandCenterData {
  campuses: CampusData[];
}

const PIE_COLORS = ['#d44974', '#f472b6', '#fb7185', '#fda4af', '#fecdd3', '#64748b'];

export function CoordinatorDashboardPage() {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 2, current - 1, current, current + 1];
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/command-center?month=${month}&year=${year}`);
      setData(res.data);
    } catch (err) {
      void notifyError('Failed to load command center reports.');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="page" style={{ padding: '1.5rem' }}>
      
      {/* Header Section */}
      <header style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Activity size={24} color="#d44974" />
            Global Clinic Command Center
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.25rem' }}>
            Deep analytics and inventory snapshots across all university clinics.
          </p>
        </div>

        {/* Date Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <Calendar size={16} color="#94a3b8" style={{ marginLeft: '0.5rem' }} />
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            style={{ background: 'transparent', border: 'none', fontSize: '0.9rem', fontWeight: 500, color: '#334155', cursor: 'pointer', outline: 'none' }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ background: 'transparent', border: 'none', fontSize: '0.9rem', fontWeight: 500, color: '#334155', cursor: 'pointer', outline: 'none' }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', textAlign: 'center', color: '#64748b' }}>Loading dashboard...</div>
      ) : !data || data.campuses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b', backgroundColor: 'white', borderRadius: '12px' }}>
          <AlertCircle size={40} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
          <p style={{ fontWeight: 500 }}>No report data found for the selected period.</p>
        </div>
      ) : (
        <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {data.campuses.map((campus) => (
            <CampusCard key={campus.campus_code} campus={campus} />
          ))}
        </main>
      )}
    </div>
  );
}

function CampusCard({ campus }: { campus: CampusData }) {
  const navigate = useNavigate(); // <-- Added navigation

  const demographicChartData = useMemo(() => {
    return Object.entries(campus.patient_demographics).map(([category, value]) => ({
      name: category.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      value,
    }));
  }, [campus.patient_demographics]);

  return (
    <section 
      onClick={() => navigate(`/coordinator/campus/${campus.campus_code}`)}
      style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0', 
        padding: '1.5rem',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Campus Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9', marginBottom: '1.5rem' }}>
        <Building2 size={20} color="#d44974" />
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>{campus.campus_name}</h2>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#d44974', fontWeight: 600 }}>Click for details &rarr;</span>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <MetricCard icon={<Stethoscope size={16} />} label="Consultations" value={campus.metrics.total_consultations} />
        <MetricCard icon={<Video size={16} />} label="Telemed" value={campus.metrics.total_telemed} />
        <MetricCard icon={<Users size={16} />} label="Referrals" value={campus.metrics.total_referrals} />
        <MetricCard icon={<AlertTriangle size={16} />} label="Injuries" value={campus.metrics.total_injuries} />
        <MetricCard 
          icon={<Package size={16} />} 
          label="Low Stock" 
          value={campus.inventory.low_stock_alerts} 
          variant={campus.inventory.low_stock_alerts > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Charts & Snapshot Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
        
        {/* 1. Patient Demographics Chart */}
        <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Patient Demographics</h3>
          {demographicChartData.length === 0 ? (
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '2rem 0' }}>No demographic data.</p>
          ) : (
            <div style={{ height: '220px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={demographicChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {demographicChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 2. Top Diagnoses Chart */}
        <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Top Diagnoses</h3>
          {campus.top_diseases.length === 0 ? (
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '2rem 0' }}>No diagnoses recorded.</p>
          ) : (
            <div style={{ height: '220px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={campus.top_diseases}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="diagnosis" 
                    type="category" 
                    width={100} 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="count" fill="#d44974" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 3. Inventory Summary */}
        <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Inventory Summary</h3>
            <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: '#475569' }}>Total Available Stock</span>
                <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{campus.inventory.total_stock_available.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Expiring Soon</span>
                <span style={{ fontWeight: 600, color: campus.inventory.expiring_soon_alerts > 0 ? '#dc2626' : '#16a34a' }}>
                  {campus.inventory.expiring_soon_alerts}
                </span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right', fontWeight: 500, marginTop: '1rem' }}>
            Campus ID: <span style={{ fontFamily: 'monospace', color: '#475569' }}>{campus.campus_code}</span>
          </div>
        </div>

      </div>
    </section>
  );
}

function MetricCard({ icon, label, value, variant = 'default' }: { icon: React.ReactNode; label: string; value: number; variant?: 'default' | 'danger' | 'success' }) {
  const styles = {
    default: { bg: '#f8fafc', border: '#e2e8f0', text: '#475569', val: '#0f172a' },
    danger: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', val: '#7f1d1d' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', val: '#14532d' },
  };

  const theme = styles[variant];

  return (
    <div style={{ padding: '1rem', borderRadius: '8px', backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: theme.text, marginBottom: '0.25rem' }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: theme.val }}>{value}</div>
    </div>
  );
}

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 500 }}>
        <span>{payload[0].name}: </span>
        <span style={{ fontWeight: 'bold' }}>{payload[0].value}</span>
      </div>
    );
  }
  return null;
};

const CustomBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 500 }}>
        <span>{data.diagnosis}: </span>
        <span style={{ fontWeight: 'bold', color: '#fda4af' }}>{data.count} cases</span>
      </div>
    );
  }
  return null;
};