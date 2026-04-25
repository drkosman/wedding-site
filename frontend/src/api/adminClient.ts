import axios from 'axios';
import { api } from './client';

const API_SUFFIX = '/api';
const ADMIN_SECRET_STORAGE_KEY = 'admin_secret';

function getAdminBaseURL() {
  const apiBaseURL = api.defaults.baseURL ?? 'http://localhost:8000/api';

  if (apiBaseURL.endsWith(API_SUFFIX)) {
    return apiBaseURL.slice(0, -API_SUFFIX.length);
  }

  return apiBaseURL;
}

export const adminApi = axios.create({
  baseURL: `${getAdminBaseURL()}/admin`,
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
