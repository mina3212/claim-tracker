import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchSuppliers, upsertSuppliers, deleteSupplier, deleteAllSuppliers, uid } from '../lib/supabase';

export default function Suppliers() {
  const { user, isAdmin } = useAuth();
  const toast   = useToast();
  const fileRef = useRef();

  const [suppliers,  setSuppliers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [uploading,  setUploading]  = useState(false);
  const [delAllOpen, setDelAllOpen] = useState(false);
  const [delAllBusy, setDelAllBusy] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setSuppliers(await fetchSuppliers()); }
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

      const findCol = (row, candidates) => {
        const keys = Object.keys(row);
        return keys.find(k => candidates.some(c => k.trim().replace(/\s/g, '').includes(c)));
      };

      if (!rows.length) { toast('오류', '데이터가 없습니다', 'error'); return; }
      const sample  = rows[0];
      const nameCol = findCol(sample, ['공급사명', '공급사', 'supplier_name', 'name', 'SupplierName', '업체명', '업체']);

      if (!nameCol) {
        toast('컬럼 인식 실패', '"공급사명" 컬럼이 필요합니다', 'error');
        return;
      }

      const existingIdMap = Object.fromEntries(suppliers.map(s => [s.name, s.id]));
      const seen = new Set();
      const upsertRows = rows
        .filter(r => r[nameCol]?.toString().trim())
        .map(r => { const n = r[nameCol].toString().trim(); return { id: existingIdMap[n] || uid(), name: n }; })
        .filter(r => { if (seen.has(r.name)) return false; seen.add(r.name); return true; });

      await upsertSuppliers(upsertRows);
      await load();
      toast('업로드 완료', `${upsertRows.length}개 공급사가 등록/갱신되었습니다`, 'success');
    } catch (e) {
      toast('업로드 실패', e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAll = async () => {
    setDelAllBusy(true);
    try {
      await deleteAllSuppliers();
      setSuppliers([]);
      setDelAllOpen(false);
      toast('전체 삭제 완료', '공급사 데이터가 모두 삭제되었습니다', 'success');
    } catch (e) {
      toast('삭제 실패', e.message, 'error');
    } finally {
      setDelAllBusy(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`"${name}" 공급사를 삭제하시겠습니까?`)) return;
    try {
      await deleteSupplier(id);
      setSuppliers(prev => prev.filter(s => s.id !== id));
      toast('삭제 완료', '', 'success');
    } catch (e) {
      toast('삭제 실패', e.message, 'error');
    }
  };

  const filtered = suppliers.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!user) return (
    <div>
      <div className="page-header"><div className="page-title">거래처 관리</div></div>
      <div className="error-box">⚠️ 로그인 후 이용 가능합니다.</div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">거래처 관리</div>
          <div className="page-sub">전체 {suppliers.length}개 공급사 등록됨</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={load}>🔄 새로고침</button>
          <button
            className="btn btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? '⏳ 업로드 중...' : '📂 엑셀 업로드'}
          </button>
          {isAdmin && suppliers.length > 0 && (
            <button className="btn btn-danger" onClick={() => setDelAllOpen(true)}>
              🗑 전체 삭제
            </button>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      </div>

      <div className="setup-box" style={{ marginBottom: 16 }}>
        <strong>📋 엑셀 업로드 안내</strong><br />
        <code>공급사명</code> 컬럼이 있는 Excel(.xlsx, .xls) 또는 CSV 파일을 업로드하세요.<br />
        같은 이름이면 자동으로 갱신(upsert)됩니다. 불량 접수 시 🔍 버튼으로 검색하여 선택할 수 있습니다.
      </div>

      <div className="filter-bar">
        <input
          className="filter-input"
          placeholder="🔍 공급사명 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{filtered.length}개 표시</span>
      </div>

      {delAllOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 420, maxWidth: '90vw', boxShadow: '0 24px 64px rgba(0,0,0,.2)', overflow: 'hidden' }}>
            <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '20px 24px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#991b1b' }}>⚠️ 공급사 전체 삭제</div>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 16 }}>
                현재 등록된 <strong style={{ color: '#dc2626' }}>{suppliers.length}개</strong> 공급사가 모두 삭제됩니다.
              </p>
              <p style={{ fontSize: 13, color: '#6b7280' }}>이 작업은 되돌릴 수 없습니다.</p>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setDelAllOpen(false)} disabled={delAllBusy}>취소</button>
              <button className="btn btn-danger" onClick={handleDeleteAll} disabled={delAllBusy} style={{ background: '#dc2626', color: '#fff' }}>
                {delAllBusy ? '⏳ 삭제 중...' : `🗑 ${suppliers.length}개 전체 삭제`}
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
            <div className="empty-icon">🏭</div>
            {suppliers.length === 0 ? '등록된 공급사가 없습니다. 엑셀을 업로드해 주세요.' : '검색 결과 없음'}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>공급사명</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ color: '#94a3b8', width: 50 }}>{i + 1}</td>
                    <td>🏭 {s.name}</td>
                    <td style={{ width: 50 }}>
                      <button
                        className="btn btn-danger btn-icon btn-sm"
                        onClick={() => handleDelete(s.id, s.name)}
                      >🗑</button>
                    </td>
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
