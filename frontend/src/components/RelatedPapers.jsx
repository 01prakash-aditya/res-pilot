import React, { useEffect, useState } from 'react';
import api from '../api';
import { ExternalLink, Users, Calendar, AlertCircle } from 'lucide-react';

export default function RelatedPapers({ docId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/api/related/${docId}`)
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.detail || "Failed to fetch related papers");
        setLoading(false);
      });
  }, [docId]);

  if (loading) return <div className="p-10 flex justify-center w-full"><div className="spinner"></div></div>;
  
  if (error) {
    return (
      <div className="w-full bg-[var(--bg-surface)] border border-red-500/20 rounded-[var(--radius-lg)] p-8 flex flex-col items-center text-center">
        <AlertCircle size={32} className="text-red-400 mb-3" />
        <p className="text-[14px] text-red-400 font-medium">{error}</p>
      </div>
    );
  }

  if (!data || !data.related_papers || data.related_papers.length === 0) {
    return (
      <div className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-10 flex flex-col items-center text-center">
        <p className="text-[15px] font-medium text-[var(--text-secondary)]">No related papers found.</p>
        <p className="text-[13px] text-[var(--text-muted)] mt-2">Could not find semantically related literature.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {data.keywords && data.keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 items-center">
          <span className="text-[12px] text-[var(--text-secondary)] mr-2">Keywords used:</span>
          {data.keywords.map((kw, i) => (
            <span key={i} className="px-2.5 py-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-full text-[11px] font-medium text-white shadow-sm">
              {kw}
            </span>
          ))}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.related_papers.map((paper, i) => (
          <a 
            key={i} 
            href={paper.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="group bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] p-5 hover:border-[var(--accent)] hover:bg-[rgba(99,102,241,0.02)] transition-all duration-200 flex flex-col"
          >
            <div className="flex justify-between items-start mb-3 gap-4">
              <h4 className="font-semibold text-[14px] leading-snug text-[var(--text-primary)] group-hover:text-white transition-colors line-clamp-2">{paper.title}</h4>
              <ExternalLink size={14} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] flex-shrink-0 mt-0.5" />
            </div>
            
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed line-clamp-3 mb-5 flex-1">
              {paper.abstract || "No abstract available."}
            </p>
            
            <div className="flex items-center justify-between text-[11.5px] text-[var(--text-muted)] font-medium pt-3 border-t border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-1.5 truncate max-w-[65%]" title={paper.authors}>
                <Users size={12} /> <span className="truncate">{paper.authors || "Unknown"}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Calendar size={12} /> {paper.year || "N/A"}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
