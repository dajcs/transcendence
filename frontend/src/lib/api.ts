import axios from "axios";

export const api = axios.create({
  baseURL: "",
  withCredentials: true, // send httpOnly cookies automatically
  headers: {
    "Content-Type": "application/json",
  },
});
