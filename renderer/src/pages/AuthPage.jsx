import React, { useState } from 'react';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { APP_NAME } from '../constants';
import authIllustration from '../assets/images/auth-illustration.png';
import './AuthPage.css';
import SButton from '../components/SButton';

export default function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                toast.success('Welcome back!');
            } else {
                const isLocal = window.location.origin.includes('localhost');
                const isElectron = !!(window.maze || navigator.userAgent.toLowerCase().includes('electron'));
                const redirectTo = isElectron ? 'maze-erp://auth-callback' : (isLocal ? 'http://localhost:5175' : 'maze-erp://auth-callback');

                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: redirectTo
                    }
                });
                if (error) throw error;
                toast.success('Check your email for confirmation link!');
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const isLocal = window.location.origin.includes('localhost');
            const isElectron = !!(window.maze || navigator.userAgent.toLowerCase().includes('electron'));
            const redirectTo = isElectron ? 'maze-erp://auth-callback' : (isLocal ? 'http://localhost:5175' : 'maze-erp://auth-callback');

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectTo,
                    skipBrowserRedirect: isElectron
                }
            });
            if (error) throw error;

            if (isElectron && data?.url) {
                window.maze.openExternal(data.url);
            }
        } catch (error) {
            toast.error('Authentication failed: ' + error.message);
            console.error('OAuth Error:', error);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-sidebar">
                <img src={authIllustration} alt="Auth Illustration" className="auth-illustration" />
                <h1>{APP_NAME}</h1>
                <p>Manage your business with intelligence and elegance. The most advanced ERP solution for modern enterprises.</p>
            </div>

            <div className="auth-form-section">
                <div className={`auth-card auth-fade-active`} key={isLogin ? 'login' : 'signup'}>
                    <div className="auth-header">
                        <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>
                        <p>{isLogin ? 'Enter your credentials to access your workspace' : `Join ${APP_NAME} and transform your business today`}</p>
                    </div>

                    <div className="auth-tabs">
                        <button
                            className={`auth-tab ${isLogin ? 'active' : ''}`}
                            onClick={() => setIsLogin(true)}
                        >
                            Sign In
                        </button>
                        <button
                            className={`auth-tab ${!isLogin ? 'active' : ''}`}
                            onClick={() => setIsLogin(false)}
                        >
                            Sign Up
                        </button>
                    </div>

                    <div className="social-auth">
                        <SButton variant="secondary" onClick={handleGoogleLogin} style={{ width: '100%', display: 'flex', gap: '10px', height: '48px', justifyContent: 'center', fontSize: '1rem' }}>
                            <svg width="20" height="20" viewBox="0 0 48 48" style={{ marginRight: '8px' }}>
                                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                            </svg>
                            Sign in with Google
                        </SButton>
                    </div>

                    <div className="divider">or continue with email</div>

                    <form className="auth-form" onSubmit={handleAuth}>
                        <div className="form-group">
                            <label>Email Address</label>
                            <div className="input-with-icon">
                                <Icons.Mail size={18} className="input-icon" />
                                <input
                                    type="email"
                                    placeholder="name@company.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <div className="input-with-icon">
                                <Icons.Lock size={18} className="input-icon" />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <SButton
                            variant="primary"
                            style={{ height: '48px', marginTop: '12px', width: '100%', justifyContent: 'center' }}
                            disabled={loading}
                            loading={loading}
                            type="submit"
                        >
                            {isLogin ? 'Sign In' : 'Create Account'}
                        </SButton>
                    </form>

                    <p className="form-footer">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                        <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(!isLogin); }}>
                            {isLogin ? ' Sign Up' : ' Sign In'}
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
