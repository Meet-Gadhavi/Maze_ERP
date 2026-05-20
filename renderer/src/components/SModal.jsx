import React, { useEffect } from 'react';
import './SModal.css';

/**
 * Shopify Polaris inspired Modal component
 */
export default function SModal({
    id,
    heading,
    open,
    onClose,
    children,
    primaryAction,
    secondaryActions,
    size = 'base', // 'small' | 'small-100' | 'base' | 'large' | 'large-100'
    padding = 'base', // 'base' | 'none'
    accessibilityLabel
}) {
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && open) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [open, onClose]);

    if (!open) return null;

    const sizeClass = `s-modal--size-${size}`;
    const paddingClass = padding === 'none' ? 's-modal--padding-none' : '';

    return (
        <div className="s-modal-overlay" onClick={onClose} id={id}>
            <div 
                className={`s-modal ${sizeClass} ${paddingClass}`} 
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={accessibilityLabel || heading}
            >
                <div className="s-modal-header">
                    <h2 className="s-modal-heading">{heading}</h2>
                    <button className="s-modal-close-button" onClick={onClose} aria-label="Close">
                        <svg viewBox="0 0 20 20" className="s-modal-close-icon" focusable="false" aria-hidden="true">
                            <path d="m11.414 10 4.293-4.293a.999.999 0 1 0-1.414-1.414l-4.293 4.293-4.293-4.293a.999.999 0 1 0-1.414 1.414l4.293 4.293-4.293 4.293a.997.997 0 0 0 0 1.414.999.999 0 0 0 1.414 0l4.293-4.293 4.293 4.293a.999.999 0 0 0 1.414-1.414l-4.293-4.293Z"></path>
                        </svg>
                    </button>
                </div>
                
                <div className="s-modal-content">
                    {children}
                </div>

                {(primaryAction || secondaryActions) && (
                    <div className="s-modal-footer">
                        <div className="s-modal-footer-actions">
                            {secondaryActions && (
                                <div className="s-modal-secondary-actions">
                                    {secondaryActions}
                                </div>
                            )}
                            {primaryAction && (
                                <div className="s-modal-primary-action">
                                    {primaryAction}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
