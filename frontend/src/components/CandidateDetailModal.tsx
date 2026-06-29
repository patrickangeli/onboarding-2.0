import { useState, useEffect } from 'react';
import api from '../api';

const API_BASE = import.meta.env.VITE_API_URL || '';

const ADDRESS_LABELS = ['CEP', 'Rua', 'Número', 'Complemento', 'Bairro', 'Cidade', 'Estado'];

interface Props {
  candidateId: string;
  userRole: string;
  onClose: () => void;
}

// Componente de cada arquivo com preview inline expansível
function DocPreview({ doc }: { doc: { id: string; fileName: string; mimeType: string } }) {
  const [open, setOpen] = useState(false);
  const isPdf = doc.mimeType === 'application/pdf';
  const isImage = doc.mimeType.startsWith('image/');
  const url = `${API_BASE}/api/file/${doc.id}`;

  return (
    <div className="mt-1">
      {/* Botão do arquivo */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition"
          style={isPdf
            ? { color: '#b91c1c', background: '#fef2f2', borderColor: '#fecaca' }
            : { color: '#0f766e', background: '#f0fdfa', borderColor: '#99f6e4' }
          }
          title={open ? 'Fechar preview' : 'Visualizar arquivo'}
        >
          {isPdf ? '📄' : '🖼️'} {doc.fileName}
          <span className="ml-1 text-[10px] opacity-60">{open ? '▲' : '▼'}</span>
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-400 hover:text-slate-600 transition"
          title="Abrir em nova aba"
        >
          ↗
        </a>
      </div>

      {/* Preview inline */}
      {open && (
        <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
          {isImage && (
            <img
              src={url}
              alt={doc.fileName}
              className="w-full max-h-80 object-contain bg-slate-100"
            />
          )}
          {isPdf && (
            <iframe
              src={url}
              title={doc.fileName}
              className="w-full h-80"
              style={{ border: 'none' }}
            />
          )}
          {!isImage && !isPdf && (
            <p className="text-xs text-slate-400 italic p-3">
              Preview não disponível para este tipo de arquivo.{' '}
              <a href={url} target="_blank" rel="noopener noreferrer" className="underline text-teal-600">Abrir em nova aba</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DocLinks({ documents }: { documents: { id: string; fileName: string; mimeType: string }[] }) {
  if (!documents || documents.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 mt-1">
      {documents.map((doc) => (
        <DocPreview key={doc.id} doc={doc} />
      ))}
    </div>
  );
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

  const toggleAddressGroup = (questionIds: string[]) => {
    const allMarked = questionIds.every(id => corrections.includes(id));
    if (allMarked) {
      setCorrections(prev => prev.filter(id => !questionIds.includes(id)));
    } else {
      setCorrections(prev => [...new Set([...prev, ...questionIds])]);
    }
  };

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
        ) : (() => {
          const addressAnswers = candidate.answers.filter((a: any) =>
            ADDRESS_LABELS.includes(a.question?.label)
          );
          const otherAnswers = candidate.answers.filter((a: any) =>
            !ADDRESS_LABELS.includes(a.question?.label)
          );
          const addressQuestionIds = addressAnswers.map((a: any) => a.questionId);
          const addressGroupMarked = addressQuestionIds.length > 0 &&
            addressQuestionIds.every((id: string) => corrections.includes(id));

          return (
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
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Respostas</h3>
                  {candidate.answers.length === 0 ? (
                    <p className="text-slate-400 text-sm italic">Nenhuma resposta ainda.</p>
                  ) : (
                    <div className="space-y-2">

                      {otherAnswers.map((ans: any) => {
                        const hasFiles = ans.documents && ans.documents.length > 0;
                        const isFileAnswer = ['FILE', 'MULTI_FILE'].includes(ans.question?.type);
                        return (
                          <div key={ans.id} className={`flex items-start justify-between p-3.5 rounded-xl border text-sm ${
                            corrections.includes(ans.questionId) ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'
                          }`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500 mb-0.5">{ans.question?.label}</p>
                              {hasFiles ? (
                                <DocLinks documents={ans.documents} />
                              ) : isFileAnswer ? (
                                <p className="text-xs text-slate-400 italic">Nenhum arquivo enviado</p>
                              ) : (
                                <p className="font-semibold text-slate-800 truncate">
                                  {ans.question?.type === 'DATE'
                                    ? ans.value?.split('-').reverse().join('/')
                                    : ans.value}
                                </p>
                              )}
                            </div>
                            {userRole !== 'PARTNER' && (
                              <input type="checkbox"
                                checked={corrections.includes(ans.questionId)}
                                onChange={() => toggleCorrection(ans.questionId)}
                                className="ml-4 mt-1 w-4 h-4 accent-red-500 cursor-pointer flex-shrink-0"
                                title="Marcar para correção" />
                            )}
                          </div>
                        );
                      })}

                      {addressAnswers.length > 0 && (
                        <div className={`rounded-xl border text-sm ${
                          addressGroupMarked ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'
                        }`}>
                          <div className="flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-slate-200">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">📍 Endereço</p>
                            {userRole !== 'PARTNER' && (
                              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={addressGroupMarked}
                                  onChange={() => toggleAddressGroup(addressQuestionIds)}
                                  className="w-4 h-4 accent-red-500 cursor-pointer"
                                  title="Marcar endereço para correção"
                                />
                                <span className="text-xs text-slate-400">Solicitar correção</span>
                              </label>
                            )}
                          </div>
                          <div className="px-3.5 py-3 grid grid-cols-2 gap-x-6 gap-y-2">
                            {addressAnswers.map((ans: any) => (
                              <div key={ans.id}>
                                <p className="text-xs text-slate-400">{ans.question?.label}</p>
                                <p className="font-semibold text-slate-800 text-sm">{ans.value || <span className="text-slate-300 italic text-xs">não informado</span>}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

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
                        className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2.5 px-4 rounded-xl text-sm border border-red-200 transition">
                        Excluir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
