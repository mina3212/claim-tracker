export function exportToExcel(rows, filename, sheetName = 'Sheet1') {
  if (!window.XLSX) { alert('XLSX 라이브러리를 불러오지 못했습니다.'); return; }
  if (!rows.length) { alert('내보낼 데이터가 없습니다.'); return; }
  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.json_to_sheet(rows);

  // 컬럼 너비 자동 조정 (최대 40)
  const cols = Object.keys(rows[0]).map(k => ({
    wch: Math.min(40, Math.max(k.length + 2, ...rows.map(r => String(r[k] ?? '').length))),
  }));
  ws['!cols'] = cols;

  window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
  window.XLSX.writeFile(wb, filename);
}
