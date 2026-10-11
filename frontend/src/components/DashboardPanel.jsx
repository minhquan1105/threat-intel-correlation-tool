import { useState } from 'react'

function DashboardPanel({ stats, indicators, onNavigateTab }) {
  const [copiedId, setCopiedId] = useState(null)

  const recent = [...(indicators || [])]
    .sort((a, b) => new Date(b.last_seen || b.first_seen || 0) - new Date(a.last_seen || a.first_seen || 0))
    .slice(0, 6)

  const handleCopy = (id, text) => {
    if (!text) return
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const totalIndicators = stats?.total_indicators ?? 0

  return (
    <div className="dashboard-container">
      {/* KPI Cards Row */}
      <div className="dashboard-grid">
        <div className="panel stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total indicators</span>
            <div className="stat-icon-wrap icon-cyan">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
          </div>
          <strong>{totalIndicators.toLocaleString()}</strong>
          <span className="stat-meta">Ingested URLhaus IOC records</span>
        </div>

        <div className="panel stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Active campaigns</span>
            <div className="stat-icon-wrap icon-purple">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24" />
              </svg>
            </div>
          </div>
          <strong>{stats?.total_campaigns ?? 0}</strong>
          <span className="stat-meta">Identified threat clusters</span>
        </div>

        <div className="panel stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Intelligence sources</span>
            <div className="stat-icon-wrap icon-emerald">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            </div>
          </div>
          <strong>{stats?.total_sources ?? 0}</strong>
          <span className="stat-meta">Active feed connectors</span>
        </div>

        <div className="panel stat-card warning-card">
          <div className="stat-card-header">
            <span className="stat-label">High / Critical risk</span>
            <div className="stat-icon-wrap icon-amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          </div>
          <strong>{stats?.high_critical_risk_count ?? 0}</strong>
          <span className="stat-meta">Score &ge; 50 threshold</span>
        </div>
      </div>

      {/* Quick Launch & Scope Banner */}
      <div className="panel workflow-banner">
        <div className="workflow-content">
          <div className="workflow-title-row">
            <span className="telemetry-badge">ANALYST WORKFLOW</span>
            <h3>Explore Correlated Threat Graph</h3>
          </div>
          <p>
            Interactive network visualization models the latest bounded 100 indicators against active campaigns and source links with low-latency rendering and neighbor isolation.
          </p>
        </div>
        <div className="workflow-actions">
          {onNavigateTab && (
            <button
              type="button"
              className="action-btn primary-btn"
              onClick={() => onNavigateTab('graph')}
            >
              Open Threat Graph →
            </button>
          )}
        </div>
      </div>

      {/* Main Dual Panels: Recent Indicators & Distribution */}
      <div className="dashboard-split-row">
        {/* Recently Observed Indicators */}
        <div className="panel wide-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Recent telemetry</p>
              <h2>Recently observed indicators</h2>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                className="link-btn"
                onClick={() => onNavigateTab('indicators')}
              >
                View all indicators ({totalIndicators.toLocaleString()}) →
              </button>
            )}
          </div>

          <div className="list-stack">
            {recent.map((indicator) => (
              <div className="ioc-list-card" key={indicator.id}>
                <div className="ioc-info">
                  <div className="ioc-value-row">
                    <span className="ioc-inert-text" title={indicator.value}>
                      {indicator.value}
                    </span>
                    <button
                      type="button"
                      className="inline-copy-btn"
                      onClick={() => handleCopy(indicator.id, indicator.value)}
                      title="Copy IOC value"
                    >
                      {copiedId === indicator.id ? (
                        <span style={{ color: '#4ade80' }}>Copied</span>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="ioc-meta-row">
                    <span className="ioc-type-badge">{indicator.indicator_type}</span>
                    <span className="ioc-time">
                      {indicator.last_seen
                        ? new Date(indicator.last_seen).toLocaleDateString()
                        : indicator.first_seen
                        ? new Date(indicator.first_seen).toLocaleDateString()
                        : 'Recent'}
                    </span>
                    <span className="ioc-links-count">
                      {indicator.campaign_count ?? 0} campaign{indicator.campaign_count === 1 ? '' : 's'} • {indicator.source_count ?? 0} source{indicator.source_count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                <div className="ioc-severity-wrap">
                  <span className={`severity-tag severity-${indicator.risk_severity || 'low'}`}>
                    {indicator.risk_severity || 'low'}
                  </span>
                </div>
              </div>
            ))}

            {recent.length === 0 && (
              <div className="empty-subtext">No indicators currently loaded.</div>
            )}
          </div>
        </div>

        {/* Distribution Panel */}
        <div className="panel wide-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Taxonomy breakdown</p>
              <h2>Indicator types</h2>
            </div>
            <span className="header-meta-pill">
              {Object.keys(stats?.indicator_type_distribution || {}).length} types cataloged
            </span>
          </div>

          <div className="distribution-list">
            {Object.entries(stats?.indicator_type_distribution || {}).map(([type, count]) => {
              const maxVal = totalIndicators || 1
              const percent = Math.round((count / maxVal) * 100)
              return (
                <div className="distribution-item" key={type}>
                  <div className="distribution-label-row">
                    <span className="type-label capitalize">{type}</span>
                    <span className="count-label">
                      <b>{count.toLocaleString()}</b>
                      <small className="percent-text">({percent}%)</small>
                    </span>
                  </div>
                  <div className="bar-track">
                    <span
                      style={{
                        width: `${Math.max(Math.min((count / maxVal) * 100, 100), 2)}%`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="distribution-footer-card">
            <span className="footer-card-title">Telemetry Integrity Note</span>
            <p>
              URLhaus feeds report malicious URL indicators associated with ongoing malware delivery and botnet infrastructure. Normalized IOC entries preserve external references and observations.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPanel
