import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchParts, upsertParts, deletePart, deleteAllParts, uid } from '../lib/supabase';

export default function Parts() {
  const { user, isAdmin } = useAuth();
  const toast    = useToast();
  const fileRef  = useRef();

  const [parts,       setParts]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [uploading,   setUploading]   = useState(false);
  const [delAllOpen,  setDelAllOpen]  = useState(false);
  const [delAllBusy,  setDelAllBusy]  = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setParts(await fetchParts()); }
    catch (e) { toast('로드 실패', e.message, 'error'); }
    finally { setLoading(false); }
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!window.XLSX) {
      toast('오류', 'XLSX 라이브러리가 없습니다', 'error');
      return;
    }

    setUploading(true);
    try {
      const ab   = await file.arrayBuffer();
      const wb   = window.XLSX.read(ab, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(ws, { defval: '' });

      // 컬럼명 유연하게 인식
      const findCol = (row, candidates) => {
        const keys = Object.keys(row);
        return keys.find(k => candidates.some(c => k.trim().replace(/\s/g, '').includes(c)));
      };

      if (!rows.length) { toast('오류', '데이터가 없습니다', 'error'); return; }
      const sample = rows[0];
      const numCol  = findCol(sample, ['품번','PartNumber','part_number','PART_NO','partno','부품번호']);
      const nameCol = findCol(sample, ['품명','PartName','part_name','PART_NAME','부품명','품목명']);
      const specCol = findCol(sample, ['규격','Spec','spec','SPEC','specification','사양']);

      if (!numCol || !nameCol) {
        toast('컬럼 인식 실패', '"품번"과 "품명" 컬럼이 필요합니다', 'error');
        return;
      }

      const seen = new Set();
      const upsertRows = rows
        .filter(r => r[numCol]?.toString().trim())
        .map(r => ({
          id: uid(),
          part_number: r[numCol].toString().trim(),
          part_name:   r[nameCol]?.toString().trim() || '',
          spec:        specCol ? (r[specCol]?.toString().trim() || null) : null,
        }))
        .filter(r => {
          if (seen.has(r.part_number)) return false;
          seen.add(r.part_number);
          return true;
        });

      await upsertParts(upsertRows);
      await load();
      toast('업로드 완료', `${upsertRows.length}개 품목이 등록/갱신되었습니다`, 'success');
    } catch (e) {
      toast('업로드 실패', e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAll = async () => {
    setDelAllBusy(true);
    try {
      await deleteAllParts();
      setParts([]);
      setDelAllOpen(false);
      toast('전체 삭제 완료', '품번/품명 데이터가 모두 삭제되었습니다', 'success');
    } catch (e) {
      toast('삭제 실패', e.message, 'error');
    } finally {
      setDelAllBusy(false);
    }
  };

  const handleDelete = async (id, partNumber) => {
    if (!confirm(`"${partNumber}" 품목을 삭제하시겠습니까?`)) return;
    try {
      await deletePart(id);
      setParts(prev => prev.filter(p => p.id !== id));
      toast('삭제 완료', '', 'success');
    } catch (e) {
      toast('삭제 실패', e.message, 'error');
    }
  };

  const filtered = parts.filter(p => {
    const q = search.toLowerCase();
    return !q
      || p.part_number.toLowerCase().includes(q)
      || p.part_name.toLowerCase().includes(q)
      || (p.spec || '').toLowerCase().includes(q);
  });

  if (!user) return (
    <div>
      <div className="page-header"><div className="page-title">품번 관리</div></div>
      <div className="error-box">⚠️ 로그인 후 이용 가능합니다. 사이드바에서 로그인해 주세요.</div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">품번 관리</div>
          <div className="page-sub">전체 {parts.length}개 품목 등록됨</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={load}>🔄 새로고침</button>
          {isAdmin && (
            <button
              className="btn btn-primary"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? '⏳ 업로드 중...' : '📂 엑셀 업로드'}
            </button>
          )}
          {isAdmin && parts.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={() => setDelAllOpen(true)}
            >
              🗑 전체 삭제
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
        </div>
      </div>

      {/* 업로드 안내 */}
      <div className="setup-box" style={{ marginBottom: 16 }}>
        <strong>📋 엑셀 업로드 안내</strong><br />
        <code>품번</code> · <code>품명</code> 컬럼이 있는 Excel(.xlsx, .xls) 또는 CSV 파일을 업로드하세요.<br />
        같은 품번이면 자동으로 갱신(upsert)됩니다. 엑셀 라이브러리는 아래에서 로드됩니다.
      </div>

      {/* 검색 */}
      <div className="filter-bar">
        <input
          className="filter-input"
          placeholder="🔍 품번 / 품명 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          {filtered.length}개 표시
        </span>
      </div>

      {/* 전체 삭제 확인 모달 */}
      {delAllOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 0,
            width: 420, maxWidth: '90vw',
            boxShadow: '0 24px 64px rgba(0,0,0,.2)', overflow: 'hidden',
          }}>
            {/* 헤더 */}
            <div style={{
              background: '#fef2f2', borderBottom: '1px solid #fecaca',
              padding: '20px 24px',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#991b1b' }}>
                ⚠️ 품번/품명 전체 삭제
              </div>
            </div>
            {/* 본문 */}
            <div style={{ padding: '24px' }}>
              <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 16 }}>
                현재 등록된 <strong style={{ color: '#dc2626' }}>{parts.length}개</strong> 품목이
                모두 삭제됩니다.
              </p>
              <p style={{ fontSize: 13, color: '#6b7280' }}>
                이 작업은 되돌릴 수 없습니다. 삭제 후 다시 엑셀을 업로드해야 합니다.
              </p>
            </div>
            {/* 푸터 */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid #f1f5f9',
              display: 'flex', justifyContent: 'flex-end', gap: 8,
            }}>
              <button
                className="btn btn-ghost"
                onClick={() => setDelAllOpen(false)}
                disabled={delAllBusy}
              >취소</button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteAll}
                disabled={delAllBusy}
                style={{ background: '#dc2626', color: '#fff' }}
              >
                {delAllBusy ? '⏳ 삭제 중...' : `🗑 ${parts.length}개 전체 삭제`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="loading">⏳ 불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🔩</div>
            {parts.length === 0 ? '등록된 품번이 없습니다. 엑셀을 업로드해 주세요.' : '검색 결과 없음'}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>품번</th>
                  <th>품명</th>
                  <th>규격</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id}>
                    <td style={{ color: '#94a3b8', width: 50 }}>{i + 1}</td>
                    <td className="mono">{p.part_number}</td>
                    <td>
                      {p.part_name}
                      {p.spec && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>
                          [{p.spec}]
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{p.spec || '-'}</td>
                    {isAdmin && (
                      <td style={{ width: 50 }}>
                        <button
                          className="btn btn-danger btn-icon btn-sm"
                          onClick={() => handleDelete(p.id, p.part_number)}
                        >🗑</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
