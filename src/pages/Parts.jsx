import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchParts, upsertParts, deletePart, uid } from '../lib/supabase';

export default function Parts() {
  const { user, isAdmin } = useAuth();
  const toast    = useToast();
  const fileRef  = useRef();

  const [parts,    setParts]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [uploading, setUploading] = useState(false);

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

      if (!numCol || !nameCol) {
        toast('컬럼 인식 실패', '"품번"과 "품명" 컬럼이 필요합니다', 'error');
        return;
      }

      const upsertRows = rows
        .filter(r => r[numCol]?.toString().trim())
        .map(r => ({
          id: uid(),
          part_number: r[numCol].toString().trim(),
          part_name:   r[nameCol]?.toString().trim() || '',
        }));

      await upsertParts(upsertRows);
      await load();
      toast('업로드 완료', `${upsertRows.length}개 품목이 등록/갱신되었습니다`, 'success');
    } catch (e) {
      toast('업로드 실패', e.message, 'error');
    } finally {
      setUploading(false);
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
    return !q || p.part_number.toLowerCase().includes(q) || p.part_name.toLowerCase().includes(q);
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={load}>🔄 새로고침</button>
          <button
            className="btn btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !isAdmin}
            title={!isAdmin ? '관리자만 업로드 가능' : ''}
          >
            {uploading ? '⏳ 업로드 중...' : '📂 엑셀 업로드'}
          </button>
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id}>
                    <td style={{ color: '#94a3b8', width: 50 }}>{i + 1}</td>
                    <td className="mono">{p.part_number}</td>
                    <td>{p.part_name}</td>
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
