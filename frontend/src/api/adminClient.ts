import axios from 'axios';
import { api } from './client';

const ADMIN_SECRET_STORAGE_KEY = 'admin_secret';

export const adminApi = axios.create({
  baseURL: `${api.defaults.baseURL ?? 'http://localhost:8000/api'}/admin`,
});

export function getStoredAdminSecret() {
  return sessionStorage.getItem(ADMIN_SECRET_STORAGE_KEY) ?? '';
}

export function storeAdminSecret(secret: string) {
  sessionStorage.setItem(ADMIN_SECRET_STORAGE_KEY, secret);
}

export function clearAdminSecret() {
  sessionStorage.removeItem(ADMIN_SECRET_STORAGE_KEY);
}

export function adminHeaders(secret: string) {
  return {
    'x-admin-secret': secret,
  };
}
