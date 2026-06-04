import React from 'react';

export const Skeleton = ({ type = 'text', count = 3, style }) => {
    if (type === 'table') {
        return (
            <div style={{ width: '100%', ...style }}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '12px' }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="skeleton-box" style={{ flex: 1, height: '16px', marginRight: '16px' }} />
                    ))}
                </div>
                {Array.from({ length: count }).map((_, idx) => (
                    <div key={idx} style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '16px 12px' }}>
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="skeleton-box" style={{ flex: 1, height: '14px', marginRight: '16px' }} />
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    if (type === 'card') {
        return (
            <div className="skeleton-card" style={style}>
                <div className="skeleton-box skeleton-title" />
                <div className="skeleton-box skeleton-text" />
                <div className="skeleton-box skeleton-text" style={{ width: '80%' }} />
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <div className="skeleton-box skeleton-button" />
                    <div className="skeleton-box skeleton-button" style={{ width: '80px' }} />
                </div>
            </div>
        );
    }

    if (type === 'list') {
        return (
            <div style={style}>
                {Array.from({ length: count }).map((_, idx) => (
                    <div key={idx} className="skeleton-row" style={{ padding: '12px 0' }}>
                        <div className="skeleton-box skeleton-avatar" style={{ marginRight: '12px' }} />
                        <div style={{ flex: 1 }}>
                            <div className="skeleton-box skeleton-title" style={{ width: '40%', height: '14px', marginBottom: '6px' }} />
                            <div className="skeleton-box skeleton-text" style={{ width: '60%', height: '10px' }} />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', ...style }}>
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="skeleton-box skeleton-text" />
            ))}
        </div>
    );
};

export default Skeleton;
