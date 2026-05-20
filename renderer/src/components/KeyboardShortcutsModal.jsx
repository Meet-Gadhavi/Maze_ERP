import React from 'react';
import { Icons } from './Icons';
import Modal from './Modal';
import SButton from './SButton';

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
    const shortcutGroups = [
        {
            title: 'Global Navigation',
            shortcuts: [
                { desc: 'Dashboard', keys: ['Alt', 'D'] },
                { desc: 'Inventory', keys: ['Alt', 'I'] },
                { desc: 'Sales', keys: ['Alt', 'S'] },
                { desc: 'Customers', keys: ['Alt', 'C'] },
                { desc: 'Purchases', keys: ['Alt', 'P'] },
                { desc: 'Settings', keys: ['Alt', 'E'] },
                { desc: 'Help Shortcuts', keys: ['Alt', 'K'] },
            ]
        },
        {
            title: 'Common Actions',
            shortcuts: [
                { desc: 'Create New Sale (On Sales Page)', keys: ['F2'] },
                { desc: 'Focus Search / Barcode', keys: ['/'] },
                { desc: 'Close Modal / Esc', keys: ['Esc'] },
            ]
        },
        {
            title: 'Quick Sale (POS)',
            shortcuts: [
                { desc: 'Navigate Products', keys: ['Arrows'] },
                { desc: 'Add Focused Product', keys: ['Enter'] },
                { desc: 'Quick Cash Payment', keys: ['F4'] },
            ]
        }
    ];

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            heading="Keyboard Shortcuts"
            size="medium"
            secondaryActions={
                <SButton onClick={onClose}>Close</SButton>
            }
        >
            <div className="flex-column">
                {shortcutGroups.map((group, gIdx) => (
                    <div key={gIdx} className="mb-24">
                        <h3 className="size-12 fw-600 text-secondary uppercase ls-wide mb-12">
                            {group.title}
                        </h3>
                        <div className="border rounded-8 overflow-hidden bg-surface-subtle">
                            {group.shortcuts.map((s, sIdx) => (
                                <div key={sIdx} className="flex align-center justify-between p-12 border-bottom last-no-border">
                                    <span className="size-14 text-primary">{s.desc}</span>
                                    <div className="flex gap-4">
                                        {s.keys.map((key, kIdx) => (
                                            <kbd key={kIdx} className="px-6 py-2 rounded-4 border bg-surface size-11 fw-700 shadow-sm font-sans">{key}</kbd>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
}
