import React from 'react';
import UnifiedModal from './Modal';

/**
 * Standard Form Components for Maze ERP
 */

export const Label = ({ children, required, className = '', ...props }) => (
    <label className={`form-label ${className}`} {...props}>
        {children}
        {required && <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>*</span>}
    </label>
);

export const Input = ({ error, icon, suffix, className = '', ...props }) => (
    <div className="form-input-wrapper">
        <div className={`input-container ${error ? 'has-error' : ''} ${suffix ? 'input-with-suffix' : ''}`}>
            {icon && <div className="input-icon-left">{icon}</div>}
            <input className={`form-control ${className}`} {...props} />
            {suffix && <span className="suffix">{suffix}</span>}
        </div>
        {error && <span className="error-message">{error}</span>}
    </div>
);

export const FormGroup = ({ label, required, children, className = '' }) => (
    <div className={`form-group ${className}`}>
        {label && <Label required={required}>{label}</Label>}
        {children}
    </div>
);

export const Modal = ({ isOpen, onClose, title, children, footer, maxWidth = 520 }) => {
    return (
        <UnifiedModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={footer}
            maxWidth={maxWidth}
        >
            {children}
        </UnifiedModal>
    );
};
