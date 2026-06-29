import { useState, useEffect } from 'react';
import api from '../api';

interface Props {
  candidateId: string;
  userRole: string;
  onClose: () => void;
}

export function CandidateDetailModal({ candidateId, userRole, onClose }: Props) {
  const [candidate, setCandidate] = useState<any>(null);
  const [feedback, setFeedback] = useState('');
  const [corrections, setCorrections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/employee/${candidateId}/details`).then(res => {
      setCandidate(res.data);
      setFeedback(res.data.feedback || '');
      setCorrections(res.data.corrections || []);
      setLoading(false);
    });
  }, [candidateId]);

  const toggleCorrection = (id: string) =>
    setCorrections(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const sendFeedback = async () => {
    setSaving(true);
    try {
      await api.post(`/employee/${candidateId}/feedback`, { feedback, corrections });
      onClose();
    } catch { alert('Erro ao enviar feedback.'); }
    finally { setSaving(false); }
  };

  const approve = async () => {
    if (!confirm('Aprovar este candidato?')) return;
    setSaving(true);
    try {
      await api.post(`/employee/${candidateId}/approve`);
      onClose();
    } catch { alert('Erro ao aprovar.'); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!confirm('Excluir este candidato? Esta ação não pode ser desfeita.')) return;
    try {
      await api.delete(`/employee/${candidateId}`);
      onClose();
    } catch { alert('Erro ao excluir.'); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {loading ? (
          <div className="p-12 text-center text-slate-400">Carregando...</div>
        ) : (
          <>
            <div className="bg-teal-600 px-6 py-5 text-white relative rounded-t-2xl">
              <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white text-xl">✕</button>
              <h2 className="text-xl font-bold">{candidate.name || 'Candidato'}</h2>
              <p className="text-teal-100 text-sm mt-0.5">{candidate.email} · CPF {candidate.cpf}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {candidate.hasAccessed ? (
                  <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full">
                    ✓ Link acessado{candidate.firstAccessAt ? ` em ${new Date(candidate.firstAccessAt).toLocaleDateString('pt-BR')}` : ''}
                  </span>
                ) : (
                  <span className="text-xs bg-white/10 text-white/60 px-2.5 py-1 rounded-full">Link não acessado</span>
                )}
                {candidate.company && (
                  <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full">🏢 {candidate.company.name}</span>
                )}
              </div>
            </div>

            <div className="p-6 space-y-6">
              {candidate.address && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Endereço</h3>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm">
                    <p className="font-medium text-slate-800">{candidate.address.street}, {candidate.address.number}{candidate.address.complement ? ` — ${candidate.address.complement}` : ''}</p>
                    <p className="text-slate-500 mt-1">{candidate.address.neighborhood} · {candidate.address.city}/{candidate.address.state} · CEP {candidate.address.cep}</p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Respostas</h3>
                {candidate.answers.length === 0 ? (
                  <p className="text-slate-400 text-sm italic">Nenhuma resposta ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {candidate.answers.map((ans: any) => (
                      <div key={ans.id} className={`flex items-center justify-between p-3.5 rounded-xl border text-sm ${
                        corrections.includes(ans.questionId) ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-500 mb-0.5">{ans.question?.label}</p>
                          {ans.value === 'ARQUIVO' && ans.document ? (
                            <a href={`/api/file/${ans.id}`} target="_blank" className="text-teal-600 hover:underline font-semibold text-sm">
                              📄 {ans.document.fileName}
                            </a>
                          ) : (
                            <p className="font-semibold text-slate-800 truncate">
                              {ans.question?.type === 'DATE' ? ans.value?.split('-').reverse().join('/') : ans.value}
                            </p>
                          )}
                        </div>
                        {userRole !== 'PARTNER' && (
                          <input type="checkbox"
                            checked={corrections.includes(ans.questionId)}
                            onChange={() => toggleCorrection(ans.questionId)}
                            className="ml-4 w-4 h-4 accent-red-500 cursor-pointer"
                            title="Marcar para correção" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {userRole !== 'PARTNER' && (
                <div className="border-t border-slate-200 pt-5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Ações do RH</h3>
                  <textarea
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                    rows={3}
                    placeholder="Observações ou instruções de correção..."
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                  />
                  <div className="flex gap-3 mt-3 flex-wrap">
                    <button onClick={sendFeedback} disabled={saving}
                      className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition">
                      Solicitar Correção
                    </button>
                    <button onClick={approve} disabled={saving}
                      className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition">
                      ✓ Aprovar
                    </button>
                    <button onClick={remove}
                      className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2.5 px-4 rounded-xl text-sm transition border border-red-200">
                      Excluir
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
