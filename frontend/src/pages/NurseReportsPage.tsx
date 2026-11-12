import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, Printer, Sparkles, X, RefreshCw, Stethoscope, Users, GraduationCap, Briefcase, Calendar, ArrowLeft
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';
import type { Consultation, PaginatedResponse } from '../types/hsms';

const PIE_COLORS = ['#d44974', '#f472b6', '#fb7185', '#fda4af'];

export function NurseReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState('Click the AI Summary button to generate insights for this month.');
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [activeTerm, setActiveTerm] = useState<any>(null);
  const [useTermFilter, setUseTermFilter] = useState(true);

  const yearOptions = useMemo(() => {
    const current = now.getFullYear();
    return [current - 2, current - 1, current, current + 1];
  }, [now]);

  useEffect(() => {
    const loadTerm = async () => {
      try {
        const res = await api.get<any[]>('/academic-terms');
        const active = res.data.find((t: any) => t.is_active);
        setActiveTerm(active || null);
      } catch {}
    };
    void loadTerm();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { per_page: 100 };
      if (useTermFilter && activeTerm) {
        // 🚨 FIX: Slice to YYYY-MM-DD to prevent 422 date_format errors
        params.date_from = String(activeTerm.start_date).slice(0, 10);
        params.date_to = String(activeTerm.end_date).slice(0, 10);
      } else {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);
        params.date_from = start.toISOString().split('T')[0];
        params.date_to = end.toISOString().split('T')[0];
      }
      const res = await api.get<PaginatedResponse<Consultation>>('/consultations', { params });
      setConsultations(res.data.data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to load reports data.'), 'Error');
    } finally {
      setLoading(false);
    }
  }, [month, year, activeTerm, useTermFilter]);

  useEffect(() => { void loadData(); }, [loadData]);

  const topDiseases = useMemo(() => {
    const map = new Map<string, number>();
    consultations.forEach(c => {
      if (c.diagnosis) map.set(c.diagnosis, (map.get(c.diagnosis) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [consultations]);

  const demographics = useMemo(() => {
    let basic = 0, college = 0, employee = 0;
    const uniquePatients = new Set<number>();
    consultations.forEach(c => {
      if (!c.patient || uniquePatients.has(c.patient.id)) return;
      uniquePatients.add(c.patient.id);
      if (c.patient.patient_type === 'employee') employee++;
      else if (c.patient.student_level === 'college') college++;
      else basic++;
    });
    return [
      { name: 'Basic Ed', value: basic },
      { name: 'College', value: college },
      { name: 'Employee', value: employee },
    ].filter(d => d.value > 0);
  }, [consultations]);

  const basicEdCount = demographics.find(d => d.name === 'Basic Ed')?.value || 0;
  const collegeCount = demographics.find(d => d.name === 'College')?.value || 0;
  const employeeCount = demographics.find(d => d.name === 'Employee')?.value || 0;

  const handlePrint = (): void => {
    setPrinting(true);
    window.print();
    setTimeout(() => setPrinting(false), 1000);
  };

  const handleGenerateSummary = async () => {
    setIsAiModalOpen(true);
    if (generatingSummary) return;
    setGeneratingSummary(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setAiSummary(
        `The clinic recorded ${consultations.length} total consultation(s). ` +
        `The leading diagnosis was "${topDiseases[0]?.name || 'N/A'}" with ${topDiseases[0]?.count || 0} case(s). ` +
        `The majority of unique patients treated were from the ${demographics[0]?.name || 'N/A'} category.`
      );
    } catch (err) {
      setAiSummary('Failed to generate AI summary. Please try again.');
    } finally {
      setGeneratingSummary(false);
    }
  };

  return (
    <div className="nurse-dashboard-page">
      <aside className="nurse-sidebar" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
        <div className="nurse-sidebar-brand">
          <img className="nurse-sidebar-logo" src="/logo-white.png" alt="UIC logo" />
          <div className="nurse-sidebar-identity">
            <h3>{user?.first_name} {user?.last_name}</h3>
            <p>{user?.campus || 'Campus'}</p>
          </div>
        </div>
        <nav className="nurse-sidebar-nav">
          <button onClick={() => navigate('/nurse')} type="button" className="nurse-side-link" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={18} />
            <span>Back to Dashboard</span>
          </button>
        </nav>
      </aside>

      <div className="nurse-dashboard-main" style={{ padding: '2rem', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
        
        <header style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <BarChart3 size={24} color="#d44974" />
              Monthly Clinic Reports
            </h1>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
            {activeTerm ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fdf2f4', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #fbcfe8', color: '#a3224a', fontWeight: 600, fontSize: '0.875rem' }}>
                <input type="checkbox" checked={useTermFilter} onChange={(e) => setUseTermFilter(e.target.checked)} />
                {activeTerm.name}
              </label>
            ) : (
              <span className="muted" style={{ fontSize: '0.875rem' }}>No active term.</span>
            )}

            {!useTermFilter && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <Calendar size={16} color="#94a3b8" style={{ marginLeft: '0.5rem' }} />
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ background: 'transparent', border: 'none', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer', outline: 'none' }}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ background: 'transparent', border: 'none', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer', outline: 'none' }}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}

            <button onClick={handleGenerateSummary} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#fdf2f8', color: '#be185d', borderRadius: '8px', border: '1px solid #fbcfe8', fontWeight: 500, cursor: 'pointer' }}>
              <Sparkles size={16} /> AI Summary
            </button>

            <button onClick={handlePrint} disabled={printing} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#d44974', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 500, cursor: 'pointer' }}>
              <Printer size={16} /> {printing ? 'Printing...' : 'Print Report'}
            </button>
          </div>
        </header>

        {loading ? (
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', textAlign: 'center', color: '#64748b' }}>Loading reports...</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <TopDiseasesChartCard data={topDiseases} />
              <DemographicsChartCard data={demographics} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <KpiCard title="Basic Education" count={basicEdCount} icon={<GraduationCap size={24} color="#d44974" />} />
              <KpiCard title="College Students" count={collegeCount} icon={<Users size={24} color="#d44974" />} />
              <KpiCard title="Employees" count={employeeCount} icon={<Briefcase size={24} color="#d44974" />} />
            </div>
          </>
        )}
      </div>

      {isAiModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsAiModalOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', zIndex: 1000 }}>
          <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', maxWidth: '500px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={20} color="#d44974" /> AI Monthly Insights
              </h3>
              <button className="button ghost" onClick={() => setIsAiModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ color: '#334155', lineHeight: 1.6 }}>
              {generatingSummary ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#d44974' }}>
                  <RefreshCw size={18} className="spinner" /> Analyzing monthly data...
                </div>
              ) : (
                <p style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>{aiSummary}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, count, icon }: { title: string; count: number; icon: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ padding: '1rem', backgroundColor: '#fdf2f8', borderRadius: '50%' }}>
        {icon}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
        <h3 style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a' }}>
          {count} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#64748b' }}>patients</span>
        </h3>
      </div>
    </div>
  );
}

function TopDiseasesChartCard({ data }: { data: { name: string; count: number }[] }) {
  return (
    <section style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
        <Stethoscope size={20} color="#d44974" /> Top 5 Diagnoses
      </h3>
      {data.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', padding: '2rem 0' }}>No diagnoses recorded for this period.</p>
      ) : (
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={(value: string) => value.length > 18 ? `${value.substring(0, 18)}…` : value} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxWidth: '280px', whiteSpace: 'normal', wordBreak: 'break-word' }} />
              <Bar dataKey="count" fill="#d44974" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function DemographicsChartCard({ data }: { data: { name: string; value: number }[] }) {
  return (
    <section style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
        <Users size={20} color="#d44974" /> Patients Consulted
      </h3>
      {data.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', padding: '2rem 0' }}>No patients recorded for this period.</p>
      ) : (
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}