import axios, { type AxiosInstance } from 'axios';

// Same origin - backend serves frontend
export const apiClient: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 300_000,
  headers: {
    'Content-Type': 'application/json',
  },
});
