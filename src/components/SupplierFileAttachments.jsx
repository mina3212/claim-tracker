import { useState, useEffect, useRef } from 'react';
import {
  fetchSupplierFiles, uploadSupplierFile, insertSupplierFile,
  deleteSupplierFile, getSupplierFileUrl,
  logFileDownload, fetchDownloadLogs,
} from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { useSupplierClaims } from '../context/SupplierClaimsContext';

const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.xlsx,.xls,.doc,.docx';

function fileIcon(type) {
  if (!type) return '📄';
  if (type.includes('pdf'))   return '📕';
  if (type.includes('image')) return '🖼️';
  if (type.includes('word') || type.includes('document')) return '📝';
  if (type.includes('sheet') || type.includes('excel'))   return '📊';
  return '📄';
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function SupplierFileAttachments({ claimId, user, isAdmin }) {
  const toast = useToast();
  const { markClaimHasFiles } = useSupplierClaims();
  const fileRef = useRef(null);

  const [files,       setFiles]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [dragging,    setDragging]    = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [pending,     setPending]     = useState([]);     // files staged for upload
  const [logs,        setLogs]        = useState([]);
  const [showLogs,    setShowLogs]    = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [previewUrl,  setPreviewUrl]  = useState(null);
  const [previewName, setPreviewName] = useState('');
  const [loadingId,   setLoadingId]   = useState(null);  // file id being opened

  useEffect(() => {
    fetchSupplierFiles(claimId)
      .then(setFiles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [claimId]);

  /* ── 파일 선택 ── */
  const handleFiles = (selected) => {
    const valid = [...selected].filter(f => f.size <= 20 * 1024 * 1024);
    if (valid.length < selected.length) toast('파일 크기 초과', '20MB 이하 파일만 첨부 가능합니다', 'error');
    setPending(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...valid.filter(f => !names.has(f.name))];
    });
  };

  /* ── 업로드 ── */
  const handleUpload = async () => {
    if (!pending.length) return;
    setUploading(true);
    const newFiles = [];
    for (const file of pending) {
      try {
        const info = await uploadSupplierFile(file, claimId);
        const row  = await insertSupplierFile(claimId, info, user);
        newFiles.push(row);
      } catch (err) {
        toast('업로드 실패', `${file.name}: ${err.message}`, 'error');
      }
    }
    setFiles(prev => [...prev, ...newFiles]);
    setPending([]);
    setUploading(false);
    if (newFiles.length) {
      markClaimHasFiles(claimId);
      toast('업로드 완료', `${newFiles.length}개 파일이 첨부되었습니다`, 'success');
    }
  };

  /* ── 미리보기 ── */
  const handlePreview = async (file) => {
    setLoadingId(file.id);
    try {
      const url = await getSupplierFileUrl(file.file_path);
      const isImage = (file.file_type || '').includes('image');
      if (isImage) {
        setPreviewUrl(url);
        setPreviewName(file.file_name);
      } else {
        window.open(url, '_blank');
      }
    } catch {
      toast('미리보기 실패', '파일을 불러올 수 없습니다', 'error');
    } finally {
      setLoadingId(null);
    }
  };

  /* ── 다운로드 ── */
  const handleDownload = async (file) => {
    setLoadingId(file.id + '_dl');
    try {
      const url = await getSupplierFileUrl(file.file_path);
      await logFileDownload(file.id, claimId, file.file_name, user);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      a.click();
    } catch (err) {
      toast('다운로드 실패', err.message, 'error');
    } finally {
      setLoadingId(null);
    }
  };

  /* ── 삭제 (관리자) ── */
  const handleDelete = async (file) => {
    if (!confirm(`"${file.file_name}"을 삭제하시겠습니까?`)) return;
    try {
      await deleteSupplierFile(file.id, file.file_path);
      setFiles(prev => prev.filter(f => f.id !== file.id));
      toast('삭제 완료', '', 'success');
    } catch (err) {
      toast('삭제 실패', err.message, 'error');
    }
  };

  /* ── 다운로드 이력 (관리자) ── */
  const toggleLogs = async () => {
    if (!showLogs && !logs.length) {
      setLoadingLogs(true);
      try {
        const data = await fetchDownloadLogs(claimId);
        setLogs(data);
      } catch {
        toast('이력 조회 실패', '', 'error');
      } finally {
        setLoadingLogs(false);
      }
    }
    setShowLogs(prev => !prev);
  };

  const isImage = (type) => (type || '').includes('image');

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header" style={{ marginBottom: 12 }}>
        <span className="card-title" style={{ margin: 0 }}>📎 첨부파일</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={toggleLogs}>
              {loadingLogs ? '...' : showLogs ? '📋 이력 닫기' : '📋 다운로드 이력'}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
            ➕ 파일 추가
          </button>
          <input ref={fileRef} type="file" multiple accept={FILE_ACCEPT} style={{ display: 'none' }}
            onChange={e => handleFiles([...e.target.files])} />
        </div>
      </div>

      {/* 업로드 대기 파일 */}
      {pending.length > 0 && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 8 }}>
            업로드 대기 중 ({pending.length}개)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            {pending.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span>{fileIcon(f.type)}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>{fmtSize(f.size)}</span>
                <button onClick={() => setPending(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, padding: '0 4px' }}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handleUpload} disabled={uploading}>
              {uploading ? '⏳ 업로드 중...' : '☁️ 업로드'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setPending([])}>취소</button>
          </div>
        </div>
      )}

      {/* 드래그 드롭 영역 (파일 없을 때) */}
      {files.length === 0 && pending.length === 0 && !loading && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles([...e.dataTransfer.files]); }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? '#3b82f6' : '#e2e8f0'}`,
            borderRadius: 10, padding: '28px 16px', textAlign: 'center', cursor: 'pointer',
            background: dragging ? '#eff6ff' : '#f8fafc', transition: '.15s', marginBottom: 8,
          }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>파일을 드래그하거나 클릭하여 첨부</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>PDF, 이미지, Excel, Word · 최대 20MB</div>
        </div>
      )}

      {/* 파일 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: 12 }}>불러오는 중...</div>
      ) : files.length > 0 ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles([...e.dataTransfer.files]); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map(file => (
            <div key={file.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0',
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{fileIcon(file.file_type)}</span>
              <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.file_name}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  {fmtSize(file.file_size)}
                  {file.uploaded_by_name && <> · {file.uploaded_by_name}</>}
                  {file.created_at && <> · {file.created_at.slice(0, 10)}</>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => handlePreview(file)}
                  disabled={loadingId === file.id}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11 }}
                  title={isImage(file.file_type) ? '이미지 미리보기' : '새 탭으로 열기'}
                >
                  {loadingId === file.id ? '...' : '👁 미리보기'}
                </button>
                <button
                  onClick={() => handleDownload(file)}
                  disabled={loadingId === file.id + '_dl'}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11 }}
                >
                  {loadingId === file.id + '_dl' ? '...' : '📥 다운로드'}
                </button>
                {isAdmin && (
                  <button onClick={() => handleDelete(file)} className="btn btn-sm"
                    style={{ fontSize: 11, background: '#fee2e2', color: '#dc2626', border: 'none' }}>
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
          {dragging && (
            <div style={{ border: '2px dashed #3b82f6', borderRadius: 8, padding: 14, textAlign: 'center', fontSize: 12, color: '#3b82f6', background: '#eff6ff' }}>
              파일을 놓아 추가하세요
            </div>
          )}
        </div>
      ) : null}

      {/* 관리자 다운로드 이력 */}
      {isAdmin && showLogs && (
        <div style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
            📋 다운로드 이력 ({logs.length}건)
          </div>
          {logs.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0' }}>다운로드 이력이 없습니다</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>파일명</th>
                    <th style={{ textAlign: 'center' }}>다운로드한 사람</th>
                    <th style={{ textAlign: 'center' }}>이메일</th>
                    <th style={{ textAlign: 'center' }}>일시</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontSize: 12 }}>{log.file_name}</td>
                      <td style={{ textAlign: 'center', fontSize: 12 }}>{log.downloader_name}</td>
                      <td style={{ textAlign: 'center', fontSize: 11, color: '#64748b' }}>{log.downloader_email}</td>
                      <td style={{ textAlign: 'center', fontSize: 11, color: '#64748b' }}>
                        {log.downloaded_at?.replace('T', ' ').slice(0, 16)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 이미지 미리보기 모달 */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={previewUrl} alt={previewName}
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8, display: 'block', objectFit: 'contain' }} />
            <div style={{ marginTop: 8, textAlign: 'center', color: '#fff', fontSize: 13 }}>{previewName}</div>
            <button onClick={() => setPreviewUrl(null)}
              style={{ position: 'absolute', top: -12, right: -12, width: 28, height: 28, borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
