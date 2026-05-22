import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PrintCtx = createContext(null);

export function PrintProvider({ children }) {
  const [printTitle, setPrintTitle] = useState('AJW 클레임 관리 시스템');
  const location = useLocation();

  /* 라우트 변경 시 기본 제목으로 리셋 */
  useEffect(() => {
    const defaults = {
      '/':            'AJW 클레임 관리 현황 대시보드',
      '/claims':      'AJW 클레임 목록',
      '/claims/new':  'AJW 클레임 접수',
      '/analytics':   'AJW 클레임 누적 분석',
      '/parts':       'AJW 품번/품명 마스터',
    };
    const matched = Object.entries(defaults).find(([path]) =>
      path === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(path)
    );
    setPrintTitle(matched ? matched[1] : 'AJW 클레임 관리 시스템');
  }, [location.pathname]);

  return (
    <PrintCtx.Provider value={{ printTitle, setPrintTitle }}>
      {children}
    </PrintCtx.Provider>
  );
}

export const usePrintTitle = () => useContext(PrintCtx);
