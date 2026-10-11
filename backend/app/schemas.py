from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class IndicatorCreate(BaseModel):
    value: str
    indicator_type: str
    description: str | None = None
    first_seen: datetime | None = None
    last_seen: datetime | None = None


class IndicatorResponse(IndicatorCreate):
    id: int
    created_at: datetime
    source_count: int = 0
    campaign_count: int = 0
    risk_score: int | None = None
    risk_severity: str | None = None

    model_config = ConfigDict(from_attributes=True)


class IndicatorSourceResponse(BaseModel):
    id: int
    indicator_id: int
    source_id: int
    source_name: str | None = None
    external_reference: str | None = None
    first_seen: datetime | None = None
    last_seen: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CampaignCreate(BaseModel):
    name: str
    description: str | None = None


class CampaignResponse(CampaignCreate):
    id: int
    created_at: datetime
    indicator_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class CampaignIndicatorLinkResponse(BaseModel):
    campaign_id: int
    indicator_id: int


class SourceCreate(BaseModel):
    name: str
    url: str | None = None


class SourceResponse(SourceCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RiskScoreResponse(BaseModel):
    id: int
    indicator_id: int
    score: int
    severity: str
    explanation: str
    calculated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IndicatorDetailResponse(IndicatorResponse):
    campaigns: list[CampaignResponse] = []
    sources: list[IndicatorSourceResponse] = []
    risk: RiskScoreResponse | None = None


class StatsResponse(BaseModel):
    total_indicators: int
    total_campaigns: int
    total_sources: int
    high_critical_risk_count: int
    recently_observed_count: int
    indicator_type_distribution: dict[str, int]


class GraphNode(BaseModel):
    id: str
    label: str
    type: str


class GraphEdge(BaseModel):
    source: str
    target: str
    relationship: str


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class IngestionStatsResponse(BaseModel):
    records_processed: int = 0
    indicators_created: int = 0
    indicators_updated: int = 0
    duplicates: int = 0
    failures: int = 0


class CorrelationResponse(BaseModel):
    indicator_id: int
    shared_campaigns: list[str] = Field(default_factory=list)
    shared_sources: list[str] = Field(default_factory=list)
    related_indicators: list[int] = Field(default_factory=list)
