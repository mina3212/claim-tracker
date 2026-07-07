import { STAGES, STAGE_ICONS } from '../lib/supabase';

export default function StageTracker({ currentStage, stageEntries = [] }) {
  const currentIdx = STAGES.indexOf(currentStage);

  // stage_name → entry 매핑
  const entryMap = {};
  stageEntries.forEach(e => { entryMap[e.stage_name] = e; });

  return (
    <div className="stage-tracker">
      {STAGES.map((stage, i) => {
        const isDone    = i < currentIdx;
        const isCurrent = i === currentIdx;
        const cls = isDone ? 'done' : isCurrent ? 'current' : '';
        const entry = entryMap[stage];

        return (
          <div key={stage} className={`stage-step ${cls}`}>
            <div className="stage-dot">
              {(isDone || isCurrent) ? '✓' : STAGE_ICONS[i]}
            </div>
            <div className="stage-label">{stage}</div>
            {entry && (
              <div style={{ marginTop: 5, textAlign: 'center' }}>
                {entry.handler && (
                  <div style={{ fontSize: 10, color: isDone ? '#059669' : '#1d4ed8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {entry.handler}
                  </div>
                )}
                {entry.stage_date && (
                  <div style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {entry.stage_date}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
