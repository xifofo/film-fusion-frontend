import { apiClient } from '@/lib/api-client';

export type APITokenScope = {
  id: string;
  name: string;
  description: string;
  prefixes: string[];
};

export type APIToken = {
  id: number;
  name: string;
  prefix: string;
  scopes: string[];
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

export type IssuedAPIToken = { token: string; record: APIToken };

export const getAPITokens = () =>
  apiClient.get<API.Response<APIToken[]>>('/api/api-tokens');

export const getAPITokenScopes = () =>
  apiClient.get<API.Response<APITokenScope[]>>('/api/api-tokens/scopes');

export const createAPIToken = (data: {
  name: string;
  scopes: string[];
  expires_at: string | null;
}) => apiClient.post<API.Response<IssuedAPIToken>>('/api/api-tokens', data);

export const revokeAPIToken = (id: number) =>
  apiClient.post<API.Response<null>>(`/api/api-tokens/${id}/revoke`);
