import { useEffect, useState } from 'react'
import { getCampaigns, getGraph, getIndicators, getStats } from './api'
import DashboardPanel from './components/DashboardPanel'
import IndicatorsPanel from './components/IndicatorsPanel'
import ThreatGraphPanel from './components/ThreatGraphPanel'
import './App.css'

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'graph', label: 'Threat Graph', icon: 'graph' },
  { id: 'indicators', label: 'Indicators', icon: 'table' },
]

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [stats, setStats] = useState(null)
  const [indicators, setIndicators] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [graph, setGraph] = useState({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = async () => {
    const [statsResponse, indicatorsResponse, campaignsResponse, graphResponse] = await Promise.all([
      getStats(),
      getIndicators(100),
      getCampaigns(),
      getGraph(),
    ])
    return { statsResponse, indicatorsResponse, campaignsResponse, graphResponse }
  }

  const handleRefresh = async () => {
    try {
      setLoading(true)
      const { statsResponse, indicatorsResponse, campaignsResponse, graphResponse } = await fetchData()
      setStats(statsResponse)
      setIndicators(indicatorsResponse)
      setCampaigns(campaignsResponse)
      setGraph(graphResponse)
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    async function loadInitial() {
      try {
        const [statsResponse, indicatorsResponse, campaignsResponse, graphResponse] = await Promise.all([
          getStats(),
          getIndicators(100),
          getCampaigns(),
          getGraph(),
        ])
        if (!ignore) {
          setStats(statsResponse)
          setIndicators(indicatorsResponse)
          setCampaigns(campaignsResponse)
          setGraph(graphResponse)
          setError('')
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message)
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadInitial()
    return () => {
      ignore = true
    }
  }, [])

  const totalIndicators = stats?.total_indicators ?? 0
  const graphNodeCount = graph?.nodes?.length ?? 0

  return (
    <div className="app-shell">
      {/* Platform Topbar */}
      <header className="topbar">
        <div className="brand-section">
          <div className="brand-badge-row">
            <span className="live-status-pill">
              <span className="status-indicator-dot" />
              TELEMETRY LIVE
            </span>
            <span className="version-pill">v1.2.0 • SOC PORTFOLIO</span>
          </div>
          <h1>Threat Intelligence Correlation</h1>
          <p className="brand-subtitle">
            Automated URLhaus ingestion, deduplication, multi-source correlation, and relationship graph
          </p>
        </div>

        <div className="header-controls">
          <nav className="tab-nav" aria-label="Main navigation">
            {tabs.map((tab) => {
              let badge = null
              if (tab.id === 'graph') {
                badge = `${graphNodeCount} nodes`
              } else if (tab.id === 'indicators') {
                badge = totalIndicators ? `${totalIndicators.toLocaleString()}` : null
              }

              return (
                <button
                  key={tab.id}
                  type="button"
                  className={activeTab === tab.id ? 'nav-button active' : 'nav-button'}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="nav-label-group">
                    {tab.icon === 'dashboard' && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                      </svg>
                    )}
                    {tab.icon === 'graph' && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                    )}
                    {tab.icon === 'table' && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" />
                        <line x1="3" y1="12" x2="3.01" y2="12" />
                        <line x1="3" y1="18" x2="3.01" y2="18" />
                      </svg>
                    )}
                    <span>{tab.label}</span>
                  </span>
                  {badge && <span className="tab-badge">{badge}</span>}
                </button>
              )
            })}
          </nav>

          <button
            type="button"
            className="refresh-btn"
            onClick={handleRefresh}
            title="Reload telemetry data"
            disabled={loading}
          >
            <svg
              className={loading ? 'spinning' : ''}
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>
        </div>
      </header>

      {/* Loading Skeleton */}
      {loading && !stats && (
        <div className="status-box loading-box">
          <div className="radar-spinner mini-spinner" />
          <span>Synchronizing telemetry with FastAPI backend & PostgreSQL (28,000+ indicators)…</span>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="status-box error">
          <div className="error-icon">⚠️</div>
          <div>
            <strong>Unable to reach backend API:</strong> {error}
            <div style={{ marginTop: '4px', fontSize: '12px' }}>
              Verify FastAPI server is active on port 8000 and PostgreSQL is running.
            </div>
          </div>
          <button type="button" className="retry-btn" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      )}

      {/* Panels */}
      {activeTab === 'dashboard' && (
        <DashboardPanel
          stats={stats}
          indicators={indicators}
          campaigns={campaigns}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'indicators' && (
        <IndicatorsPanel indicators={indicators} />
      )}

      {activeTab === 'graph' && (
        <ThreatGraphPanel
          graph={graph}
          stats={stats}
          loading={loading}
          error={error}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  )
}

export default App
