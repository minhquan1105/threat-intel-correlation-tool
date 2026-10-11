import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import { getIndicator } from '../api'

function ThreatGraphPanel({ graph, loading: externalLoading = false, error: externalError = '', onRefresh }) {
  const cyRef = useRef(null)

  // Selection & Details State
  const [selectedNode, setSelectedNode] = useState(null)
  const [indicatorDetail, setIndicatorDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  // Tooltip State
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    type: '',
    value: '',
    degree: 0,
  })

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState({
    indicator: true,
    campaign: true,
    source: true,
  })
  const [showLabels, setShowLabels] = useState(false)
  const [layoutType, setLayoutType] = useState('concentric')
  const [copied, setCopied] = useState(false)

  // Calculate counts for legend & badges
  const counts = useMemo(() => {
    const rawNodes = graph?.nodes || []
    const indicators = rawNodes.filter((n) => n.type === 'indicator').length
    const campaigns = rawNodes.filter((n) => n.type === 'campaign').length
    const sources = rawNodes.filter((n) => n.type === 'source').length
    return {
      total: rawNodes.length,
      indicators,
      campaigns,
      sources,
      edges: graph?.edges?.length || 0,
    }
  }, [graph])

  // Filter and build elements for Cytoscape
  const elements = useMemo(() => {
    if (!graph?.nodes || graph.nodes.length === 0) return []

    const enabledTypes = new Set()
    if (typeFilter.indicator) enabledTypes.add('indicator')
    if (typeFilter.campaign) enabledTypes.add('campaign')
    if (typeFilter.source) enabledTypes.add('source')

    const validNodeIds = new Set()
    const nodeElements = []

    for (const node of graph.nodes) {
      if (!enabledTypes.has(node.type)) continue
      validNodeIds.add(node.id)

      let label = ''
      if (node.type === 'campaign' || node.type === 'source') {
        label = node.label.length > 22 ? `${node.label.slice(0, 22)}…` : node.label
      } else if (showLabels) {
        label = node.label.length > 25 ? `${node.label.slice(0, 25)}…` : node.label
      }

      nodeElements.push({
        data: {
          id: node.id,
          label,
          fullValue: node.label,
          type: node.type,
          rawId: node.id.replace(/^(indicator|campaign|source)-/, ''),
        },
      })
    }

    const edgeElements = []
    for (const edge of graph.edges || []) {
      if (validNodeIds.has(edge.source) && validNodeIds.has(edge.target)) {
        edgeElements.push({
          data: {
            id: `${edge.source}->${edge.target}:${edge.relationship}`,
            source: edge.source,
            target: edge.target,
            relationship: edge.relationship,
            label: edge.relationship,
          },
        })
      }
    }

    return [...nodeElements, ...edgeElements]
  }, [graph, typeFilter, showLabels])

  // Cytoscape Stylesheet
  const stylesheet = useMemo(() => [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'font-family': 'Inter, system-ui, sans-serif',
        'font-size': '11px',
        'font-weight': 600,
        color: '#e2e8f0',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-outline-color': '#090d16',
        'text-outline-width': 2,
        'text-outline-opacity': 0.85,
        'border-width': 2,
        'transition-property': 'background-color, border-color, border-width, opacity, width, height',
        'transition-duration': '0.15s',
        cursor: 'pointer',
      },
    },
    {
      selector: "node[type='indicator']",
      style: {
        shape: 'ellipse',
        width: 28,
        height: 28,
        'background-color': '#f43f5e',
        'border-color': '#fb7185',
        'text-valign': 'bottom',
        'text-margin-y': 6,
        'font-size': '10px',
      },
    },
    {
      selector: "node[type='campaign']",
      style: {
        shape: 'round-rectangle',
        width: 52,
        height: 34,
        'background-color': '#8b5cf6',
        'border-color': '#a78bfa',
        'border-radius': 8,
      },
    },
    {
      selector: "node[type='source']",
      style: {
        shape: 'diamond',
        width: 44,
        height: 44,
        'background-color': '#06b6d4',
        'border-color': '#67e8f9',
      },
    },
    {
      selector: 'node.hovered',
      style: {
        'border-width': 3,
        'border-color': '#ffffff',
        'underlay-color': '#38bdf8',
        'underlay-padding': 4,
        'underlay-opacity': 0.35,
      },
    },
    {
      selector: 'node.selected',
      style: {
        'border-width': 4,
        'border-color': '#38bdf8',
        'underlay-color': '#38bdf8',
        'underlay-padding': 8,
        'underlay-opacity': 0.45,
        'z-index': 999,
      },
    },
    {
      selector: 'node.highlighted',
      style: {
        'border-width': 3,
        'border-color': '#f8fafc',
        opacity: 1,
        'z-index': 990,
      },
    },
    {
      selector: 'node.dimmed',
      style: {
        opacity: 0.15,
      },
    },
    {
      selector: 'edge',
      style: {
        width: 1.5,
        'line-color': '#334155',
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#334155',
        'arrow-scale': 0.8,
        label: '',
        'font-family': 'Inter, system-ui, sans-serif',
        'font-size': '10px',
        color: '#94a3b8',
        'text-rotation': 'autorotate',
        'text-background-color': '#090d16',
        'text-background-opacity': 0.85,
        'text-background-padding': '2px',
        'transition-property': 'line-color, target-arrow-color, width, opacity',
        'transition-duration': '0.15s',
      },
    },
    {
      selector: 'edge.highlighted',
      style: {
        width: 2.5,
        'line-color': '#38bdf8',
        'target-arrow-color': '#38bdf8',
        label: 'data(relationship)',
        color: '#bae6fd',
        opacity: 1,
        'z-index': 980,
      },
    },
    {
      selector: 'edge.dimmed',
      style: {
        opacity: 0.08,
      },
    },
    {
      selector: 'node.search-match',
      style: {
        'underlay-color': '#facc15',
        'underlay-padding': 7,
        'underlay-opacity': 0.6,
        'border-color': '#fde047',
        'border-width': 3,
        'z-index': 1000,
      },
    },
    {
      selector: 'node.search-dimmed',
      style: {
        opacity: 0.15,
      },
    },
    {
      selector: 'edge.search-dimmed',
      style: {
        opacity: 0.05,
      },
    },
  ], [])

  // Cytoscape Layout
  const layout = useMemo(() => {
    if (layoutType === 'concentric') {
      return {
        name: 'concentric',
        animate: false,
        fit: true,
        padding: 40,
        startAngle: (3 / 2) * Math.PI,
        sweep: 2 * Math.PI,
        clockwise: true,
        equidistant: false,
        minNodeSpacing: 20,
        concentric: (node) => {
          const type = node.data('type')
          if (type === 'campaign') return 3
          if (type === 'source') return 2
          return 1
        },
        levelWidth: () => 1,
        spacingFactor: 1.15,
      }
    }
    if (layoutType === 'breadthfirst') {
      return {
        name: 'breadthfirst',
        animate: false,
        fit: true,
        padding: 40,
        directed: true,
        spacingFactor: 1.4,
      }
    }
    return {
      name: 'cose',
      animate: false,
      fit: true,
      padding: 50,
      randomize: false,
      componentSpacing: 100,
      nodeOverlap: 20,
      nodeRepulsion: () => 350000,
      idealEdgeLength: () => 140,
      edgeElasticity: () => 32,
      nestingFactor: 1.2,
      gravity: 1.2,
      numIter: 1000,
      initialTemp: 1000,
      coolingFactor: 0.99,
      minTemp: 1.0,
    }
  }, [layoutType])

  // Node Selection Handler
  const selectNode = useCallback((node) => {
    if (!node || !cyRef.current) return
    const cy = cyRef.current
    const type = node.data('type')
    const fullValue = node.data('fullValue') || node.data('label')
    const rawId = node.data('rawId')
    const degree = node.degree()

    // Extract neighbor info
    const neighborhood = node.neighborhood()
    const connectedNodes = neighborhood.nodes().map((n) => ({
      id: n.id(),
      type: n.data('type'),
      value: n.data('fullValue') || n.data('label'),
    }))

    setSelectedNode({
      id: node.id(),
      type,
      fullValue,
      rawId,
      degree,
      connectedNodes,
    })

    // Batch class updates for performance
    cy.batch(() => {
      cy.elements().removeClass('selected highlighted dimmed')
      node.addClass('selected')
      neighborhood.addClass('highlighted')
      cy.elements().not(node).not(neighborhood).addClass('dimmed')
    })

    // Fetch rich details if indicator
    if (type === 'indicator' && rawId) {
      setDetailLoading(true)
      setDetailError('')
      getIndicator(rawId)
        .then((data) => {
          setIndicatorDetail(data)
        })
        .catch((err) => {
          setDetailError(err.message || 'Failed to load details')
        })
        .finally(() => {
          setDetailLoading(false)
        })
    } else {
      setIndicatorDetail(null)
    }
  }, [])

  // Bind and cleanup Cytoscape event listeners
  const setupCytoscape = useCallback((cy) => {
    if (!cy) return
    cyRef.current = cy

    cy.off('.threatGraph')

    // Node Hover: Tooltip
    cy.on('mouseover.threatGraph', 'node', (event) => {
      const node = event.target
      node.addClass('hovered')
      const pos = node.renderedPosition()

      setTooltip({
        visible: true,
        x: pos.x,
        y: pos.y,
        type: node.data('type'),
        value: node.data('fullValue') || node.data('label'),
        degree: node.degree(),
      })
    })

    cy.on('mouseout.threatGraph', 'node', (event) => {
      const node = event.target
      node.removeClass('hovered')
      setTooltip((prev) => ({ ...prev, visible: false }))
    })

    // Node Click: Select & Highlight
    cy.on('tap', 'node', (event) => {

  selectNode(event.target)
})

    // Background Click: Deselect
    cy.on('tap.threatGraph', (event) => {
      if (event.target === cy) {
        setSelectedNode(null)
        setIndicatorDetail(null)
        setDetailError('')
        cy.batch(() => {
          cy.elements().removeClass('selected highlighted dimmed')
        })
      }
    })

    // Panning & Zooming: Hide floating tooltip
    cy.on('pan.threatGraph zoom.threatGraph', () => {
      setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev))
    })
  }, [selectNode])

  // Search filter logic
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    const query = searchQuery.trim().toLowerCase()
    cy.batch(() => {
      cy.elements().removeClass('search-match search-dimmed')
      if (!query) return

      const matches = cy.nodes().filter((n) => {
        const val = (n.data('fullValue') || n.data('label') || '').toLowerCase()
        return val.includes(query)
      })

      if (matches.length > 0) {
        matches.addClass('search-match')
        cy.nodes().not(matches).addClass('search-dimmed')
        cy.edges().addClass('search-dimmed')
      }
    })
  }, [searchQuery])

  // Count search matches
  const searchMatchCount = useMemo(() => {
    if (!searchQuery.trim() || !graph?.nodes) return null
    const query = searchQuery.trim().toLowerCase()
    return graph.nodes.filter((n) => (n.label || '').toLowerCase().includes(query)).length
  }, [graph, searchQuery])

  // Focus next / first search match
  const handleFocusSearchMatch = () => {
    const cy = cyRef.current
    if (!cy || !searchQuery.trim()) return

    const query = searchQuery.trim().toLowerCase()
    const matches = cy.nodes().filter((n) => {
      const val = (n.data('fullValue') || n.data('label') || '').toLowerCase()
      return val.includes(query)
    })

    if (matches.length > 0) {
      const first = matches[0]
      cy.animate({
        center: { eles: first },
        zoom: 1.4,
        duration: 350,
      })
      selectNode(first)
    }
  }

  // Clear selection handler
  const handleClearSelection = () => {
    const cy = cyRef.current
    setSelectedNode(null)
    setIndicatorDetail(null)
    setDetailError('')
    if (cy) {
      cy.batch(() => {
        cy.elements().removeClass('selected highlighted dimmed')
      })
    }
  }

  // Center selected node in view
  const handleCenterSelected = () => {
    const cy = cyRef.current
    if (!cy || !selectedNode) return
    const target = cy.$id(selectedNode.id)
    if (target.length > 0) {
      cy.animate({
        center: { eles: target },
        zoom: 1.5,
        duration: 350,
      })
    }
  }

  // Copy to clipboard helper
  const handleCopy = (text) => {
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
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Controls Handlers
  const handleZoomIn = () => {
    const cy = cyRef.current
    if (!cy) return
    cy.zoom({
      level: cy.zoom() * 1.3,
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
    })
  }

  const handleZoomOut = () => {
    const cy = cyRef.current
    if (!cy) return
    cy.zoom({
      level: cy.zoom() * 0.75,
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
    })
  }

  const handleFit = () => {
    const cy = cyRef.current
    if (!cy) return
    cy.fit(undefined, 35)
  }

  const handleReset = () => {
    const cy = cyRef.current
    if (!cy) return
    cy.reset()
    cy.fit(undefined, 35)
  }

  const handleToggleType = (type) => {
    setTypeFilter((prev) => ({
      ...prev,
      [type]: !prev[type],
    }))
  }

  // Handle dropdown node select
  const handleDropdownSelect = (e) => {
    const nodeId = e.target.value
    if (!nodeId || !cyRef.current) return
    const cy = cyRef.current
    const target = cy.$id(nodeId)
    if (target.length > 0) {
      cy.animate({
        center: { eles: target },
        zoom: 1.4,
        duration: 350,
      })
      selectNode(target)
    }
  }

  return (
    <div className="panel graph-panel-card">
      {/* Top Header & Telemetry Scope Notice */}
      <div className="graph-header-row">
        <div>
          <div className="header-badge-row">
            <span className="telemetry-badge">CORRELATION GRAPH</span>
            <span className="scope-badge">
              BOUNDED TELEMETRY: {counts.indicators} IOCs
            </span>
          </div>
          <h2>Threat Actor & Correlation Graph</h2>
          <p className="graph-subhead">
            Interactive relationship mapping between observed IOCs, coordinated campaigns, and intelligence feeds.
          </p>
        </div>

        <div className="header-action-group">
          {onRefresh && (
            <button
              type="button"
              className="action-btn secondary-btn"
              onClick={onRefresh}
              title="Refresh telemetry"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Safety & Performance Notice */}
      <div className="cyber-notice-bar">
        <div className="notice-icon">🛡️</div>
        <div className="notice-content">
          <strong>Bounded analyst view:</strong> Displaying {counts.indicators} most recent URLhaus indicators out of 28,000+ total records for sub-second correlation performance. Indicator URLs are untrusted and rendered as inert text.
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="graph-toolbar">
        {/* Search */}
        <div className="search-wrap">
          <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="graph-search-input"
            placeholder="Search loaded indicators, campaigns, sources…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFocusSearchMatch()}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
          {searchMatchCount !== null && (
            <span
              className={`match-pill ${searchMatchCount > 0 ? 'has-matches' : 'no-matches'}`}
              onClick={handleFocusSearchMatch}
              title="Click to jump to match"
            >
              {searchMatchCount} match{searchMatchCount === 1 ? '' : 'es'}
            </span>
          )}
        </div>

        {/* Quick Node Selector Dropdown */}
        <div className="node-quick-select-wrap">
          <select
            className="node-dropdown"
            value={selectedNode?.id || ''}
            onChange={handleDropdownSelect}
            aria-label="Quick select node"
          >
            <option value="">Quick inspect node…</option>
            <optgroup label="Campaigns & Sources">
              {(graph?.nodes || [])
                .filter((n) => n.type === 'campaign' || n.type === 'source')
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    [{n.type.toUpperCase()}] {n.label}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Latest Indicators">
              {(graph?.nodes || [])
                .filter((n) => n.type === 'indicator')
                .slice(0, 30)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    [IOC] {n.label.length > 40 ? `${n.label.slice(0, 40)}…` : n.label}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>

        {/* Node Type Filters */}
        <div className="filter-chip-group">
          <span className="filter-group-label">Show:</span>
          <button
            type="button"
            className={`filter-chip chip-indicator ${typeFilter.indicator ? 'active' : ''}`}
            onClick={() => handleToggleType('indicator')}
          >
            <span className="chip-dot dot-indicator" />
            Indicators ({counts.indicators})
          </button>
          <button
            type="button"
            className={`filter-chip chip-campaign ${typeFilter.campaign ? 'active' : ''}`}
            onClick={() => handleToggleType('campaign')}
          >
            <span className="chip-dot dot-campaign" />
            Campaigns ({counts.campaigns})
          </button>
          <button
            type="button"
            className={`filter-chip chip-source ${typeFilter.source ? 'active' : ''}`}
            onClick={() => handleToggleType('source')}
          >
            <span className="chip-dot dot-source" />
            Sources ({counts.sources})
          </button>
        </div>

        {/* Layout & Display Toggles */}
        <div className="view-toggle-group">
          <button
            type="button"
            className={`toggle-btn ${showLabels ? 'active' : ''}`}
            onClick={() => setShowLabels(!showLabels)}
            title="Toggle IOC labels on graph"
          >
            {showLabels ? 'Hide Labels' : 'Show Labels'}
          </button>

          <select
            className="layout-select"
            value={layoutType}
            onChange={(e) => setLayoutType(e.target.value)}
            aria-label="Select layout algorithm"
          >
            <option value="concentric">Concentric Hub</option>
            <option value="cose">Force-Directed (CoSE)</option>
            <option value="breadthfirst">Hierarchical Tree</option>
          </select>
        </div>
      </div>

      {/* Main Workspace Area: Graph Canvas + Details Panel */}
      <div className="graph-workspace">
        <div className="graph-canvas-container">
          {/* Zoom / View Control Bar */}
          <div className="graph-viewport-controls" aria-label="Graph viewport controls">
            <button type="button" onClick={handleZoomIn} title="Zoom in (+)">+</button>
            <button type="button" onClick={handleZoomOut} title="Zoom out (−)">−</button>
            <button type="button" onClick={handleFit} title="Fit graph to view">Fit</button>
            <button type="button" onClick={handleReset} title="Reset zoom and center">↺</button>
          </div>

          {/* Cytoscape Canvas */}
          {elements.length > 0 && !externalLoading && (
            <CytoscapeComponent
              elements={elements}
              style={{ width: '100%', height: '100%', background: '#0a0f1d' }}
              stylesheet={stylesheet}
              layout={layout}
              cy={setupCytoscape}
              wheelSensitivity={0.25}
              minZoom={0.15}
              maxZoom={3.5}
            />
          )}

          {/* Loading Skeleton State */}
          {externalLoading && (
            <div className="graph-status-overlay">
              <div className="radar-spinner" />
              <h3>Initializing Threat Graph Telemetry</h3>
              <p>Correlating indicators with campaigns and intelligence sources…</p>
            </div>
          )}

          {/* Error State */}
          {externalError && !externalLoading && (
            <div className="graph-status-overlay error-overlay">
              <div className="overlay-icon">⚠️</div>
              <h3>Failed to Load Graph Telemetry</h3>
              <p className="error-text">{externalError}</p>
              {onRefresh && (
                <button type="button" className="action-btn primary-btn" onClick={onRefresh}>
                  Retry Telemetry Fetch
                </button>
              )}
            </div>
          )}

          {/* Empty State */}
          {!externalLoading && !externalError && elements.length === 0 && (
            <div className="graph-status-overlay">
              <div className="overlay-icon">🔍</div>
              <h3>No Threat Nodes Available</h3>
              <p>All node types are currently disabled in the filter, or no relationships were returned.</p>
              <button
                type="button"
                className="action-btn secondary-btn"
                onClick={() => setTypeFilter({ indicator: true, campaign: true, source: true })}
              >
                Reset Node Filters
              </button>
            </div>
          )}

          {/* Hover Tooltip */}
          {tooltip.visible && !selectedNode && (
            <div
              className="graph-floating-tooltip"
              style={{
                left: `${tooltip.x}px`,
                top: `${tooltip.y}px`,
              }}
            >
              <div className="tooltip-header">
                <span className={`node-badge badge-${tooltip.type}`}>
                  {tooltip.type.toUpperCase()}
                </span>
                <span className="tooltip-degree">{tooltip.degree} link{tooltip.degree === 1 ? '' : 's'}</span>
              </div>
              <div className="tooltip-body">
                <span className="tooltip-inert-val">{tooltip.value}</span>
              </div>
              <div className="tooltip-footer">Click node to inspect investigation details</div>
            </div>
          )}

          {/* Graph Legend Overlay */}
          <div className="graph-legend-card">
            <span className="legend-title">LEGEND</span>
            <div className="legend-item">
              <span className="legend-mark mark-indicator" />
              <span>Indicator ({counts.indicators})</span>
            </div>
            <div className="legend-item">
              <span className="legend-mark mark-campaign" />
              <span>Campaign ({counts.campaigns})</span>
            </div>
            <div className="legend-item">
              <span className="legend-mark mark-source" />
              <span>Source ({counts.sources})</span>
            </div>
            <div className="legend-item">
              <span className="legend-mark mark-edge" />
              <span>Relationship</span>
            </div>
          </div>
        </div>

        {/* Selected Node Investigation Side Panel */}
        {selectedNode && (
          <aside className="graph-side-panel" aria-label="Node investigation panel">
            <div className="side-panel-header">
              <div className="side-panel-title-row">
                <span className={`node-badge badge-${selectedNode.type}`}>
                  {selectedNode.type.toUpperCase()}
                </span>
                <span className="panel-node-id">{selectedNode.id}</span>
              </div>
              <button
                type="button"
                className="panel-close-btn"
                onClick={handleClearSelection}
                title="Close investigation panel"
              >
                ✕
              </button>
            </div>

            <div className="side-panel-body">
              {/* Value / IOC Text Box */}
              <div className="detail-field-group">
                <div className="field-label-row">
                  <span className="field-label">
                    {selectedNode.type === 'indicator' ? 'IOC VALUE (INERT TEXT)' : 'ENTITY NAME'}
                  </span>
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() => handleCopy(selectedNode.fullValue)}
                    title="Copy to clipboard"
                  >
                    {copied ? (
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
                  {selectedNode.fullValue}
                </div>
                {selectedNode.type === 'indicator' && (
                  <p className="inert-warning">
                    ⚠️ Malicious feed entry. Links disabled for analyst safety.
                  </p>
                )}
              </div>

              {/* Core Node Metrics */}
              <div className="metrics-grid">
                <div className="metric-box">
                  <span className="metric-label">Graph Links</span>
                  <span className="metric-val">{selectedNode.degree}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Node Type</span>
                  <span className="metric-val capitalize">{selectedNode.type}</span>
                </div>
              </div>

              {/* Indicator Detail Section */}
              {selectedNode.type === 'indicator' && (
                <>
                  {detailLoading && (
                    <div className="detail-status-box">
                      <span className="pulse-dot" />
                      Loading backend IOC metadata…
                    </div>
                  )}

                  {detailError && (
                    <div className="detail-status-box error">
                      Notice: {detailError}
                    </div>
                  )}

                  {indicatorDetail && (
                    <div className="metadata-stack">
                      <div className="metadata-row">
                        <span className="meta-label">Indicator Type</span>
                        <span className="meta-val">{indicatorDetail.indicator_type || 'url'}</span>
                      </div>

                      <div className="metadata-row">
                        <span className="meta-label">Risk Severity</span>
                        <span className={`severity-tag severity-${indicatorDetail.risk_severity || 'low'}`}>
                          {indicatorDetail.risk_severity || 'low'}
                        </span>
                      </div>

                      <div className="metadata-row">
                        <span className="meta-label">Risk Score</span>
                        <span className="meta-val font-bold">
                          {indicatorDetail.risk_score ?? '0'} / 100
                        </span>
                      </div>

                      {indicatorDetail.first_seen && (
                        <div className="metadata-row">
                          <span className="meta-label">First Observed</span>
                          <span className="meta-val">
                            {new Date(indicatorDetail.first_seen).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {indicatorDetail.last_seen && (
                        <div className="metadata-row">
                          <span className="meta-label">Last Observed</span>
                          <span className="meta-val">
                            {new Date(indicatorDetail.last_seen).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {indicatorDetail.description && (
                        <div className="metadata-desc-box">
                          <span className="meta-label">Description</span>
                          <p>{indicatorDetail.description}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Connected Neighbors List */}
              <div className="connected-entities-section">
                <span className="field-label">
                  CONNECTED GRAPH ENTITIES ({selectedNode.connectedNodes?.length || 0})
                </span>
                <div className="connected-list">
                  {(selectedNode.connectedNodes || []).map((neighbor) => (
                    <div key={neighbor.id} className="connected-item">
                      <span className={`node-badge badge-${neighbor.type}`}>
                        {neighbor.type}
                      </span>
                      <span className="connected-value" title={neighbor.value}>
                        {neighbor.value}
                      </span>
                    </div>
                  ))}
                  {(!selectedNode.connectedNodes || selectedNode.connectedNodes.length === 0) && (
                    <div className="empty-subtext">No connected nodes in current bounded graph.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Side Panel Footer Actions */}
            <div className="side-panel-footer">
              <button
                type="button"
                className="action-btn secondary-btn"
                onClick={handleCenterSelected}
              >
                Center Node
              </button>
              <button
                type="button"
                className="action-btn outline-btn"
                onClick={handleClearSelection}
              >
                Clear Focus
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

export default ThreatGraphPanel
