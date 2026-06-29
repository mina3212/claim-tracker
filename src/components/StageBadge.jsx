import { STAGE_COLORS, STAGE_ICONS, STAGES, SUPPLIER_STAGE_COLORS, SUPPLIER_STAGE_ICONS, SUPPLIER_STAGES } from '../lib/supabase';

export default function StageBadge({ stage, size = 'md', supplier = false }) {
  const colors = supplier ? SUPPLIER_STAGE_COLORS : STAGE_COLORS;
  const icons  = supplier ? SUPPLIER_STAGE_ICONS  : STAGE_ICONS;
  const stageList = supplier ? SUPPLIER_STAGES : STAGES;

  const sc  = colors[stage] || { bg: '#f1f5f9', text: '#475569' };
  const idx = stageList.indexOf(stage);
  const icon = idx >= 0 ? icons[idx] : '';
  const padding = size === 'sm' ? '2px 8px' : '4px 12px';

  return (
    <span className="stage-badge" style={{ background: sc.bg, color: sc.text, padding }}>
      {icon} {stage}
    </span>
  );
}
