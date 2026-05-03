import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api", // ✅ Your live Laravel API
  headers: {
    Accept: "application/json",
  },
  withCredentials: false,
});

// 🔐 Attach token + Dynamic Content-Type handling
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    // ✅ Add Bearer Token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // ✅ IMPORTANT — handle FormData (image uploads etc.)
    if (config.data instanceof FormData) {
      // Let browser set multipart boundary automatically
      delete config.headers["Content-Type"];
    } else {
      // Default JSON requests
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ❗ Global 401 handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log("⚠️ Token expired or invalid. Redirecting to login...");
      localStorage.removeItem("token");

      // ✅ Subfolder-safe redirect (your original fix kept)
      window.location.href = "/DBS_frontend_30500/login";
    }
    return Promise.reject(error);
  }
);

export default api;
