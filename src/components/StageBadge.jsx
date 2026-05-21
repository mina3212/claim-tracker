import { STAGE_COLORS, STAGE_ICONS, STAGES } from '../lib/supabase';

export default function StageBadge({ stage, size = 'md' }) {
  const sc  = STAGE_COLORS[stage] || { bg: '#f1f5f9', text: '#475569' };
  const idx = STAGES.indexOf(stage);
  const icon = idx >= 0 ? STAGE_ICONS[idx] : '';
  const padding = size === 'sm' ? '2px 8px' : '4px 12px';

  return (
    <span
      className="stage-badge"
      style={{ background: sc.bg, color: sc.text, padding }}
    >
      {icon} {stage}
    </span>
  );
}
