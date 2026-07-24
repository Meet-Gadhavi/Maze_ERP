import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import api from '../api';
import SButton from './SButton';
import { Icons } from './Icons';

export default function ExpirationBanner() {
    const [licenseInfo, setLicenseInfo] = useState(null);
    const [vobizInfo, setVobizInfo] = useState(null);

    useEffect(() => {
        let isMounted = true;

        async function fetchExpirations() {
            try {
                const settings = await api.getSettings();
                const localKey = settings.license_key;

                if (!localKey) return;

                const { data, error } = await supabase
                    .from('licenses')
                    .select('*')
                    .eq('license_key', localKey)
                    .maybeSingle();

                if (!error && data && isMounted) {
                    // Check ERP Subscription expiration
                    if (data.expires_at) {
                        const expiryDate = new Date(data.expires_at);
                        const now = new Date();
                        const diffTime = expiryDate.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        setLicenseInfo({
                            key: data.license_key,
                            plan: data.plan || 'PRO',
                            expiresAt: data.expires_at,
                            formattedDate: expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                            daysLeft: diffDays
                        });
                    }

                    // Check VoBiz Number expiration
                    if (data.vobiz_expires_at && data.vobiz_phone_number) {
                        const vobizExpiryDate = new Date(data.vobiz_expires_at);
                        const now = new Date();
                        const vobizDiffTime = vobizExpiryDate.getTime() - now.getTime();
                        const vobizDiffDays = Math.ceil(vobizDiffTime / (1000 * 60 * 60 * 24));

                        setVobizInfo({
                            phoneNumber: data.vobiz_phone_number,
                            expiresAt: data.vobiz_expires_at,
                            formattedDate: vobizExpiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                            daysLeft: vobizDiffDays
                        });
                    }
                }
            } catch (err) {
                console.error('[ExpirationBanner] Failed to fetch expiration info:', err);
            }
        }

        fetchExpirations();
        const interval = setInterval(fetchExpirations, 60000); // Poll every minute
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const openExternalLink = (url) => {
        if (window.maze && typeof window.maze.openExternal === 'function') {
            window.maze.openExternal(url);
        } else {
            window.open(url, '_blank');
        }
    };

    const showLicenseWarning = licenseInfo && licenseInfo.daysLeft <= 5 && licenseInfo.plan !== 'Free';
    const showVobizWarning = vobizInfo && vobizInfo.daysLeft <= 5;

    if (!showLicenseWarning && !showVobizWarning) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {/* License Expiration Banner */}
            {showLicenseWarning && (
                <div style={{
                    background: 'linear-gradient(135deg, #FFF9F5 0%, #FFF3EA 100%)',
                    border: '1px solid #FFD8BE',
                    borderRadius: '12px',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    boxShadow: '0 2px 8px rgba(247, 144, 9, 0.08)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'rgba(247, 144, 9, 0.15)',
                            color: '#D97706',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <Icons.AlertTriangle size={20} />
                        </div>
                        <div>
                            <strong style={{ fontSize: '13px', color: '#92400E', display: 'block' }}>
                                Quantro ERP Subscription Expiring Soon ({licenseInfo.daysLeft <= 0 ? 'Expired' : `${licenseInfo.daysLeft} days left`})
                            </strong>
                            <span style={{ fontSize: '12px', color: '#B45309' }}>
                                Your subscription key ({licenseInfo.key}) expires on {licenseInfo.formattedDate}. Renew now to maintain uninterrupted PRO access.
                            </span>
                        </div>
                    </div>

                    <SButton
                        variant="primary"
                        onClick={() => openExternalLink(`https://quantro-web.onrender.com/renew?key=${encodeURIComponent(licenseInfo.key)}`)}
                        style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '8px 16px', fontSize: '13px' }}
                    >
                        Renew Subscription
                    </SButton>
                </div>
            )}

            {/* VoBiz Expiration Banner */}
            {showVobizWarning && (
                <div style={{
                    background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
                    border: '1px solid #FCA5A5',
                    borderRadius: '12px',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#DC2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <Icons.Phone size={20} />
                        </div>
                        <div>
                            <strong style={{ fontSize: '13px', color: '#991B1B', display: 'block' }}>
                                VoBiz Phone Number Expiration Warning ({vobizInfo.phoneNumber})
                            </strong>
                            <span style={{ fontSize: '12px', color: '#B91C1C' }}>
                                Renew your VoBiz number now. Once your subscription ends, after a 2-day grace period, your phone number access will be provided to another user and your organization will have to buy a new VoBiz number.
                            </span>
                        </div>
                    </div>

                    <SButton
                        variant="primary"
                        onClick={() => openExternalLink(`https://quantro-web.onrender.com/renew?key=${encodeURIComponent(licenseInfo?.key || '')}&type=vobiz`)}
                        style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '8px 16px', fontSize: '13px', backgroundColor: '#DC2626' }}
                    >
                        Renew VoBiz Number
                    </SButton>
                </div>
            )}
        </div>
    );
}
