import React from 'react';
import {
    Plus, Search, Edit2, Trash2, Save, Filter, Download, Upload,
    ArrowLeft, ArrowRight, ChevronRight, Calendar, Settings, Package, Users,
    ShoppingCart, CreditCard, FileText, History, AlertCircle,
    AlertTriangle, CheckCircle2, LayoutGrid, X, Printer, Activity,
    Eye, RotateCcw, Clock, TrendingUp, HelpCircle, User,
    ChevronLeft, MoreVertical, MoreHorizontal, Info, Shield,
    Check, Menu, Layers, LogOut, Cloud, Scan, Wifi, Minus,
    Banknote, Smartphone, Command, Monitor, Cpu, MessageSquare,
    Zap, Pause, Play, Database, Archive, ShieldCheck, Lock, ArrowUp,
    PieChart, CloudLightning, BarChart2, ShoppingBag, UserPlus, ArrowUpDown, Tag,
    Phone, Mail
} from 'lucide-react';

const DashboardCustomIcon = ({ size = 20, stroke = 'currentColor', strokeWidth = 1.18632, ...props }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 14 14" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <path 
            d="M11.519 4.29406L12.5334 5.41648C12.702 5.603 12.7954 5.84546 12.7954 6.09688V10.7719C12.7954 11.8927 11.8867 12.8013 10.7659 12.8013H2.62272C1.50188 12.8013 0.593262 11.8927 0.593262 10.7719V5.91735C0.593262 5.63122 0.714063 5.35839 0.925909 5.16606L5.38251 1.12001C6.13766 0.434421 7.28434 0.415805 8.06135 1.07652L9.8929 2.63394C9.93683 2.6713 10.0044 2.64007 10.0044 2.5824V1.26547M4.45641 10.3342H8.65993" 
            stroke={stroke} 
            strokeWidth={strokeWidth} 
            strokeLinecap="round" 
            strokeLinejoin="round"
        />
    </svg>
);

/**
 * Common icons used in the app.
 * This ensures consistency and optimized bundling.
 */
export const Icons = {
    Plus, Search, Edit: Edit2, Edit2, Delete: Trash2, Trash: Trash2, Trash2, Save, Filter, Download, Upload,
    ArrowLeft, ArrowRight, ChevronRight, Calendar, Settings, Package, Users,
    ShoppingCart, CreditCard, FileText, History, AlertCircle,
    AlertTriangle, CheckCircle: CheckCircle2, Layout: DashboardCustomIcon, X, Printer, Activity,
    Eye, RotateCcw, Clock, TrendingUp, HelpCircle, User,
    ChevronLeft, MoreVertical, MoreHorizontal, Info, Shield,
    Check, Menu, Layers, LogOut, Cloud, Scan, Wifi, Minus,
    Banknote, Smartphone, Command, Monitor, Cpu, MessageSquare,
    Zap, Pause, Play, Database, Archive, ShieldCheck, Lock, ArrowUp,
    PieChart, CloudLightning, BarChart2, ShoppingBag, UserPlus, ArrowUpDown, Tag,
    Phone, Mail
};

export default Icons;
