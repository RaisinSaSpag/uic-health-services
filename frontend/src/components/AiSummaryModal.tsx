import { X, Sparkles, RefreshCw } from 'lucide-react';

interface AiSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: string;
  source: string | null;
  generating: boolean;
}

export function AiSummaryModal({ isOpen, onClose, summary, source, generating }: AiSummaryModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="nurse-reports-summary-modal-backdrop"
      onClick={onClose}
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <section
        aria-label="AI findings summary"
        aria-modal="true"
        className="nurse-reports-summary-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <header className="nurse-reports-summary-modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={20} color="#d44974" /> AI Findings Summary
            </h3>
            <p className="muted small" style={{ margin: '0.25rem 0 0 0' }}>Generated insights for the selected month</p>
          </div>
          <button
            className="nurse-reports-summary-modal-close button ghost"
            onClick={onClose}
            type="button"
            aria-label="Close AI summary"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </header>

        <div className="nurse-reports-summary-modal-body" style={{ color: '#334155', lineHeight: 1.6 }}>
          {generating ? (
            <div className="nurse-reports-summary-loading" role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#d44974' }}>
              <RefreshCw className="nurse-reports-spinner" size={18} strokeWidth={2.4} />
              <span>Generating monthly insights...</span>
            </div>
          ) : (
            <>
              <p style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', margin: 0 }}>{summary}</p>
              {source && (
                <p className="muted small" style={{ marginTop: '0.75rem' }}>Source: {source === 'openai' ? 'OpenAI' : 'Fallback'}</p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}