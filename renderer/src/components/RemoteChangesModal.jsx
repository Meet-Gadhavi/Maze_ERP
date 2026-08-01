import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import Modal from './Modal';
import SButton from './SButton';
import { toast } from 'sonner';
import './RemoteChangesModal.css';

export default function RemoteChangesModal({ open, onClose, remoteChangeData, onApplyChanges, onDiscardChanges }) {
    const [applying, setApplying] = useState(false);
    const [discarding, setDiscarding] = useState(false);

    if (!open || !remoteChangeData) return null;

    const {
        ipAddress = '103.21.94.12 (Remote Laptop)',
        deviceName = 'Store Manager Laptop',
        timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        changes = [
            { category: 'Inventory', text: 'Stock level updated for 2 products', icon: 'Package' },
            { category: 'Sales & Invoices', text: '1 New sales invoice recorded (#INV-B2-004)', icon: 'ShoppingCart' },
            { category: 'Customers', text: 'Customer balance updated', icon: 'Users' }
        ]
    } = remoteChangeData;

    const handleApply = async () => {
        setApplying(true);
        try {
            if (onApplyChanges) await onApplyChanges();
            toast.success('Remote changes successfully merged into local database!');
            onClose();
        } catch (err) {
            toast.error(err.message || 'Failed to apply remote changes');
        } finally {
            setApplying(false);
        }
    };

    const handleDiscard = async () => {
        setDiscarding(true);
        try {
            if (onDiscardChanges) await onDiscardChanges();
            toast.info('Remote changes discarded. Local terminal data retained.');
            onClose();
        } catch (err) {
            toast.error(err.message || 'Failed to discard remote changes');
        } finally {
            setDiscarding(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            heading="Remote Store Changes Detected"
            width="560px"
        >
            <div className="remote-changes-modal-body">
                <div className="remote-warning-banner">
                    <Icons.AlertTriangle className="banner-icon" size={24} />
                    <div>
                        <div className="banner-title">Data Conflict Prevention</div>
                        <div className="banner-sub">
                            Another logged-in device updated your store data. Review the changes below before merging into this terminal.
                        </div>
                    </div>
                </div>

                <div className="remote-device-card">
                    <div className="device-header">
                        <Icons.Laptop size={18} className="device-icon" />
                        <div>
                            <div className="device-name">{deviceName}</div>
                            <div className="device-ip">IP: {ipAddress} • {timestamp}</div>
                        </div>
                    </div>
                    <span className="remote-status-badge">CLOUD SYNCED</span>
                </div>

                <div className="changes-summary-section">
                    <div className="summary-title">Summary of Remote Modifications:</div>
                    <div className="changes-list">
                        {changes.map((item, idx) => {
                            const IconComponent = Icons[item.icon] || Icons.CheckCircle2;
                            return (
                                <div key={idx} className="change-item">
                                    <div className="change-icon-box">
                                        <IconComponent size={16} />
                                    </div>
                                    <div>
                                        <div className="change-category">{item.category}</div>
                                        <div className="change-detail">{item.text}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="remote-actions-footer">
                    <SButton 
                        variant="secondary" 
                        onClick={handleDiscard}
                        disabled={applying || discarding}
                        loading={discarding}
                        style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                    >
                        <Icons.XCircle size={16} style={{ marginRight: '6px' }} />
                        Discard Remote Edits
                    </SButton>

                    <SButton 
                        variant="primary" 
                        onClick={handleApply}
                        disabled={applying || discarding}
                        loading={applying}
                        style={{ background: '#10b981', borderColor: '#059669' }}
                    >
                        <Icons.CheckCircle2 size={16} style={{ marginRight: '6px' }} />
                        Apply & Merge Changes
                    </SButton>
                </div>
            </div>
        </Modal>
    );
}
