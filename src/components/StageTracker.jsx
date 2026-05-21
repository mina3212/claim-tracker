import { STAGES, STAGE_ICONS } from '../lib/supabase';

export default function StageTracker({ currentStage }) {
  const currentIdx = STAGES.indexOf(currentStage);

  return (
    <div className="stage-tracker">
      {STAGES.map((stage, i) => {
        const isDone    = i < currentIdx;
        const isCurrent = i === currentIdx;
        const cls = isDone ? 'done' : isCurrent ? 'current' : '';
        return (
          <div key={stage} className={`stage-step ${cls}`}>
            <div className="stage-dot">
              {isDone ? '✓' : STAGE_ICONS[i]}
            </div>
            <div className="stage-label">{stage}</div>
          </div>
        );
      })}
    </div>
  );
}
