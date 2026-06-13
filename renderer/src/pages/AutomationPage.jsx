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
import ConnectedServicesCard from '../components/automation/ConnectedServicesCard';

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

const DEFAULT_PROMPTS = {
    'Sales': 'You are an aggressive and persuasive sales closing assistant. Your goal is to convince the customer to place an order.',
    'Support': 'You are an empathetic and helpful customer support assistant. Your goal is to resolve the customer\'s queries.',
    'Purchase': 'You are an analytical and firm procurement assistant. Your goal is to negotiate vendor rates.',
    'Multipurpose': 'You are a balanced and professional business assistant.'
};

const DEFAULT_FIRST_MESSAGES = {
    'Sales': 'Hello! I\'m calling from our sales department. How are you doing today?',
    'Support': 'Hello! Thanks for calling customer support. How can I help you today?',
    'Purchase': 'Hello, I\'m calling to discuss our recent vendor procurement request.',
    'Multipurpose': 'Hello, how can I help you today?'
};

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
    const [isWaitingForPayment, setIsWaitingForPayment] = useState(false);
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
        language: 'en',
        personality: 'Sales',
        system_prompt: 'You are an aggressive and persuasive sales closing assistant. Your goal is to convince the customer to place an order.',
        first_message: 'Hello! I\'m calling from our sales department. How are you doing today?',
        providerType: 'BUY_NOW',
        plan: 'starter',
        model: 'Cheap',
        voice_id: 'FmBhnvP58BK0vz65OOj7',
        sip_trunk: {
            label: '',
            phone_number: '',
            media_encryption: 'allowed',
            username: '',
            password: '',
            address: ''
        }
    });

    const formDataRef = React.useRef(formData);
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);
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
            language: 'en',
            personality: 'Sales',
            system_prompt: DEFAULT_PROMPTS['Sales'],
            first_message: DEFAULT_FIRST_MESSAGES['Sales'],
            providerType: 'BUY_NOW',
            plan: 'starter',
            model: 'Cheap',
            voice_id: 'FmBhnvP58BK0vz65OOj7',
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
        
        const isOwn = !!agent.config?.sip || !!agent.config?.phone;
        
        setFormData({
            name: agent.name,
            business_name: agent.metadata?.business_name || '',
            language: agent.config?.language || agent.language || 'en',
            personality: 'Sales',
            system_prompt: agent.persona || '',
            first_message: agent.config?.first_message || '',
            providerType: isOwn ? 'OWN_PROVIDER' : 'BUY_NOW',
            plan: agent.config?.plan || 'starter',
            model: agent.config?.model || 'Cheap',
            voice_id: agent.config?.voice_id || 'FmBhnvP58BK0vz65OOj7',
            sip_trunk: {
                label: agent.config?.sip?.label || agent.config?.label || '',
                phone_number: agent.config?.phone || agent.config?.phone_number || '',
                media_encryption: agent.config?.sip?.mediaEncryption || agent.config?.media_encryption || 'allowed',
                username: agent.config?.sip?.inboundUsername || agent.config?.username || '',
                password: agent.config?.sip?.inboundPassword || agent.config?.password || '',
                address: agent.config?.sip?.outboundAddress || agent.config?.address || ''
            }
        });
        setStep(1); // Open step 1 to allow prompt & message edits
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
                    .select('status, agent_id, agent_name, notes')
                    .eq('agent_id', agent.id)
                    .maybeSingle();

                // 2. Fallback: If not found by ID, try by name (since admin might have provisioned before ID sync)
                if (!data && !error) {
                    console.log(`[Sync] ID match failed for ${agent.name}, trying name fallback...`);
                    const { data: nameData, error: nameError } = await mazewaySupabase
                        .from('mazeway_number_requests')
                        .select('status, agent_id, agent_name, notes')
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
                    
                    let updatedConfig = { ...agent.config };
                    if (nextStatus === 'ACTIVE') {
                        const phoneNum = data.notes && data.notes.trim() !== '' ? data.notes.trim() : `+91 99990 ${Math.floor(10000 + Math.random() * 90000)}`;
                        updatedConfig.phone_number = phoneNum;
                    }
                    
                    const updatedAgent = { 
                        ...agent, 
                        status: nextStatus, 
                        is_active: nextActive,
                        config: updatedConfig
                    };
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

    useEffect(() => {
        const handlePaymentMessage = async (event) => {
            if (event.data?.type === 'payment-success') {
                setIsWaitingForPayment(false);
                setShowModal(false);
                
                const { agent_id, name, persona, language, model, voice_id } = event.data;
                if (agent_id) {
                    try {
                        const currentForm = formDataRef.current || {};
                        const newAgent = {
                            id: agent_id,
                            name: currentForm.name || name || 'AI Voice Agent',
                            type: 'Voice',
                            persona: currentForm.system_prompt || persona || '',
                            status: 'ACTIVE',
                            is_active: true,
                            config: {
                                language: currentForm.language || language || 'en',
                                first_message: currentForm.first_message || 'Hello, how can I help you?',
                                model: currentForm.model || model || 'Cheap',
                                voice_id: currentForm.voice_id || voice_id || 'FmBhnvP58BK0vz65OOj7'
                            }
                        };
                        await api.saveAgent(newAgent);
                    } catch (e) {
                        console.error('Failed to save provisioned agent locally:', e);
                    }
                }
                fetchAgents();
            }
        };
        window.addEventListener('message', handlePaymentMessage);
        return () => window.removeEventListener('message', handlePaymentMessage);
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
            setIsWaitingForPayment(true);
            const isElectron = !!(window.maze || navigator.userAgent.toLowerCase().includes('electron'));
            const redirectTo = 'maze-erp://provision-agent';
            const webPayUrl = `https://quantro-web-mazelabs.vercel.app/?action=buy-agent&plan=${formData.plan}&redirect=${encodeURIComponent(redirectTo)}`;

            if (isElectron && window.maze?.openExternal) {
                window.maze.openExternal(webPayUrl);
            } else {
                window.open(webPayUrl, '_blank');
            }
        } else {
            finalizeAgent();
        }
    };


    const finalizeAgent = async () => {
        const currentAgent = agents.find(a => a.id === editingAgentId);
        const isProvisioning = currentAgent?.status === 'PROVISIONING';

        const loadingId = toast.loading(isEditing ? 'Updating agent configuration...' : 'Creating voice agent on ElevenLabs...');
        try {
            let agentId = editingAgentId || 'NEW';

            const updatedAgent = {
                id: agentId,
                name: formData.name,
                type: 'Voice',
                persona: formData.system_prompt,
                status: isProvisioning ? 'PROVISIONING' : 'ACTIVE',
                is_active: isEditing ? currentAgent?.is_active : true,
                metadata: {
                    business_name: formData.business_name
                },
                config: {
                    language: formData.language,
                    first_message: formData.first_message || 'Hello, how can I help you?',
                    phone: formData.sip_trunk?.phone_number || '',
                    model: formData.model || 'Cheap',
                    voice_id: formData.voice_id || 'FmBhnvP58BK0vz65OOj7',
                    plan: formData.plan || 'starter',
                    price: AGENT_PLANS.find(p => p.id === formData.plan)?.price || 600,
                    sip: formData.providerType === 'OWN_PROVIDER' ? {
                        label: formData.sip_trunk.label || `${formData.name} Trunk`,
                        phoneNumber: formData.sip_trunk.phone_number
                    } : null
                }
            };

            if (isProvisioning) {
                let accountEmail = 'test@erp.local';
                try {
                    const settings = await api.getSettings();
                    accountEmail = settings?.email || 'test@erp.local';
                } catch (_) {}

                const notesPayload = JSON.stringify({
                    account_email: accountEmail,
                    persona: formData.system_prompt,
                    language: formData.language,
                    model: formData.model || 'Cheap',
                    plan: formData.plan || 'starter',
                    first_message: formData.first_message,
                    business_name: formData.business_name,
                    voice_id: formData.voice_id || 'FmBhnvP58BK0vz65OOj7'
                });

                const { error } = await mazewaySupabase
                    .from('mazeway_number_requests')
                    .update({
                        agent_name: formData.name,
                        notes: notesPayload
                    })
                    .eq('agent_id', agentId);

                if (error) {
                    console.warn('[Mazeway Cloud] Failed to update request metadata on Supabase:', error);
                }
            }

            // Save agent directly on ElevenLabs (or locally if provisioning) via backend POST /agents
            await api.saveAgent(updatedAgent);
            
            // Reload list from ElevenLabs
            await fetchAgents();

            setShowModal(false);
            setIsEditing(false);
            setStep(1);
            toast.success(isEditing ? 'Agent updated successfully!' : 'AI Agent created successfully on ElevenLabs!', { id: loadingId });
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
                    <p className="text-secondary">Orchestrate your AI Voice and WhatsApp sales force</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div className="header-actions">
                        <SButton variant="secondary" onClick={() => handleSyncNow()} disabled={syncingNow}>
                            {syncingNow ? 'Syncing...' : 'Sync Now'}
                        </SButton>
                        <SButton variant="primary" onClick={handleOpenCreate}>
                            Create New Agent
                        </SButton>
                    </div>
                    <div className="sync-meta-row" style={{ marginTop: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                        <span className="sync-meta-label" style={{ color: 'var(--text-tertiary)' }}>Last Synced with Mazeway:</span>
                        <span className="sync-meta-value" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString('en-IN') : 'Never'}
                        </span>
                    </div>
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

            <ConnectedServicesCard 
                agents={agents}
                onCreateVoiceAgent={handleOpenCreate}
                onOpenConfig={handleOpenConfig}
                onToggleActive={toggleAgentActive}
                onDeleteAgent={handleDeleteAgent}
                onEditAgent={handleOpenEdit}
            />

            <Modal
                open={showModal}
                onClose={() => {
                    setShowModal(false);
                    setIsWaitingForPayment(false);
                }}
                heading={isWaitingForPayment ? 'Payment Verification' : (step === 1 ? (isEditing ? 'Edit Agent Profile' : 'Create Agent Profile') : 'Infrastructure Setup')}
                size="large"
            >
                {isWaitingForPayment ? (
                    <div className="flex-column align-center justify-center p-48 text-center" style={{ gap: '24px' }}>
                        <div className="spinner" style={{ width: '48px', height: '48px', borderTopColor: 'var(--accent)', margin: '0 auto' }}></div>
                        <div>
                            <h4 className="size-16 fw-600 mb-8">Payment in Progress</h4>
                            <p className="size-14 text-secondary ls-tight mx-auto animate-pulse" style={{ maxWidth: '360px' }}>
                                We have redirected you to your web browser to complete the payment for your managed AI Voice Agent plan. 
                                Once the transaction is complete, click <strong>"Provision Agent"</strong> in the browser to return and activate.
                            </p>
                        </div>
                        <SButton variant="secondary" onClick={() => setIsWaitingForPayment(false)}>
                            Cancel & Back
                        </SButton>
                    </div>
                ) : (
                    <>
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
                                            { value: 'en', label: 'English (Indian)' },
                                            { value: 'hi', label: 'Hindi' },
                                            { value: 'gu', label: 'Gujarati' },
                                            { value: 'mr', label: 'Marathi' },
                                            { value: 'ta', label: 'Tamil' }
                                        ]}
                                        placeholder="Select language"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="block mb-8">Personality / Role</label>
                                    <CustomSelect
                                        value={formData.personality}
                                        onChange={(value) => setFormData({ 
                                            ...formData, 
                                            personality: value,
                                            system_prompt: DEFAULT_PROMPTS[value] || '',
                                            first_message: DEFAULT_FIRST_MESSAGES[value] || ''
                                        })}
                                        options={PERSONA_OPTIONS}
                                        placeholder="Select personality"
                                    />
                                </div>
                            </div>
                            <div className="form-grid" style={{ marginTop: '16px' }}>
                                <div className="form-group">
                                    <label className="block mb-8">Model Selection</label>
                                    <CustomSelect
                                        value={formData.model || 'Cheap'}
                                        onChange={(value) => setFormData({ ...formData, model: value })}
                                        options={[
                                            { value: 'Cheap', label: 'Cheap (GPT-4o-Mini)' },
                                            { value: 'Medium', label: 'Medium (GPT-4o)' },
                                            { value: 'Expensive', label: 'Expensive (Claude 3.5 Sonnet)' }
                                        ]}
                                        placeholder="Select model"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="block mb-8">Voice Agent Voice</label>
                                    <CustomSelect
                                        value={formData.voice_id || 'FmBhnvP58BK0vz65OOj7'}
                                        onChange={(value) => setFormData({ ...formData, voice_id: value })}
                                        options={[
                                            { value: 'FmBhnvP58BK0vz65OOj7', label: 'Vraj' },
                                            { value: '1qEiC6qsybMkmnNdVMbK', label: 'Monika' }
                                        ]}
                                        placeholder="Select voice"
                                    />
                                </div>
                            </div>
                            <div className="form-group mb-16" style={{ marginTop: '16px' }}>
                                <label className="block mb-8">System Prompt / Instructions</label>
                                <textarea
                                    className="form-control"
                                    rows={4}
                                    placeholder="Instructions for the AI agent behavior, goals..."
                                    value={formData.system_prompt}
                                    onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                                    style={{ width: '100%', resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
                                />
                            </div>
                            <div className="form-group mb-16">
                                <label className="block mb-8">First Message</label>
                                <textarea
                                    className="form-control"
                                    rows={2}
                                    placeholder="Greeting spoken by the agent when call is answered..."
                                    value={formData.first_message}
                                    onChange={(e) => setFormData({ ...formData, first_message: e.target.value })}
                                    style={{ width: '100%', resize: 'vertical', minHeight: '50px', fontFamily: 'inherit' }}
                                />
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
                                <div className="vobiz-form pr-8">
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
                </>
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
