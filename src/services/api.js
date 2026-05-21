import axios from "axios";

const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5001/api"
    : "https://health-931r.onrender.com/api";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

function getAuthToken(url) {
  if (url && url.startsWith("/admin")) {
    return localStorage.getItem("admin_token") || localStorage.getItem("token") || null;
  }
  return localStorage.getItem("token") || localStorage.getItem("admin_token") || null;
}

// Request interceptor for tokens
api.interceptors.request.use((config) => {
  const token = getAuthToken(config.url);

  console.log("Using token:", token);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

// Response interceptor for easy data access and error handling
api.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url} Status: ${response.status}`, response.data);
    return response.data;
  },
  (error) => {
    const method = error.config?.method?.toUpperCase();
    const url = error.config?.url;
    const message = error.response?.data?.error || error.response?.data?.message || error.message;
    console.error(`[API Error] ${method} ${url}:`, message);
    return Promise.reject(new Error(message));
  }
);

export { api };
export default api;