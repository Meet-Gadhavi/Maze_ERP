import React, { useRef, useEffect } from 'react';
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
    slot,
    selected,
    ...props
}) {
    const buttonRef = useRef(null);

    // Fallback to native button if s-button web component is not available
    const useFallback = typeof window !== 'undefined' && !customElements.get('s-button');

    const isSelected = selected;

    useEffect(() => {
        if (useFallback || !buttonRef.current) return;

        const applyShadowStyles = () => {
            const el = buttonRef.current;
            const shadowRoot = el.shadowRoot;
            if (!shadowRoot) return;

            const innerButton = shadowRoot.querySelector('button') || shadowRoot.querySelector('a');
            if (!innerButton) return;

            if (isSelected) {
                innerButton.style.setProperty('background', '#202223', 'important');
                innerButton.style.setProperty('color', '#ffffff', 'important');
                innerButton.style.setProperty('border', '1px solid #202223', 'important');
                innerButton.style.setProperty('box-shadow', 'none', 'important');
            } else {
                innerButton.style.removeProperty('background');
                innerButton.style.removeProperty('color');
                innerButton.style.removeProperty('border');
                innerButton.style.removeProperty('box-shadow');
            }
        };

        applyShadowStyles();

        // Run after a short delay to ensure rendering completes
        const timer = setTimeout(applyShadowStyles, 50);
        return () => clearTimeout(timer);
    }, [isSelected, useFallback]);

    const buttonStyle = {
        width: fullWidth ? '100%' : style?.width,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: size === 'small' ? '6px 12px' : size === 'large' ? '14px 24px' : '10px 16px',
        borderRadius: '8px',
        border: isSelected 
            ? '1px solid #202223' 
            : style?.['--s-button-variant-secondary-box-shadow-26021'] 
                ? (style['--s-button-variant-secondary-box-shadow-26021'].includes('#202223') ? '1px solid #202223' : '1px solid var(--border-light)')
                : 'none',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        fontSize: size === 'small' ? '13px' : size === 'large' ? '16px' : '14px',
        fontWeight: 600,
        background: isSelected 
            ? '#202223' 
            : style?.['--t-fill-26021'] || style?.['--s-button-variant-secondary-background-26021'] || (variant === 'primary' ? '#008060' : variant === 'danger' ? '#d82c0d' : '#f1f2f4'),
        color: isSelected 
            ? '#ffffff' 
            : style?.['--t-text-26021'] || (variant === 'primary' || variant === 'danger' ? '#ffffff' : '#202223'),
        opacity: disabled || loading ? 0.6 : 1,
        ...(tone === 'success' && { background: '#008060', color: '#ffffff' }),
        ...style
    };

    if (useFallback) {
        return (
            <button
                id={id}
                type={type}
                onClick={onClick}
                disabled={disabled || loading}
                style={buttonStyle}
                className={`${className} ${isSelected ? 'selected' : ''}`}
                {...props}
            >
                {loading ? 'Loading...' : children}
            </button>
        );
    }

    return (
        <s-button
            id={id}
            type={type}
            ref={buttonRef}
            variant={variant}
            tone={tone}
            loading={loading ? 'true' : undefined}
            disabled={disabled || loading ? 'true' : undefined}
            full-width={fullWidth ? 'true' : undefined}
            size={size}
            onClick={onClick}
            style={{ ...style, width: fullWidth ? '100%' : style?.width }}
            class={`${className} ${isSelected ? 'selected' : ''}`}
            slot={slot}
            {...props}
        >
            <span className="s-button-content" style={isSelected ? { color: '#ffffff' } : undefined}>
                {children}
            </span>
        </s-button>
    );
}
