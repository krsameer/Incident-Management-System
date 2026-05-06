import { useEffect, useMemo, useState } from 'react';
import { closeWorkItem, loadDashboard, loadIncident, submitRca, transitionWorkItem } from './api';
import { RCARecord, SignalRecord, WorkItemRecord } from './types';

const emptyRca = (): RCARecord => ({
  incidentStartAt: '',
  incidentEndAt: '',
  rootCauseCategory: 'Infrastructure',
  fixApplied: '',
  preventionSteps: '',
  submittedAt: new Date().toISOString()
});

export default function App() {
  const [incidents, setIncidents] = useState<WorkItemRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailSignals, setDetailSignals] = useState<SignalRecord[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<WorkItemRecord | null>(null);
  const [rca, setRca] = useState<RCARecord>(emptyRca());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshDashboard();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    void refreshDetail(selectedId);
  }, [selectedId]);

  const sortedIncidents = useMemo(() => {
    const order = { critical: 4, high: 3, medium: 2, low: 1 } as const;
    return [...incidents].sort((left, right) => order[right.severity] - order[left.severity]);
  }, [incidents]);

  async function refreshDashboard() {
    setLoading(true);
    setError(null);
    try {
      const data = await loadDashboard();
      setIncidents(data);
      if (!selectedId && data[0]) {
        setSelectedId(data[0].id);
      }
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function refreshDetail(id: string) {
    try {
      const detail = await loadIncident(id);
      setSelectedIncident(detail.workItem);
      setDetailSignals(detail.signals);
      setRca(detail.workItem.rca ?? emptyRca());
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unable to load incident');
    }
  }

  async function handleRcaSubmit() {
    if (!selectedId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updated = await submitRca(selectedId, rca);
      setSelectedIncident(updated);
      setIncidents((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      await refreshDetail(selectedId);
      await refreshDashboard();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unable to submit RCA');
    } finally {
      setLoading(false);
    }
  }

  async function handleCloseIncident() {
    if (!selectedId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updated = await closeWorkItem(selectedId);
      setSelectedIncident(updated);
      setIncidents((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      await refreshDetail(selectedId);
      await refreshDashboard();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unable to close incident');
    } finally {
      setLoading(false);
    }
  }

  async function handlePromote() {
    if (!selectedId || !selectedIncident) {
      return;
    }
    setLoading(true);
    try {
      const updated = await transitionWorkItem(selectedId, selectedIncident.status === 'OPEN' ? 'INVESTIGATING' : 'RESOLVED');
      setSelectedIncident(updated);
      setIncidents((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      await refreshDetail(selectedId);
      await refreshDashboard();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unable to update status');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Mission-Critical Incident Management System</p>
          <h1>Mission Control for distributed failure signals.</h1>
          <p className="subtitle">
            Active incidents, raw signal audit trails, and mandatory RCA workflow in one fast operational view.
          </p>
        </div>
        <button className="ghost-button" onClick={() => void refreshDashboard()} disabled={loading}>
          Refresh
        </button>
      </section>

      {error ? <div className="banner error">{error}</div> : null}

      <section className="grid">
        <aside className="panel list-panel">
          <div className="panel-header">
            <h2>Active Incidents</h2>
            <span>{sortedIncidents.length} open</span>
          </div>
          <div className="incident-list">
            {sortedIncidents.map((incident) => (
              <button
                key={incident.id}
                className={`incident-card ${selectedId === incident.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(incident.id)}
              >
                <div className="incident-card__top">
                  <strong>{incident.componentId}</strong>
                  <span className={`severity severity-${incident.severity}`}>{incident.severity}</span>
                </div>
                <p>{incident.title}</p>
                <small>
                  {incident.status} · {incident.responderTeam} · MTTR {incident.mttrMinutes ?? 'n/a'} min
                </small>
              </button>
            ))}
            {!sortedIncidents.length ? <p className="empty-state">No active incidents. The cache is calm.</p> : null}
          </div>
        </aside>

        <section className="panel detail-panel">
          <div className="panel-header">
            <h2>Incident Detail</h2>
            <div className="actions">
              <button className="secondary-button" onClick={() => void handlePromote()} disabled={!selectedIncident || loading}>
                Advance State
              </button>
              <button className="primary-button" onClick={() => void handleCloseIncident()} disabled={!selectedIncident || loading}>
                Close Incident
              </button>
            </div>
          </div>

          {selectedIncident ? (
            <div className="detail-stack">
              <div className="detail-card">
                <div className="metrics-row">
                  <div>
                    <span>Status</span>
                    <strong>{selectedIncident.status}</strong>
                  </div>
                  <div>
                    <span>Severity</span>
                    <strong>{selectedIncident.severity}</strong>
                  </div>
                  <div>
                    <span>Alert Route</span>
                    <strong>{selectedIncident.alertChannel}</strong>
                  </div>
                  <div>
                    <span>Responder Team</span>
                    <strong>{selectedIncident.responderTeam}</strong>
                  </div>
                </div>
                <p className="muted">{selectedIncident.title}</p>
              </div>

              <div className="detail-card">
                <h3>Raw Signals</h3>
                <div className="signal-list">
                  {detailSignals.map((signal) => (
                    <article key={`${signal.receivedAt}-${signal.message}`} className="signal-item">
                      <div>
                        <strong>{signal.componentType}</strong>
                        <span>{signal.receivedAt}</span>
                      </div>
                      <p>{signal.message}</p>
                    </article>
                  ))}
                  {!detailSignals.length ? <p className="empty-state">No linked signals found yet.</p> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state panel-empty">Select an incident to inspect raw signals and status.</div>
          )}
        </section>
      </section>

      <section className="panel rca-panel">
        <div className="panel-header">
          <h2>RCA Form</h2>
          <span>Required before closing</span>
        </div>

        <div className="form-grid">
          <label>
            Incident Start
            <input type="datetime-local" value={rca.incidentStartAt} onChange={(event) => setRca({ ...rca, incidentStartAt: event.target.value })} />
          </label>
          <label>
            Incident End
            <input type="datetime-local" value={rca.incidentEndAt} onChange={(event) => setRca({ ...rca, incidentEndAt: event.target.value })} />
          </label>
          <label>
            Root Cause Category
            <select value={rca.rootCauseCategory} onChange={(event) => setRca({ ...rca, rootCauseCategory: event.target.value })}>
              <option>Infrastructure</option>
              <option>Capacity</option>
              <option>Code Regression</option>
              <option>Third-Party Dependency</option>
              <option>Operational Error</option>
            </select>
          </label>
          <label className="full-width">
            Fix Applied
            <textarea rows={4} value={rca.fixApplied} onChange={(event) => setRca({ ...rca, fixApplied: event.target.value })} />
          </label>
          <label className="full-width">
            Prevention Steps
            <textarea rows={4} value={rca.preventionSteps} onChange={(event) => setRca({ ...rca, preventionSteps: event.target.value })} />
          </label>
        </div>

        <div className="form-actions">
          <button className="secondary-button" onClick={() => void handleRcaSubmit()} disabled={!selectedIncident || loading}>
            Save RCA and Resolve
          </button>
        </div>
      </section>
    </main>
  );
}
