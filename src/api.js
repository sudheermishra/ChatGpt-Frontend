import axios from "axios";

const api = axios.create({
  baseURL: "https://chatgpt-backend-rby3.onrender.com/",
  withCredentials: true,
});

export default api;
