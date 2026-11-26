/**
 * Get the API base URL dynamically based on current hostname
 * This allows the app to work on any network without hardcoded IPs
 * 
 * Production (attendbox.pages.dev) → Uses Cloudflare Tunnel from .env
 * Local development (localhost) → Uses localhost:5000
 */
export const getApiBaseUrl = (): string => {
  // Check both VITE_API_URL and VITE_API_BASE_URL for backwards compatibility
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  
  // For production deployment, use the tunnel URL from .env
  if (window.location.hostname === 'attendbox.pages.dev' || 
      window.location.hostname.endsWith('.pages.dev')) {
    if (envUrl && envUrl.trim()) {
      return envUrl.replace('/api', ''); // Remove /api suffix if present
    }
  }
  
  // For local development, ignore .env and use localhost
  if (window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1') {
    const protocol = window.location.protocol; // http: or https:
    return `${protocol}//localhost:5000`;
  }
  
  // For LAN access (e.g., 192.168.x.x), use same host with port 5000
  const protocol = window.location.protocol; // http: or https:
  const hostname = window.location.hostname; // e.g., 192.168.1.29
  return `${protocol}//${hostname}:5000`;
};

/**
 * Get the full API URL (with /api suffix)
 */
export const getApiUrl = (): string => {
  return `${getApiBaseUrl()}/api`;
};
