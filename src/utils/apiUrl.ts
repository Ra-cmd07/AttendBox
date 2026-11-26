/**
 * Get the API base URL dynamically based on current hostname
 * This allows the app to work on any network without hardcoded IPs
 */
export const getApiBaseUrl = (): string => {
  // Check both VITE_API_URL and VITE_API_BASE_URL for backwards compatibility
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.replace('/api', ''); // Remove /api suffix if present
  }
  
  // Construct dynamically from current hostname
  const protocol = window.location.protocol; // http: or https:
  const hostname = window.location.hostname; // e.g., 192.168.1.29, localhost
  return `${protocol}//${hostname}:5000`;
};

/**
 * Get the full API URL (with /api suffix)
 */
export const getApiUrl = (): string => {
  return `${getApiBaseUrl()}/api`;
};
