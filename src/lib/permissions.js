export const PERM_SECTIONS = [
  {
    section: '고객사 클레임',
    perms: [
      { key: 'customer_read',      label: '조회' },
      { key: 'customer_write',     label: '접수·수정' },
      { key: 'customer_analytics', label: '누적 분석' },
    ],
  },
  {
    section: '공급사 불량',
    perms: [
      { key: 'supplier_read',      label: '조회' },
      { key: 'supplier_write',     label: '접수·수정' },
      { key: 'supplier_analytics', label: '누적 분석' },
    ],
  },
  {
    section: '종합 보고서',
    perms: [
      { key: 'report', label: 'AI 종합 분석' },
    ],
  },
];

export const ALL_PERM_KEYS = PERM_SECTIONS.flatMap(s => s.perms.map(p => p.key));

const ALL_ON  = Object.fromEntries(ALL_PERM_KEYS.map(k => [k, true]));
const ALL_OFF = Object.fromEntries(ALL_PERM_KEYS.map(k => [k, false]));

// 부서 기반 기본값 (permissions 컬럼이 없는 기존 사용자용 fallback)
const DEPT_DEFAULTS = {
  '영업팀':    { customer_read: true, customer_write: true, customer_analytics: true },
  '마케팅팀':  { customer_read: true, customer_write: true, customer_analytics: true },
  '영업관리팀': { customer_read: true, customer_write: true, customer_analytics: true },
  '품질기술팀': { ...ALL_ON },
};

export function resolvePermissions(profile) {
  if (!profile) return ALL_OFF;
  if (profile.is_admin) return ALL_ON;

  // permissions 컬럼이 명시적으로 설정된 경우 사용
  if (profile.permissions && Object.keys(profile.permissions).length > 0) {
    return { ...ALL_OFF, ...profile.permissions };
  }

  // 미설정이면 부서 기본값 적용
  return { ...ALL_OFF, ...(DEPT_DEFAULTS[profile.department] ?? { customer_read: true, customer_write: true, customer_analytics: true }) };
}
