export function isOnline() {
    return typeof window !== 'undefined' && !!window.navigator?.onLine;
}

