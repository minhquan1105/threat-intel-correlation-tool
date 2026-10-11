import { useMemo, useState } from 'react'

function IndicatorsPanel({ indicators }) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [copiedId, setCopiedId] = useState(null)
  const [copiedDetail, setCopiedDetail] = useState(false)

  // Filtered indicators based on search and type
  const filteredIndicators = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (indicators || []).filter((indicator) => {
      const matchType = typeFilter === 'all' || indicator.indicator_type?.toLowerCase() === typeFilter
      if (!matchType) return false

      if (!query) return true
      return (
        (indicator.value || '').toLowerCase().includes(query) ||
        (indicator.indicator_type || '').toLowerCase().includes(query) ||
        (indicator.description || '').toLowerCase().includes(query)
      )
    })
  }, [indicators, search, typeFilter])

  // Selected indicator
  const selectedIndicator =
    filteredIndicators.find((i) => i.id === selectedId) ||
    filteredIndicators[0] ||
    null

  // Copy helper
  const handleCopy = (id, text, isDetail = false) => {
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
    if (isDetail) {
      setCopiedDetail(true)
      setTimeout(() => setCopiedDetail(false), 2000)
    } else {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  // Unique types for filter buttons
  const availableTypes = useMemo(() => {
    const set = new Set((indicators || []).map((i) => i.indicator_type).filter(Boolean))
    return ['all', ...Array.from(set)]
  }, [indicators])

  return (
    <div className="indicators-layout">
      {/* Table Section */}
      <div className="panel table-panel">
        <div className="panel-header inline-header">
          <div>
            <div className="header-badge-row">
              <span className="telemetry-badge">TELEMETRY REPOSITORY</span>
              <span className="scope-badge">
                SHOWING {filteredIndicators.length} OF {indicators?.length || 0} LOADED
              </span>
            </div>
            <h2>Observed Indicators (IOCs)</h2>
          </div>

          <div className="table-search-group">
            <div className="search-wrap">
              <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search IOC value or type…"
                className="table-search-input"
              />
              {search && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearch('')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Type Filter Chips */}
        <div className="indicator-filter-row">
          <span className="filter-group-label">Filter type:</span>
          {availableTypes.map((type) => (
            <button
              key={type}
              type="button"
              className={`filter-chip ${typeFilter === type ? 'active' : ''}`}
              onClick={() => setTypeFilter(type)}
            >
              {type.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Table Content */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Indicator Value (Inert)</th>
                <th>Type</th>
                <th>Risk</th>
                <th>First Seen</th>
                <th>Last Seen</th>
                <th>Sources</th>
                <th>Campaigns</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filteredIndicators.map((indicator) => {
                const isSelected = selectedIndicator?.id === indicator.id
                return (
                  <tr
                    key={indicator.id}
                    className={isSelected ? 'selected-row' : ''}
                    onClick={() => setSelectedId(indicator.id)}
                  >
                    <td className="ioc-table-value">
                      <span className="inert-table-text" title={indicator.value}>
                        {indicator.value}
                      </span>
                    </td>
                    <td>
                      <span className="ioc-type-badge">{indicator.indicator_type}</span>
                    </td>
                    <td>
                      <span className={`severity-tag severity-${indicator.risk_severity || 'low'}`}>
                        {indicator.risk_score ?? 0}
                      </span>
                    </td>
                    <td>
                      {indicator.first_seen ? new Date(indicator.first_seen).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      {indicator.last_seen ? new Date(indicator.last_seen).toLocaleDateString() : '—'}
                    </td>
                    <td>{indicator.source_count ?? 0}</td>
                    <td>{indicator.campaign_count ?? 0}</td>
                    <td>
                      <button
                        type="button"
                        className="inline-copy-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCopy(indicator.id, indicator.value)
                        }}
                        title="Copy indicator value"
                      >
                        {copiedId === indicator.id ? (
                          <span style={{ color: '#4ade80', fontSize: '11px' }}>Copied</span>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}

              {filteredIndicators.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-table-cell">
                    No matching indicators found for current query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Indicator Inspection Drawer */}
      {selectedIndicator && (
        <aside className="panel detail-panel" aria-label="Selected indicator details">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Selected IOC inspection</p>
              <h2>Indicator #{selectedIndicator.id}</h2>
            </div>
            <span className={`severity-tag severity-${selectedIndicator.risk_severity || 'low'}`}>
              {selectedIndicator.risk_severity || 'low'}
            </span>
          </div>

          <div className="detail-field-group">
            <div className="field-label-row">
              <span className="field-label">IOC VALUE (INERT)</span>
              <button
                type="button"
                className="copy-btn"
                onClick={() => handleCopy(selectedIndicator.id, selectedIndicator.value, true)}
                title="Copy IOC value"
              >
                {copiedDetail ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span style={{ color: '#4ade80' }}>Copied</span>
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="inert-ioc-box" title="Inert non-clickable indicator text">
              {selectedIndicator.value}
            </div>
            <p className="inert-warning">
              ⚠️ Untrusted URLhaus entry. Automatic preview and navigation disabled.
            </p>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Indicator Type</dt>
              <dd className="capitalize">{selectedIndicator.indicator_type}</dd>
            </div>
            <div>
              <dt>Risk Score</dt>
              <dd>
                <strong>{selectedIndicator.risk_score ?? 0}</strong> / 100
              </dd>
            </div>
            <div>
              <dt>First Seen</dt>
              <dd>
                {selectedIndicator.first_seen
                  ? new Date(selectedIndicator.first_seen).toLocaleString()
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>Last Seen</dt>
              <dd>
                {selectedIndicator.last_seen
                  ? new Date(selectedIndicator.last_seen).toLocaleString()
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>Correlated Campaigns</dt>
              <dd>{selectedIndicator.campaign_count ?? 0} campaign cluster(s)</dd>
            </div>
            <div>
              <dt>Reporting Sources</dt>
              <dd>{selectedIndicator.source_count ?? 0} feed source(s)</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{selectedIndicator.description || 'Imported from URLhaus feed.'}</dd>
            </div>
          </dl>
        </aside>
      )}
    </div>
  )
}

export default IndicatorsPanel
