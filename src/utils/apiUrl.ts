/**
 * Get the API base URL dynamically based on current hostname
 * This allows the app to work on any network without hardcoded IPs
 */
export const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl;
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
