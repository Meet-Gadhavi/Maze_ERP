import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import SButton from '../components/SButton';
import { Icons } from '../components/Icons';
import CustomSelect from '../components/CustomSelect';
import api from '../api';
import { toast } from 'sonner';
import { isOnline } from '../utils/network';
import { mazewaySupabase } from '../mazewaySupabase';
import './AutomationPage.css';

const AGENT_PLANS = [
    { id: 'starter', name: 'Starter', price: 600, features: ['1000 mins/mo', 'WhatsApp Only', 'Basic Personality'] },
    { id: 'pro', name: 'Pro', price: 700, features: ['5000 mins/mo', 'Voice + WhatsApp', 'Custom Personality', 'Lead Analytics'] },
    { id: 'enterprise', name: 'Enterprise', price: 1100, features: ['Unlimited mins', 'High Priority Support', 'Multi-lingual', 'API Access'] },
];

const PERSONA_OPTIONS = [
    { value: 'Sales', label: 'Sales (Aggressive & Persuasive)' },
    { value: 'Support', label: 'Support (Empathetic & Helpful)' },
    { value: 'Purchase', label: 'Purchase (Analytical & Firm)' },
    { value: 'Multipurpose', label: 'Multipurpose (Balanced)' }
];

const NameInput = ({ value, onChange }) => {
    const [localValue, setLocalValue] = useState(value);
    
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    return (
        <input
            id="agent-name-input"
            type="text"
            placeholder="e.g. Maya - Sales Closer"
            value={localValue}
            autoComplete="off"
            onChange={e => setLocalValue(e.target.value)}
            onBlur={() => onChange(localValue)}
            style={{ width: '100%', display: 'block' }}
        />
    );
};

export default function AutomationPage() {
    const [agents, setAgents] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [step, setStep] = useState(1);
    const [syncingNow, setSyncingNow] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState('');
    const [mazewayApiKey, setMazewayApiKey] = useState('');
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingAgentId, setEditingAgentId] = useState(null);
    const [logs, setLogs] = useState([]);
    const [statsData, setStatsData] = useState({
        totalMinutes: '0',
        leadsProcessed: '0',
        revenue: '₹0'
    });
    const [formData, setFormData] = useState({
        name: '',
        business_name: '',
        language: 'en-IN',
        personality: 'Sales',
        providerType: 'BUY_NOW',
        plan: 'starter',
        sip_trunk: {
            label: '',
            phone_number: '',
            media_encryption: 'allowed',
            username: '',
            password: '',
            address: ''
        }
    });
    const stats = [
        {
            label: 'Total AI Minutes',
            value: statsData.totalMinutes,
            icon: Icons.Activity,
            tone: 'blue'
        },
        {
            label: 'Leads Processed',
            value: statsData.leadsProcessed,
            icon: Icons.Users,
            tone: 'green'
        },
        {
            label: 'AI Driven Revenue',
            value: statsData.revenue,
            icon: Icons.Banknote,
            tone: 'purple'
        }
    ];
    const toggleAgentActive = async (agent) => {
        // Block activation if the agent is still being provisioned by the admin
        if (agent.status === 'PROVISIONING') {
            toast.error('Admin still has not provided credentials to agent to be working. Please wait for approval.', {
                icon: '⏳',
                duration: 4000
            });
            return;
        }

        const updatedAgent = { ...agent, is_active: !agent.is_active };
        try {
            await api.saveAgent(updatedAgent);
            setAgents(prev => prev.map(a => a.id === agent.id ? updatedAgent : a));
            toast.success(`Agent ${updatedAgent.is_active ? 'activated' : 'deactivated'}`);
        } catch (err) {
            toast.error('Failed to update agent status');
        }
    };

    const handleDeleteAgent = async (agent) => {
        const agentId = agent.id;
        const status = agent.status;

        if (window.confirm(`Are you sure you want to remove "${agent.name}"? This will permanently stop all its operations.`)) {
            const loadingId = toast.loading('Removing agent...');
            try {
                // 1. If PROVISIONING, cancel the request in Mazeway Cloud (Supabase)
                // This automatically removes it from the Mazeway Admin Dashboard
                if (status === 'PROVISIONING') {
                    const { error } = await mazewaySupabase
                        .from('mazeway_number_requests')
                        .delete()
                        .eq('agent_id', agentId);
                    
                    if (error) {
                        console.warn('[Mazeway Cloud] Failed to cancel provisioning request:', error);
                    } else {
                        console.log('[Mazeway Cloud] Provisioning request cancelled successfully.');
                    }
                }

                // 2. Delete locally from ERP database
                await api.deleteAgent(agentId);
                
                // 3. Update local state
                setAgents(prev => prev.filter(a => a.id !== agentId));
                toast.success('Agent removed successfully', { id: loadingId });
            } catch (err) {
                console.error('Delete failed:', err);
                toast.error('Failed to remove agent', { id: loadingId });
            }
        }
    };

    const handleOpenConfig = async (agent) => {
        setSelectedAgent(agent);
        setShowConfigModal(true);
        try {
            const logsData = await api.getMazewayLogs();
            setLogs(logsData || []);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        }
    };

    const handleOpenCreate = () => {
        setIsEditing(false);
        setEditingAgentId(null);
        setFormData({
            name: '',
            business_name: '',
            language: 'en-IN',
            personality: 'Sales',
            providerType: 'BUY_NOW',
            plan: 'starter',
            sip_trunk: {
                label: '',
                phone_number: '',
                media_encryption: 'allowed',
                username: '',
                password: '',
                address: ''
            }
        });
        setStep(1);
        setShowModal(true);
    };

    const handleOpenEdit = (agent) => {
        setIsEditing(true);
        setEditingAgentId(agent.id);
        setFormData({
            name: agent.name,
            business_name: agent.metadata?.business_name || '',
            language: agent.language || 'en-IN',
            personality: agent.persona || 'Sales',
            providerType: 'OWN_PROVIDER', // Only Own Provider agents reach here
            plan: 'starter',
            sip_trunk: {
                label: agent.config?.label || '',
                phone_number: agent.config?.phone_number || '',
                media_encryption: agent.config?.media_encryption || 'allowed',
                username: agent.config?.username || '',
                password: agent.config?.password || '',
                address: agent.config?.address || ''
            }
        });
        setStep(2); // Directly open the provider configuration tab
        setShowModal(true);
    };
    const fetchAgents = async () => {
        try {
            const [agentsData, statsRes] = await Promise.all([
                api.getAgents(),
                api.getMazewayStats()
            ]);
            setAgents(agentsData || []);
            setStatsData(statsRes);
        } catch (err) {
            console.error('Failed to fetch data:', err);
        }
    };

    const syncAgentStatuses = async () => {
        const provisioningAgents = agents.filter(a => a.status === 'PROVISIONING');
        if (provisioningAgents.length === 0) return;

        console.log(`[Automation] Syncing status for ${provisioningAgents.length} provisioning agents...`);

        for (const agent of provisioningAgents) {
            try {
                // 1. Try to find by agent_id first
                let { data, error } = await mazewaySupabase
                    .from('mazeway_number_requests')
                    .select('status, agent_id, agent_name')
                    .eq('agent_id', agent.id)
                    .maybeSingle();

                // 2. Fallback: If not found by ID, try by name (since admin might have provisioned before ID sync)
                if (!data && !error) {
                    console.log(`[Sync] ID match failed for ${agent.name}, trying name fallback...`);
                    const { data: nameData, error: nameError } = await mazewaySupabase
                        .from('mazeway_number_requests')
                        .select('status, agent_id, agent_name')
                        .ilike('agent_name', agent.name)
                        .eq('status', 'approved')
                        .order('created_at', { ascending: false })
                        .limit(1);
                    
                    if (nameData && nameData.length > 0) {
                        data = nameData[0];
                    }
                }

                if (error) throw error;
                if (!data) continue;

                let nextStatus = 'PROVISIONING';
                let nextActive = false;

                if (data.status === 'approved') {
                    nextStatus = 'ACTIVE';
                    nextActive = true;
                } else if (data.status === 'rejected') {
                    nextStatus = 'FAILED';
                    nextActive = false;
                }

                if (nextStatus !== 'PROVISIONING') {
                    console.log(`[Sync] Updating agent ${agent.name} status to ${nextStatus}`);
                    const updatedAgent = { ...agent, status: nextStatus, is_active: nextActive };
                    await api.saveAgent(updatedAgent);
                    setAgents(prev => prev.map(a => a.id === agent.id ? updatedAgent : a));
                    
                    if (nextStatus === 'ACTIVE') {
                        toast.success(`Agent "${agent.name}" has been approved and is now active!`, { icon: '✅' });
                    } else {
                        toast.error(`Agent "${agent.name}" provisioning request was rejected.`);
                    }
                }
            } catch (err) {
                console.error(`Status sync failed for agent ${agent.id}:`, err);
            }
        }
    };

    useEffect(() => {
        fetchAgents();
        
        api.getSettings()
            .then((settings) => {
                setMazewayApiKey(settings.mazeway_api_key || '');
                setLastSyncedAt(settings.mazeway_last_synced_at || '');
            })
            .catch((err) => {
                console.error('Failed to load sync settings:', err);
            });
    }, []);

    // Polling for status updates every 10 seconds if there are provisioning agents
    useEffect(() => {
        const interval = setInterval(() => {
            syncAgentStatuses();
        }, 10000);
        return () => clearInterval(interval);
    }, [agents]);

    const handleSyncNow = async ({ silent = false } = {}) => {
        if (syncingNow) return;
        if (!isOnline()) {
            toast.error('No internet connection. Sync skipped.');
            return;
        }
        if (!mazewayApiKey) {
            toast.error('Mazeway API key not found. Add it in Settings first.');
            return;
        }

        setSyncingNow(true);
        const loadingId = silent ? null : toast.loading('Syncing data with Mazeway...');
        try {
            const result = await api.syncMazewayKnowledge(mazewayApiKey);
            setLastSyncedAt(result.pushedAt);
            await api.updateSettings({ mazeway_last_synced_at: result.pushedAt });
            if (loadingId) toast.dismiss(loadingId);
            if (!silent) toast.success('Mazeway sync completed successfully.');
        } catch (err) {
            if (loadingId) toast.dismiss(loadingId);
            toast.error(err.message || 'Mazeway sync failed.');
        } finally {
            setSyncingNow(false);
        }
    };

    useEffect(() => {
        const handleBackOnline = () => {
            if (mazewayApiKey) {
                handleSyncNow({ silent: true });
            }
        };
        window.addEventListener('online', handleBackOnline);
        return () => window.removeEventListener('online', handleBackOnline);
    }, [mazewayApiKey]);

    const handleCreateAgent = async () => {
        if (isEditing) {
            finalizeAgent();
            return;
        }

        if (formData.providerType === 'BUY_NOW') {
            // Simulate Razorpay
            toast.loading('Redirecting to Razorpay...');
            setTimeout(() => {
                toast.dismiss();
                toast.success('Payment Successful! Provisioning Agent...');
                finalizeAgent();
            }, 2000);
        } else {
            finalizeAgent();
        }
    };

    const finalizeAgent = async () => {
        const loadingId = toast.loading(isEditing ? 'Updating agent configuration...' : 'Syncing agent configuration with Mazeway...');
        try {
            let agentId = editingAgentId;
            let currentStatus = isEditing ? agents.find(a => a.id === editingAgentId)?.status : 'PROVISIONING';

            // Only sync with Mazeway if NOT editing or if it's a new agent
            if (!isEditing) {
                // Generate a stable ID locally first
                const localId = `AG_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`.toUpperCase();
                agentId = localId;

                // Map personas to high-quality ElevenLabs Voice IDs
                const voiceMap = {
                    'Sales': 'cgSgspJ2msm6clMCkdW9', // Jessica
                    'Support': 'EXAVITQu4vr4xnSDxMaL', // Bella
                    'Purchase': 'onwK4e9ZLuTAKqWqbcWc', // George
                    'Multipurpose': 'Lcf7W9Y6C03XisXz4X4Y' // Emily
                };

                // Prepare payload for Mazeway
                const payload = {
                    agent_id: localId,
                    agentId: localId,
                    agent_name: formData.name,
                    business_name: formData.business_name,
                    language: formData.language,
                    persona: formData.personality,
                    agent_type: 'voice',
                    elevenlabs_config: {
                        model_id: 'eleven_multilingual_v2',
                        voice_id: voiceMap[formData.personality] || 'cgSgspJ2msm6clMCkdW9', // Default to Jessica
                        language: formData.language
                    }
                };

                console.log('[Mazeway Sync] Sending Provisioning Payload:', payload);

                if (formData.providerType === 'OWN_PROVIDER') {
                    payload.el_trunk_label = formData.sip_trunk.label;
                    payload.el_outbound_address = formData.sip_trunk.address;
                    payload.el_media_encryption = formData.sip_trunk.media_encryption;
                    payload.el_inbound_username = formData.sip_trunk.username;
                    payload.el_inbound_password = formData.sip_trunk.password;
                    payload.outbound_trunk = {
                        phone: formData.sip_trunk.phone_number
                    };
                }

                const result = await api.createMazewayAgent(payload, mazewayApiKey);
                console.log('[Mazeway Sync] Backend Response:', result);
                
                if (result.agent_id) agentId = result.agent_id;

                // --- SELF-CORRECTION STEP (with Retry) ---
                if (localId) {
                    const trySync = async (attempt = 1) => {
                        console.log(`[Mazeway Sync] Self-correction attempt ${attempt}...`);
                        try {
                            const { data: existing, error: findError } = await mazewaySupabase
                                .from('mazeway_number_requests')
                                .select('id, agent_name')
                                .ilike('agent_name', `%${formData.name.trim()}%`) // Use partial match to be safe
                                .eq('status', 'pending')
                                .is('agent_id', null)
                                .order('created_at', { ascending: false })
                                .limit(1);

                            if (findError) {
                                console.error('[Mazeway Sync] Error finding request:', findError);
                            }

                            if (!findError && existing && existing.length > 0) {
                                console.log('[Mazeway Sync] Found matching request:', existing[0].id);
                                const { error: updateError } = await mazewaySupabase
                                    .from('mazeway_number_requests')
                                    .update({ agent_id: localId })
                                    .eq('id', existing[0].id);
                                
                                if (!updateError) {
                                    console.log('[Mazeway Sync] Successfully self-corrected Agent ID in Cloud.');
                                    return true;
                                } else {
                                    console.error('[Mazeway Sync] Update failed:', updateError);
                                }
                            } else {
                                console.log('[Mazeway Sync] No matching pending request found yet.');
                            }

                            if (attempt < 5) {
                                setTimeout(() => trySync(attempt + 1), 2000); // Retry every 2s
                            }
                        } catch (e) {
                            console.error('[Mazeway Sync] Self-correction attempt failed:', e);
                        }
                        return false;
                    };
                    trySync();
                }
            }

            const updatedAgent = {
                id: agentId || (isEditing ? editingAgentId : `agent_${Date.now()}`),
                name: formData.name,
                type: 'Voice',
                persona: formData.personality,
                language: formData.language,
                status: currentStatus || 'PROVISIONING',
                is_active: isEditing ? agents.find(a => a.id === editingAgentId)?.is_active : false,
                metadata: {
                    business_name: formData.business_name
                },
                config: formData.providerType === 'OWN_PROVIDER' ? formData.sip_trunk : {}
            };

            // Save locally
            await api.saveAgent(updatedAgent);
            
            if (isEditing) {
                setAgents(prev => prev.map(a => a.id === editingAgentId ? updatedAgent : a));
            } else {
                setAgents([...agents, updatedAgent]);
            }

            setShowModal(false);
            setIsEditing(false);
            setStep(1);
            toast.success(isEditing ? 'Agent updated successfully!' : 'AI Agent provisioned successfully on Mazeway!', { id: loadingId });
        } catch (err) {
            console.error('Operation failed:', err);
            toast.error(err.message || 'Failed to process agent', { id: loadingId });
        }
    };

    return (
        <div className="automation-page">
            <div className="page-header">
                <div>
                    <h1>Automation</h1>
                    <p>Orchestrate your AI Voice and WhatsApp sales force</p>
                    <div className="sync-meta-row">
                        <span className="sync-meta-label">Last Synced with Mazeway:</span>
                        <span className="sync-meta-value">{lastSyncedAt ? new Date(lastSyncedAt).toLocaleString('en-IN') : 'Never'}</span>
                    </div>
                </div>
                <div className="header-actions">
                    <SButton variant="secondary" onClick={() => handleSyncNow()} disabled={syncingNow}>
                        {syncingNow ? 'Syncing...' : 'Sync Now'}
                    </SButton>
                    <SButton variant="primary" onClick={handleOpenCreate}>
                        Create New Agent
                    </SButton>
                </div>
            </div>

            <div className="stats-row">
                {stats.map((item) => {
                    const StatIcon = item.icon;
                    return (
                        <div className="stat-card" key={item.label}>
                            <div className={`stat-icon ${item.tone}`}>
                                <StatIcon size={20} />
                            </div>
                            <div className="stat-info">
                                <span className="stat-label">{item.label}</span>
                                <span className="stat-value">{item.value}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="agents-section">
                <div className="agents-section-header">
                    <div className="section-title-wrap">
                        <h3>Agent List <span className="count-badge">{agents.length} Total</span></h3>
                        <p>Track status, channel, and performance for every agent.</p>
                    </div>
                </div>
                <div className="agents-list">
                    {agents.length > 0 ? agents.map(agent => (
                        <div key={agent.id} className="agent-card">
                            <div className="agent-main">
                                <div className="agent-icon-wrap">
                                    {agent.type === 'Voice' ? <Icons.Smartphone size={24} /> : <Icons.MessageSquare size={24} />}
                                </div>
                                <div className="agent-details">
                                    <div className="agent-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h4>{agent.name}</h4>
                                        <span className="agent-id-badge" title={`Full ID: ${agent.id}`}>
                                            ID: {agent.id.slice(0, 8)}
                                        </span>
                                    </div>
                                    <div className="agent-meta">
                                        <span>{agent.persona} Persona</span>
                                        <span>{agent.type} Channel</span>
                                    </div>
                                </div>
                            </div>
                            <div className="agent-actions">
                                {agent.status === 'PROVISIONING' && (
                                    <span className="agent-status-chip provisioning">PROVISIONING</span>
                                )}
                                <div className="toggle-wrap">
                                    <span className={`toggle-state ${agent.is_active ? 'active' : 'inactive'}`}>
                                        {agent.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                    <label className="toggle-switch" title={agent.is_active ? 'Active' : 'Inactive'}>
                                        <input
                                            type="checkbox"
                                            checked={agent.is_active}
                                            disabled={agent.status === 'PROVISIONING'}
                                            onChange={() => toggleAgentActive(agent)}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                                {(agent.config && Object.keys(agent.config).length > 0) && (
                                    <SButton
                                        variant="secondary"
                                        title="Edit Agent"
                                        disabled={agent.status !== 'PROVISIONING' && agent.status !== 'FAILED'}
                                        onClick={() => handleOpenEdit(agent)}
                                    >
                                        <Icons.Edit size={16} />
                                    </SButton>
                                )}
                                <SButton
                                    variant="secondary"
                                    title="Configure Agent"
                                    onClick={() => handleOpenConfig(agent)}
                                >
                                    <Icons.Settings size={16} />
                                </SButton>
                                <SButton
                                    variant="secondary"
                                    tone="critical"
                                    title="Remove Agent"
                                    onClick={() => handleDeleteAgent(agent)}
                                >
                                    <Icons.Trash size={16} />
                                </SButton>
                            </div>
                        </div>
                    )) : (
                        <div className="empty-agents-state">
                            <div className="empty-icon-wrap">
                                <Icons.Cpu size={48} />
                            </div>
                            <h3>Make your first new agent</h3>
                            <p>Get started by provisioning an AI assistant for your business.</p>
                            <SButton variant="primary" onClick={handleOpenCreate}>
                                Create Agent
                            </SButton>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                open={showModal}
                onClose={() => setShowModal(false)}
                heading={step === 1 ? (isEditing ? 'Edit Agent Profile' : 'Create Agent Profile') : 'Infrastructure Setup'}
                size="large"
            >
                <div className="modal-stepper mb-24">
                    <div className={`step-pill ${step === 1 ? 'active' : 'done'}`}>1. Persona</div>
                    <div className={`step-pill ${step === 2 ? 'active' : ''}`}>2. Provider</div>
                </div>

                {step === 1 ? (
                    <div className="flex-column gap-24">
                        <div className="modal-section-card">
                            <div className="section-title-row mb-16">
                                <Icons.User size={16} />
                                <span className="fw-600">Agent Identity</span>
                            </div>
                            <div className="form-group mb-16">
                                <label className="block mb-8">Agent Name</label>
                                <NameInput 
                                    value={formData.name || ''} 
                                    onChange={(val) => setFormData(prev => ({ ...prev, name: val }))} 
                                />
                            </div>
                            <div className="form-group mb-16">
                                <label className="block mb-8">Business Name</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g. XYZ Electronics"
                                    value={formData.business_name}
                                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                                />
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="block mb-8">Language</label>
                                    <CustomSelect
                                        value={formData.language}
                                        onChange={(value) => setFormData({ ...formData, language: value })}
                                        options={[
                                            { value: 'en-IN', label: 'English (Indian)' },
                                            { value: 'hi-IN', label: 'Hindi' },
                                            { value: 'gu-IN', label: 'Gujarati' },
                                            { value: 'mr-IN', label: 'Marathi' },
                                            { value: 'ta-IN', label: 'Tamil' }
                                        ]}
                                        placeholder="Select language"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="block mb-8">Personality / Role</label>
                                    <CustomSelect
                                        value={formData.personality}
                                        onChange={(value) => setFormData({ ...formData, personality: value })}
                                        options={PERSONA_OPTIONS}
                                        placeholder="Select personality"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="mt-8">
                            <SButton
                                variant="primary"
                                style={{ width: '100%' }}
                                onClick={() => setStep(2)}
                                disabled={!formData.name.trim()}
                            >
                                Next: Configure Provider
                                <Icons.ChevronRight size={16} className="ml-8" />
                            </SButton>
                        </div>
                    </div>
                ) : (
                    <div className="flex-column gap-24">
                        <div className="modal-section-card">
                            <div className="section-title-row mb-16">
                                <Icons.Cpu size={16} />
                                <span className="fw-600">Provider Setup</span>
                            </div>
                            <div className="provider-options mb-24">
                                <div
                                    className={`provider-card ${formData.providerType === 'BUY_NOW' ? 'selected' : ''}`}
                                    onClick={() => setFormData({ ...formData, providerType: 'BUY_NOW' })}
                                >
                                    <Icons.CreditCard size={24} />
                                    <div>
                                        <strong>Buy Now (Managed)</strong>
                                        <p>Mazeway handles SIP and minutes</p>
                                    </div>
                                </div>
                                <div
                                    className={`provider-card ${formData.providerType === 'OWN_PROVIDER' ? 'selected' : ''}`}
                                    onClick={() => setFormData({ ...formData, providerType: 'OWN_PROVIDER' })}
                                >
                                    <Icons.Layers size={24} />
                                    <div>
                                        <strong>Own Provider (Vobiz)</strong>
                                        <p>Use your own SIP credentials</p>
                                    </div>
                                </div>
                            </div>

                            {formData.providerType === 'BUY_NOW' ? (
                                <>
                                    <div className="plans-row mb-24">
                                        {AGENT_PLANS.map(plan => (
                                            <div
                                                key={plan.id}
                                                className={`plan-card ${formData.plan === plan.id ? 'selected' : ''}`}
                                                onClick={() => setFormData({ ...formData, plan: plan.id })}
                                            >
                                                <h4>{plan.name}</h4>
                                                <div className="price">₹{plan.price}<span>/mo</span></div>
                                                <ul>
                                                    {plan.features.map(f => <li key={f}>{f}</li>)}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="vobiz-form text-center p-24 bg-surface-subtle border-dashed rounded-16">
                                        <div className="flex align-center justify-center mx-auto mb-16 rounded-full bg-primary-subtle text-primary" style={{ width: '48px', height: '48px' }}>
                                            <Icons.ShieldCheck size={24} />
                                        </div>
                                        <h4 className="size-16 fw-600 mb-8">Managed SIP Integration</h4>
                                        <p className="size-14 text-secondary ls-tight mx-auto" style={{ maxWidth: '300px' }}>
                                            Mazeway handles the technical SIP configuration for purchased agents.
                                            The Admin will complete setup upon approval.
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="vobiz-form scroll-y pr-8" style={{ maxHeight: '400px' }}>
                                    <h4 className="size-14 fw-600 text-primary mb-16 flex align-center gap-8">
                                        <Icons.Download size={18} />
                                        Import SIP Trunk
                                    </h4>

                                    <div className="form-grid mb-16">
                                        <div className="form-group">
                                            <label className="block mb-8">Label</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Name of the phone number"
                                                value={formData.sip_trunk.label}
                                                onChange={e => setFormData({ ...formData, sip_trunk: { ...formData.sip_trunk, label: e.target.value } })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="block mb-8">Phone Number</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="+12025550123"
                                                value={formData.sip_trunk.phone_number}
                                                onChange={e => setFormData({ ...formData, sip_trunk: { ...formData.sip_trunk, phone_number: e.target.value } })}
                                            />
                                        </div>
                                    </div>

                                    <div className="p-16 mb-16 bg-primary-subtle border-primary-light rounded-12">
                                        <strong className="size-13 text-primary block mb-4">Static IP SIP Servers Available</strong>
                                        <p className="size-12 text-secondary m-0 opacity-80">
                                            ElevenLabs offers SIP servers with static IP addresses for enterprise clients requiring IP allowlisting.
                                        </p>
                                    </div>

                                    <div className="p-16 mb-24 bg-accent-subtle border-accent-light rounded-12 flex align-center justify-between">
                                        <div className="flex align-center gap-12">
                                            <div className="flex align-center justify-center rounded-full bg-accent text-white" style={{ width: '32px', height: '32px' }}>
                                                <Icons.Play size={16} />
                                            </div>
                                            <div>
                                                <strong className="size-13 text-accent block">Setup Tutorial</strong>
                                                <p className="size-11 text-accent m-0">Learn how to configure your SIP provider</p>
                                            </div>
                                        </div>
                                        <SButton variant="secondary" size="small" onClick={() => window.open('https://www.youtube.com/watch?v=D4GfatO0_pw&t=487s', '_blank')}>
                                            Watch Video
                                        </SButton>
                                    </div>

                                    <h4 className="size-13 fw-600 text-accent mb-12">Inbound Configuration</h4>
                                    <div className="form-group mb-16">
                                        <label className="block mb-8">Media Encryption</label>
                                        <CustomSelect
                                            value={formData.sip_trunk.media_encryption}
                                            onChange={val => setFormData({ ...formData, sip_trunk: { ...formData.sip_trunk, media_encryption: val } })}
                                            options={[
                                                { value: 'allowed', label: 'Allowed' },
                                                { value: 'required', label: 'Required' },
                                                { value: 'disabled', label: 'Disabled' }
                                            ]}
                                        />
                                    </div>

                                    <h4 className="size-13 fw-600 text-warning mb-12">Outbound Configuration</h4>
                                    <div className="form-group mb-16">
                                        <label className="block mb-8">Address</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="sip.yourprovider.com:5060"
                                            value={formData.sip_trunk.address}
                                            onChange={e => setFormData({ ...formData, sip_trunk: { ...formData.sip_trunk, address: e.target.value } })}
                                        />
                                    </div>

                                    <h4 className="size-13 fw-600 text-secondary mb-12">Authentication (Optional)</h4>
                                    <div className="form-grid mb-16">
                                        <div className="form-group">
                                            <label className="block mb-8">Username</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="SIP Username"
                                                value={formData.sip_trunk.username}
                                                onChange={e => setFormData({ ...formData, sip_trunk: { ...formData.sip_trunk, username: e.target.value } })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="block mb-8">Password</label>
                                            <input
                                                type="password"
                                                className="form-control"
                                                placeholder="SIP Password"
                                                value={formData.sip_trunk.password}
                                                onChange={e => setFormData({ ...formData, sip_trunk: { ...formData.sip_trunk, password: e.target.value } })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-12 mt-8">
                            <SButton variant="secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>Back</SButton>
                            <SButton variant="primary" style={{ flex: 2 }} onClick={handleCreateAgent}>
                                {isEditing ? 'Save Changes' : (formData.providerType === 'BUY_NOW' ? 'Pay & Provision' : 'Provision Agent')}
                            </SButton>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                open={showConfigModal && !!selectedAgent}
                onClose={() => setShowConfigModal(false)}
                heading={`Configure ${selectedAgent?.name}`}
                size="large"
            >
                <div className="config-body">
                    <div className="config-sidebar">
                        <div className="config-section mb-24">
                            <label className="block mb-8 fw-600 size-12 uppercase text-secondary">Agent Status</label>
                            <div className="status-control-card p-16 rounded-12 bg-surface-subtle border">
                                <div className={`status-indicator mb-16 flex align-center gap-8 ${selectedAgent?.is_active ? 'active' : 'inactive'}`}>
                                    <div className="pulse-dot"></div>
                                    <span className="fw-600">{selectedAgent?.is_active ? 'Live & Listening' : 'Offline'}</span>
                                </div>
                                <SButton
                                    variant={selectedAgent?.is_active ? 'critical' : 'primary'}
                                    disabled={selectedAgent?.status === 'PROVISIONING'}
                                    onClick={() => toggleAgentActive(selectedAgent)}
                                    style={{ width: '100%' }}
                                >
                                    {selectedAgent?.is_active ? 'Deactivate Agent' : 'Activate Agent'}
                                </SButton>
                            </div>
                        </div>

                        <div className="config-section">
                            <label className="block mb-8 fw-600 size-12 uppercase text-secondary">Agent Identity</label>
                            <div className="identity-card p-16 rounded-12 bg-surface-subtle border">
                                <div className="identity-item mb-12 flex justify-between">
                                    <span className="label text-secondary size-13">Channel</span>
                                    <span className="value fw-600 size-13">{selectedAgent?.type}</span>
                                </div>
                                <div className="identity-item mb-12 flex justify-between">
                                    <span className="label text-secondary size-13">Persona</span>
                                    <span className="value fw-600 size-13">{selectedAgent?.persona}</span>
                                </div>
                                <div className="identity-item flex justify-between">
                                    <span className="label text-secondary size-13">Agent ID</span>
                                    <span className="value fw-600 size-11 text-primary font-mono">{selectedAgent?.id?.slice(0, 12)}...</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="config-main ml-24 flex-1">
                        <div className="section-title-row mb-16 flex align-center gap-8 text-secondary">
                            <Icons.Activity size={16} />
                            <span className="fw-600 size-12 uppercase">Real-time Activity Logs</span>
                        </div>
                        <div className="logs-container scroll-y" style={{ maxHeight: '500px' }}>
                            {logs.length > 0 ? logs.map(log => (
                                <div className="log-item p-16 mb-12 border rounded-12 bg-surface hover-shadow transition-all" key={log.id}>
                                    <div className="log-header mb-8 flex justify-between align-center">
                                        <div className="log-type-wrap flex align-center gap-8">
                                            <span className={`log-type-tag px-8 py-2 rounded-full size-11 fw-600 uppercase ${log.type.toLowerCase()}`}>{log.type}</span>
                                            <span className="log-time size-11 text-secondary">{new Date(log.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <span className={`log-status size-11 fw-700 ${log.status.toLowerCase()}`}>{log.status}</span>
                                    </div>
                                    <p className="log-summary size-14 m-0 fw-500">{log.summary}</p>
                                    <div className="log-footer mt-12 flex justify-between align-center pt-12 border-top">
                                        <span className="size-11 text-secondary">Duration: {log.duration}</span>
                                        <SButton variant="plain" onClick={() => {/* handle view transcript */}}>
                                            View Transcript
                                        </SButton>
                                    </div>
                                </div>
                            )) : (
                                <div className="empty-logs text-center p-48 text-secondary opacity-60">
                                    <Icons.Info size={24} className="mb-12" />
                                    <p>No activity logs found for this agent yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
