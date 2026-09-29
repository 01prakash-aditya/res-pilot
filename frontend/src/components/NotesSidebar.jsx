import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { Trash2, Edit2, Check, X } from 'lucide-react';

export default function NotesSidebar({ docId, reloadTrigger }) {
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editNote, setEditNote] = useState("");

  const loadAnnotations = useCallback(() => {
    api.get(`/api/annotations/${docId}`)
      .then(res => {
        setAnnotations(res.data.annotations || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [docId]);

  useEffect(() => {
    loadAnnotations();
  }, [loadAnnotations, reloadTrigger]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this highlight?")) return;
    try {
      await api.delete(`/api/annotations/${id}`);
      loadAnnotations();
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (anno) => {
    setEditingId(anno.id);
    setEditNote(anno.note || "");
  };

  const saveEdit = async (id) => {
    try {
      await api.put(`/api/annotations/${id}`, { note: editNote });
      setEditingId(null);
      loadAnnotations();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-4 flex justify-center"><div className="spinner"></div></div>;

  if (annotations.length === 0) {
    return (
      <div className="p-6 text-center text-[var(--text-muted)] text-[13px]">
        No highlights yet. Select text in the summary to save a highlight.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto w-full">
      <h3 className="text-[12px] uppercase tracking-wider font-semibold text-[var(--text-secondary)] mb-1">Highlights</h3>
      {annotations.map(anno => (
        <div key={anno.id} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-3.5 flex flex-col relative group hover:border-[var(--accent)] transition-colors shadow-sm">
          <div className="text-[13px] text-[var(--text-primary)] mb-2 italic border-l-2 border-[var(--accent)] pl-3 py-0.5 leading-relaxed bg-[rgba(99,102,241,0.03)] pr-2 rounded-r">
            "{anno.text}"
          </div>
          
          {editingId === anno.id ? (
            <div className="mt-2">
              <textarea 
                value={editNote} 
                onChange={e => setEditNote(e.target.value)}
                className="w-full bg-[rgba(255,255,255,0.04)] border border-[var(--border)] rounded p-2.5 text-[12.5px] text-white resize-none h-20 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
                placeholder="Add a note..."
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setEditingId(null)} className="text-[var(--text-muted)] hover:bg-[rgba(255,255,255,0.05)] p-1.5 rounded"><X size={14} /></button>
                <button onClick={() => saveEdit(anno.id)} className="bg-[var(--accent)] text-white hover:bg-[#4f46e5] p-1.5 rounded shadow-sm"><Check size={14} /></button>
              </div>
            </div>
          ) : (
            <div className="mt-1.5 text-[12.5px] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
              {anno.note ? (
                <>
                  <span className="font-semibold mr-1.5 text-[var(--text-primary)] opacity-80">Note:</span>
                  {anno.note}
                </>
              ) : (
                <span className="opacity-40 italic">No note added. Click edit to add one.</span>
              )}
            </div>
          )}

          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-[var(--bg-elevated)] p-0.5 rounded shadow-md border border-[var(--border)]">
            <button onClick={() => startEdit(anno)} className="text-[var(--text-secondary)] hover:text-white p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors"><Edit2 size={12} /></button>
            <button onClick={() => handleDelete(anno.id)} className="text-[var(--text-secondary)] hover:text-red-400 p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors"><Trash2 size={12} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
