import React from 'react';
import ConnectedServicesCard from '../../components/automation/ConnectedServicesCard';

export default function GmailConnect() {
    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>Gmail Integration</h1>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>Manage your connected business Gmail accounts</p>
            </div>
            <ConnectedServicesCard />
        </div>
    );
}
