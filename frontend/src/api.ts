import { RCARecord, SignalRecord, WorkItemRecord } from './types';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  return response.json() as Promise<T>;
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
