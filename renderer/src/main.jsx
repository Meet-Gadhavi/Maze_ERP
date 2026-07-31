import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Register fallback/offline custom elements for Shopify Polaris tags to prevent crashes and unstyled UI when offline
if (typeof window !== 'undefined') {
    // 1. s-button
    if (!customElements.get('s-button')) {
        class FallbackSButton extends HTMLElement {
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
            }
            connectedCallback() {
                this.render();
            }
            static get observedAttributes() {
                return ['variant', 'tone', 'loading', 'disabled', 'size'];
            }
            attributeChangedCallback() {
                this.render();
            }
            render() {
                const variant = this.getAttribute('variant') || 'secondary';
                const tone = this.getAttribute('tone');
                const loading = this.hasAttribute('loading');
                const disabled = this.hasAttribute('disabled') || loading;
                const size = this.getAttribute('size') || 'medium';

                const isPrimary = variant === 'primary';
                const isDanger = variant === 'danger' || tone === 'critical';
                
                let background = '#f1f2f4';
                let color = '#202223';
                let border = '1px solid #d2d5d9';
                
                if (isPrimary) {
                    background = '#008060';
                    color = '#ffffff';
                    border = 'none';
                } else if (isDanger) {
                    background = '#d82c0d';
                    color = '#ffffff';
                    border = 'none';
                }

                const padding = size === 'small' ? '6px 12px' : size === 'large' ? '14px 24px' : '10px 16px';
                const fontSize = size === 'small' ? '13px' : size === 'large' ? '16px' : '14px';

                this.shadowRoot.innerHTML = `
                    <style>
                        :host {
                            display: inline-block;
                        }
                        button {
                            display: inline-flex;
                            align-items: center;
                            justify-content: center;
                            padding: ${padding};
                            font-size: ${fontSize};
                            font-weight: 600;
                            border-radius: 8px;
                            border: ${border};
                            background: ${background};
                            color: ${color};
                            cursor: ${disabled ? 'not-allowed' : 'pointer'};
                            opacity: ${disabled ? 0.6 : 1};
                            width: 100%;
                            height: 100%;
                            box-sizing: border-box;
                            transition: background 0.1s ease;
                        }
                        button:hover:not(:disabled) {
                            filter: brightness(0.95);
                        }
                        button:active:not(:disabled) {
                            filter: brightness(0.9);
                        }
                    </style>
                    <button ${disabled ? 'disabled' : ''}>
                        <slot></slot>
                    </button>
                `;
                
                const btn = this.shadowRoot.querySelector('button');
                btn.onclick = (e) => {
                    if (disabled) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                };
            }
        }
        customElements.define('s-button', FallbackSButton);
    }

    // 2. s-modal
    if (!customElements.get('s-modal')) {
        class FallbackSModal extends HTMLElement {
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
                this._open = false;
            }
            connectedCallback() {
                this.render();
                this._handleCommandClickBound = this._handleCommandClick.bind(this);
                document.addEventListener('click', this._handleCommandClickBound);
            }
            disconnectedCallback() {
                document.removeEventListener('click', this._handleCommandClickBound);
            }
            _handleCommandClick(e) {
                const btn = e.target.closest('button, [commandFor]');
                if (btn && btn.getAttribute('commandFor') === this.id) {
                    const cmd = btn.getAttribute('command');
                    if (cmd === '--show') {
                        this.show();
                    } else if (cmd === '--hide') {
                        this.hide();
                    }
                }
            }
            show() {
                this._open = true;
                this.render();
                this.dispatchEvent(new CustomEvent('show'));
            }
            hide() {
                this._open = false;
                this.render();
                this.dispatchEvent(new CustomEvent('hide'));
            }
            render() {
                if (!this._open) {
                    this.shadowRoot.innerHTML = '';
                    return;
                }
                const heading = this.getAttribute('heading') || '';
                const size = this.getAttribute('size') || 'medium';
                const width = size === 'small' ? '400px' : size === 'large' ? '800px' : '600px';

                this.shadowRoot.innerHTML = `
                    <style>
                        .overlay {
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: rgba(0, 0, 0, 0.5);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            z-index: 9999;
                            padding: 20px;
                        }
                        .modal {
                            background: #ffffff;
                            border-radius: 12px;
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                            width: ${width};
                            max-width: 100%;
                            max-height: 90vh;
                            display: flex;
                            flex-direction: column;
                            animation: slideUp 0.15s ease-out;
                        }
                        @keyframes slideUp {
                            from { transform: translateY(20px); opacity: 0; }
                            to { transform: translateY(0); opacity: 1; }
                        }
                        .header {
                            padding: 16px 20px;
                            border-bottom: 1px solid #f1f5f9;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        }
                        .title {
                            margin: 0;
                            font-size: 16px;
                            font-weight: 600;
                            color: #202223;
                        }
                        .close-btn {
                            background: none;
                            border: none;
                            cursor: pointer;
                            padding: 4px;
                            border-radius: 4px;
                            display: flex;
                        }
                        .close-btn:hover {
                            background: #f1f2f4;
                        }
                        .close-icon {
                            width: 20px;
                            height: 20px;
                            fill: #6d7175;
                        }
                        .body {
                            padding: 20px;
                            overflow-y: auto;
                            flex: 1;
                        }
                        .footer {
                            padding: 16px 20px;
                            border-top: 1px solid #f1f5f9;
                            display: flex;
                            justify-content: flex-end;
                            gap: 12px;
                        }
                    </style>
                    <div class="overlay">
                        <div class="modal">
                            <div class="header">
                                <h2 class="title">${heading}</h2>
                                <button class="close-btn" aria-label="Close">
                                    <svg viewBox="0 0 20 20" class="close-icon"><path d="m11.414 10 4.293-4.293a.999.999 0 1 0-1.414-1.414l-4.293 4.293-4.293-4.293a.999.999 0 1 0-1.414 1.414l4.293 4.293-4.293 4.293a.997.997 0 0 0 0 1.414.999.999 0 0 0 1.414 0l4.293-4.293 4.293 4.293a.999.999 0 0 0 1.414-1.414l-4.293-4.293Z"/></svg>
                                </button>
                            </div>
                            <div class="body">
                                <slot></slot>
                            </div>
                            <div class="footer">
                                <slot name="secondary-actions"></slot>
                                <slot name="primary-action"></slot>
                            </div>
                        </div>
                    </div>
                `;

                this.shadowRoot.querySelector('.close-btn').onclick = () => this.hide();
                this.shadowRoot.querySelector('.overlay').onclick = (e) => {
                    if (e.target === e.currentTarget) this.hide();
                };
            }
        }
        customElements.define('s-modal', FallbackSModal);
    }
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
