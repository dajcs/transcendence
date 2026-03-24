import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "https://localhost:8443",
  withCredentials: true, // send httpOnly cookies automatically
  headers: {
    "Content-Type": "application/json",
  },
});
