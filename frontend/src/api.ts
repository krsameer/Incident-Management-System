import { RCARecord, SignalRecord, WorkItemRecord } from './types';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiBase}${path}`;
  console.debug('[api] request', init?.method ?? 'GET', url);
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      },
      ...init
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Request to ${url} failed: ${response.status} ${response.statusText} - ${text}`);
    }

    return response.json() as Promise<T>;
  } catch (err: any) {
    throw new Error(`Network request to ${url} failed: ${err?.message ?? String(err)}`);
  }
}

export async function loadDashboard(): Promise<WorkItemRecord[]> {
  const result = await request<{ incidents: WorkItemRecord[] }>('/dashboard');
  return result.incidents;
}

export async function loadIncident(id: string): Promise<{ workItem: WorkItemRecord; signals: SignalRecord[] }> {
  return request(`/work-items/${id}`);
}

export async function submitRca(id: string, payload: RCARecord): Promise<WorkItemRecord> {
  return request(`/work-items/${id}/rca`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function closeWorkItem(id: string): Promise<WorkItemRecord> {
  return request(`/work-items/${id}/close`, {
    method: 'POST'
  });
}

export async function transitionWorkItem(id: string, status: WorkItemRecord['status']): Promise<WorkItemRecord> {
  return request(`/work-items/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}
