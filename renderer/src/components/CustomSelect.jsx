import React, { useState, useRef, useEffect } from 'react';

/**
 * CustomSelect - A premium dropdown component
 * @param {Object} props
 * @param {string|number} props.value - Current selected value
 * @param {Function} props.onChange - Handler for value change
 * @param {Array<{value: any, label: string}>} props.options - List of options
 * @param {string} props.placeholder - Placeholder text
 * @param {string} props.className - Additional class names
 * @param {boolean} props.disabled - Disabled state
 */
export default function CustomSelect({ 
    value, 
    onChange, 
    options = [], 
    placeholder = 'Select...', 
    className = '',
    disabled = false
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const findOption = (opts, val) => {
        for (const opt of opts) {
            if (opt.group) {
                const found = findOption(opt.items, val);
                if (found) return found;
            } else if (opt.value === val) {
                return opt;
            }
        }
        return null;
    };

    const selectedOption = findOption(options, value);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option) => {
        if (disabled) return;
        onChange(option.value);
        setIsOpen(false);
    };

    return (
        <div 
            className={`custom-select-container ${className} ${disabled ? 'disabled' : ''} ${isOpen ? 'open' : ''}`} 
            ref={containerRef}
        >
            <div 
                className="custom-select-trigger" 
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span className="selected-label">
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <svg className="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </div>

            {isOpen && (
                <div className="custom-select-options">
                    {options.map((option, idx) => (
                        option.group ? (
                            <div key={`group-${idx}`} className="custom-select-group">
                                <div className="custom-select-group-header">{option.group}</div>
                                {option.items.map((item) => (
                                    <div 
                                        key={item.value}
                                        className={`custom-select-option ${item.value === value ? 'selected' : ''}`}
                                        onClick={() => handleSelect(item)}
                                    >
                                        <span>{item.label}</span>
                                        {item.value === value && (
                                            <svg className="tick-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div 
                                key={option.value}
                                className={`custom-select-option ${option.value === value ? 'selected' : ''}`}
                                onClick={() => handleSelect(option)}
                            >
                                <span>{option.label}</span>
                                {option.value === value && (
                                    <svg className="tick-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </div>
                        )
                    ))}
                </div>
            )}
        </div>
    );
}
