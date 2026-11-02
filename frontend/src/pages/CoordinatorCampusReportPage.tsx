import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Download, FileText } from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';

const PIE_COLORS = ['#d44974', '#f472b6', '#fb7185', '#fda4af', '#fecdd3', '#64748b'];

export function CoordinatorCampusReportPage() {
  const { campusCode } = useParams<{ campusCode: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
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
      // We will build this backend endpoint next
      const res = await api.get(`/reports/campus-detail/${campusCode}?month=${month}&year=${year}`);
      setData(res.data);
    } catch (err) {
      void notifyError('Failed to load campus detailed report.');
    } finally {
      setLoading(false);
    }
  }, [campusCode, month, year]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) return <div className="page">Loading detailed report...</div>;
  if (!data) return <div className="page">No data found for this campus.</div>;

  const demographicChartData = Object.entries(data.demographics || {}).map(([name, value]) => ({
    name: name.replace('_', ' ').toUpperCase(),
    value: value as number,
  }));

  return (
    <div className="page" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button 
            onClick={() => navigate('/coordinator')}
            style={{ background: 'none', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem', padding: 0 }}
          >
            <ArrowLeft size={16} /> Back to Command Center
          </button>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Building2 size={24} color="#d44974" />
            {data.campus_name} - Detailed Report
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white' }}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white' }}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </header>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Demographics Chart */}
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '1rem' }}>Patient Demographics</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={demographicChartData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label>
                  {demographicChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Diseases Chart */}
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '1rem' }}>Top Diagnoses</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top_diseases || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="diagnosis" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#d44974" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={18} color="#d44974" /> Recent Consultations
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
              <th style={{ padding: '0.75rem 0' }}>Patient</th>
              <th>Date</th>
              <th>Type</th>
              <th>Diagnosis</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data.recent_consultations || []).map((c: any) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{c.patient_name}</td>
                <td>{c.date}</td>
                <td style={{ textTransform: 'capitalize' }}>{c.type.replace('_', ' ')}</td>
                <td>{c.diagnosis || 'N/A'}</td>
                <td>
                  <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: c.status === 'completed' ? '#dcfce7' : '#fef9c3', color: c.status === 'completed' ? '#166534' : '#854d0e' }}>
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
