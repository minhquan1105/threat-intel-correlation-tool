const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function fetchJson(url, options = {}) {
  const response = await fetch(`${API_URL}${url}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Request failed with status ${response.status}`)
  }

  return response.status === 204 ? null : response.json()
}

export function getStats() {
  return fetchJson('/stats')
}

export function getIndicators(limit = 100) {
  return fetchJson(`/indicators?limit=${limit}`)
}

export function getCampaigns() {
  return fetchJson('/campaigns')
}

export function getGraph() {
  return fetchJson('/graph')
}

export function getIndicator(id) {
  return fetchJson(`/indicators/${id}`)
}
