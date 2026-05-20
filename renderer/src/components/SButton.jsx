import React from 'react';
import './SButton.css';

/**
 * Shopify Polaris inspired Button component with fallback for when web components fail
 */
export default function SButton({
    children,
    onClick,
    variant = 'secondary',
    tone,
    loading,
    disabled,
    id,
    type = 'button',
    fullWidth,
    size = 'medium',
    style,
    className = '',
    slot
}) {
    // Fallback to native button if s-button web component is not available
    const useFallback = typeof window !== 'undefined' && !customElements.get('s-button');

    const buttonStyle = {
        ...style,
        width: fullWidth ? '100%' : style?.width,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: size === 'small' ? '6px 12px' : size === 'large' ? '14px 24px' : '10px 16px',
        borderRadius: '8px',
        border: 'none',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        fontSize: size === 'small' ? '13px' : size === 'large' ? '16px' : '14px',
        fontWeight: 600,
        background: variant === 'primary' ? '#008060' : variant === 'danger' ? '#d82c0d' : '#f1f2f4',
        color: variant === 'primary' || variant === 'danger' ? '#ffffff' : '#202223',
        opacity: disabled || loading ? 0.6 : 1,
        ...(tone === 'success' && { background: '#008060', color: '#ffffff' })
    };

    if (useFallback) {
        return (
            <button
                id={id}
                type={type}
                onClick={onClick}
                disabled={disabled || loading}
                style={buttonStyle}
                className={className}
            >
                {loading ? 'Loading...' : children}
            </button>
        );
    }

    return (
        <s-button
            id={id}
            type={type}
            variant={variant}
            tone={tone}
            loading={loading ? 'true' : undefined}
            disabled={disabled || loading ? 'true' : undefined}
            full-width={fullWidth ? 'true' : undefined}
            size={size}
            onClick={onClick}
            style={style}
            class={className}
            slot={slot}
        >
            <span className="s-button-content">
                {children}
            </span>
        </s-button>
    );
}
