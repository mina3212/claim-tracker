import { useState } from 'react';

export default function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)',
          background: '#1e293b', color: '#e2e8f0', fontSize: 11,
          padding: '5px 10px', borderRadius: 6, whiteSpace: 'nowrap',
          zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,.2)',
          pointerEvents: 'none', lineHeight: 1.4,
        }}>
          {text}
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            border: '5px solid transparent', borderTopColor: '#1e293b',
          }} />
        </div>
      )}
    </div>
  );
}
