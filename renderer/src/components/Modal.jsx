import React, { useEffect, useRef, useMemo, useState } from 'react';
import './Modal.css';

/**
 * Unified Polaris-style Modal Component for Maze ERP
 * Now wrapping the Shopify Polaris <s-modal> web component with fallback
 */
export default function Modal({
    isOpen,
    open,
    onClose,
    title,
    heading,
    children,
    footer,
    primaryAction,
    secondaryAction,
    secondaryActions,
    size = 'base',
    variant = 'default',
    id
}) {
    const isModalOpen = open !== undefined ? open : isOpen;
    const modalHeading = heading || title;
    const modalRef = useRef(null);

    // Check if s-modal web component is available, otherwise use fallback
    const useFallback = typeof window !== 'undefined' && !customElements.get('s-modal');

    // Generate a unique ID if none provided to avoid trigger conflicts
    const modalId = useMemo(() => id || `maze-modal-${Math.random().toString(36).substr(2, 9)}`, [id]);

    // Fallback modal state
    const [fallbackOpen, setFallbackOpen] = useState(false);

    useEffect(() => {
        if (useFallback) {
            if (isModalOpen) setFallbackOpen(true);
            else setFallbackOpen(false);
            return;
        }

        if (isModalOpen && modalRef.current) {
            const el = modalRef.current;
            const triggerId = 'trigger-' + modalId;

            // Trigger Polaris modal show command
            const timeoutId = setTimeout(() => {
                let btn = document.getElementById(triggerId);
                if (!btn) {
                    btn = document.createElement('button');
                    btn.id = triggerId;
                    btn.style.display = 'none';
                    btn.setAttribute('commandFor', modalId);
                    btn.setAttribute('command', '--show');
                    document.body.appendChild(btn);
                }
                btn.click();
            }, 50);

            const handleHide = () => {
                if (onClose) onClose();
            };
            el.addEventListener('hide', handleHide);

            return () => {
                clearTimeout(timeoutId);
                el.removeEventListener('hide', handleHide);
                // Clean up trigger button
                const btn = document.getElementById(triggerId);
                if (btn) btn.remove();
            };
        }
    }, [isModalOpen, onClose, modalId, useFallback]);

    if (!isModalOpen) return null;

    // Fallback modal for when web components aren't available
    if (useFallback) {
        const fallbackStyles = {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
        };
        const modalStyles = {
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            minWidth: size === 'small' ? '300px' : size === 'large' ? '600px' : '400px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto'
        };

        return (
            <div style={fallbackStyles} onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
                <div style={modalStyles}>
                    <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 600 }}>{modalHeading}</h2>
                    <div style={{ marginBottom: '20px' }}>{children}</div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        {secondaryActions}
                        {primaryAction}
                    </div>
                </div>
            </div>
        );
    }

    // Map internal sizes to Polaris sizes
    const polarisSize = size === 'base' ? 'medium' : size === 'small' ? 'small' : size === 'large' ? 'large' : size;

    return (
        <s-modal
            id={modalId}
            ref={modalRef}
            heading={modalHeading}
            size={polarisSize}
        >
            <div className="maze-modal-content-wrapper">
                {children}
            </div>

            {primaryAction && React.isValidElement(primaryAction) && React.cloneElement(primaryAction, { slot: 'primary-action' })}

            {secondaryAction && React.isValidElement(secondaryAction) && React.cloneElement(secondaryAction, { slot: 'secondary-actions' })}

            {secondaryActions && React.Children.map(secondaryActions, (action) =>
                React.isValidElement(action) ? React.cloneElement(action, { slot: 'secondary-actions' }) : action
            )}

            {footer && React.isValidElement(footer) && React.cloneElement(footer, { slot: 'secondary-actions' })}
        </s-modal>
    );
}
