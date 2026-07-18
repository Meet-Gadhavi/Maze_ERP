import React from 'react';
import { motion } from 'framer-motion';
import {
    Plus, Search, Edit2, Trash2, Save, Filter, Download, Upload,
    ArrowLeft, ArrowRight, ChevronRight, ChevronDown, Calendar, Settings, Package, Users,
    ShoppingCart, CreditCard, FileText, History, AlertCircle,
    AlertTriangle, CheckCircle2, LayoutGrid, X, Printer, Activity,
    Eye, RotateCcw, Clock, TrendingUp, HelpCircle, User,
    ChevronLeft, MoreVertical, MoreHorizontal, Info, Shield,
    Check, Menu, Layers, LogOut, Cloud, Scan, Wifi, Minus,
    Banknote, Smartphone, Command, Monitor, Cpu, MessageSquare,
    Zap, Pause, Play, Database, Archive, ShieldCheck, Lock, ArrowUp,
    PieChart, CloudLightning, BarChart2, ShoppingBag, UserPlus, ArrowUpDown, Tag,
    Phone, Mail, List, KeyRound, Award, CornerDownRight, ArrowUpRight, PlusCircle, MinusCircle
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Custom SVG icons
// ─────────────────────────────────────────────────────────────

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

const ShareCustomIcon = ({ size = 24, stroke = 'currentColor', strokeWidth = 2, ...props }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <path
            d="M7 11C6.07003 11 5.60504 11 5.22354 11.1022C4.18827 11.3796 3.37962 12.1883 3.10222 13.2235C3 13.605 3 14.07 3 15V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V15C21 14.07 21 13.605 20.8978 13.2235C20.6204 12.1883 19.8117 11.3796 18.7765 11.1022C18.395 11 17.93 11 17 11M16 7L12 3M12 3L8 7M12 3V15"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

// ─────────────────────────────────────────────────────────────
// Framer Motion animation variants
// ─────────────────────────────────────────────────────────────

const iconVariants = {
    initial: { opacity: 0, scale: 0.65 },
    animate: {
        opacity: 1,
        scale: 1,
        transition: { type: 'spring', stiffness: 380, damping: 22, mass: 0.6 }
    },
    hover: {
        scale: 1.18,
        rotate: 4,
        transition: { type: 'spring', stiffness: 500, damping: 18 }
    },
    tap: {
        scale: 0.88,
        rotate: -2,
        transition: { type: 'spring', stiffness: 600, damping: 20 }
    }
};

/**
 * Wraps any icon component with framer-motion animations:
 * - mount: fade-in + spring scale from 0.65 → 1
 * - hover: scale up + slight rotate
 * - tap: scale down for press feedback
 *
 * All original icon props (size, color, className, style, etc.) pass through.
 */
function withMotion(IconComponent) {
    const AnimatedIcon = React.forwardRef(({ style, className, onClick, ...props }, ref) => (
        <motion.span
            ref={ref}
            variants={iconVariants}
            initial="initial"
            animate="animate"
            whileHover="hover"
            whileTap="tap"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 0,
                ...style
            }}
            className={className}
            onClick={onClick}
        >
            <IconComponent {...props} />
        </motion.span>
    ));
    AnimatedIcon.displayName = `Motion(${IconComponent.displayName || IconComponent.name || 'Icon'})`;
    return AnimatedIcon;
}

// ─────────────────────────────────────────────────────────────
// Animated icon map — every icon gets motion treatment
// ─────────────────────────────────────────────────────────────

/**
 * Common icons used in the app.
 * All icons are wrapped with framer-motion for entrance + hover animations.
 * This ensures consistency and optimized bundling.
 */
export const Icons = {
    Plus:           withMotion(Plus),
    Search:         withMotion(Search),
    Edit:           withMotion(Edit2),
    Edit2:          withMotion(Edit2),
    Delete:         withMotion(Trash2),
    Trash:          withMotion(Trash2),
    Trash2:         withMotion(Trash2),
    Save:           withMotion(Save),
    Filter:         withMotion(Filter),
    Download:       withMotion(Download),
    Upload:         withMotion(Upload),
    ArrowLeft:      withMotion(ArrowLeft),
    ArrowRight:     withMotion(ArrowRight),
    ChevronRight:   withMotion(ChevronRight),
    ChevronDown:    withMotion(ChevronDown),
    ChevronLeft:    withMotion(ChevronLeft),
    Calendar:       withMotion(Calendar),
    Settings:       withMotion(Settings),
    Package:        withMotion(Package),
    Users:          withMotion(Users),
    ShoppingCart:   withMotion(ShoppingCart),
    CreditCard:     withMotion(CreditCard),
    FileText:       withMotion(FileText),
    History:        withMotion(History),
    AlertCircle:    withMotion(AlertCircle),
    AlertTriangle:  withMotion(AlertTriangle),
    CheckCircle:    withMotion(CheckCircle2),
    Layout:         withMotion(DashboardCustomIcon),
    X:              withMotion(X),
    Printer:        withMotion(Printer),
    Activity:       withMotion(Activity),
    Eye:            withMotion(Eye),
    RotateCcw:      withMotion(RotateCcw),
    Clock:          withMotion(Clock),
    TrendingUp:     withMotion(TrendingUp),
    HelpCircle:     withMotion(HelpCircle),
    User:           withMotion(User),
    MoreVertical:   withMotion(MoreVertical),
    MoreHorizontal: withMotion(MoreHorizontal),
    Info:           withMotion(Info),
    Shield:         withMotion(Shield),
    Check:          withMotion(Check),
    Menu:           withMotion(Menu),
    Layers:         withMotion(Layers),
    LogOut:         withMotion(LogOut),
    Cloud:          withMotion(Cloud),
    Scan:           withMotion(Scan),
    Wifi:           withMotion(Wifi),
    Minus:          withMotion(Minus),
    Banknote:       withMotion(Banknote),
    Smartphone:     withMotion(Smartphone),
    Command:        withMotion(Command),
    Monitor:        withMotion(Monitor),
    Cpu:            withMotion(Cpu),
    MessageSquare:  withMotion(MessageSquare),
    Zap:            withMotion(Zap),
    Pause:          withMotion(Pause),
    Play:           withMotion(Play),
    Database:       withMotion(Database),
    Archive:        withMotion(Archive),
    ShieldCheck:    withMotion(ShieldCheck),
    Lock:           withMotion(Lock),
    ArrowUp:        withMotion(ArrowUp),
    ArrowUpRight:   withMotion(ArrowUpRight),
    PieChart:       withMotion(PieChart),
    CloudLightning: withMotion(CloudLightning),
    BarChart2:      withMotion(BarChart2),
    ShoppingBag:    withMotion(ShoppingBag),
    UserPlus:       withMotion(UserPlus),
    ArrowUpDown:    withMotion(ArrowUpDown),
    Tag:            withMotion(Tag),
    Phone:          withMotion(Phone),
    Mail:           withMotion(Mail),
    Grid:           withMotion(LayoutGrid),
    List:           withMotion(List),
    Share:          withMotion(ShareCustomIcon),
    KeyRound:       withMotion(KeyRound),
    Award:          withMotion(Award),
    CornerDownRight: withMotion(CornerDownRight),
    PlusCircle:     withMotion(PlusCircle),
    MinusCircle:    withMotion(MinusCircle),
};

export default Icons;
