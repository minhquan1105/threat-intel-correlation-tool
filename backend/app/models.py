from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

indicator_campaign = Table(
    "indicator_campaign",
    Base.metadata,
    Column("indicator_id", ForeignKey("indicators.id"), primary_key=True),
    Column("campaign_id", ForeignKey("campaigns.id"), primary_key=True),
    UniqueConstraint("indicator_id", "campaign_id", name="uq_indicator_campaign"),
)


class Indicator(Base):
    __tablename__ = "indicators"

    id = Column(Integer, primary_key=True, index=True)
    value = Column(String, unique=True, nullable=False, index=True)
    indicator_type = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    first_seen = Column(DateTime, nullable=True, index=True)
    last_seen = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    campaigns = relationship(
        "Campaign",
        secondary=indicator_campaign,
        back_populates="indicators",
        cascade="save-update, merge",
    )
    sources = relationship(
        "IndicatorSource",
        back_populates="indicator",
        cascade="all, delete-orphan",
    )
    risk_scores = relationship(
        "RiskScore",
        back_populates="indicator",
        cascade="all, delete-orphan",
    )


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    indicators = relationship(
        "Indicator",
        secondary=indicator_campaign,
        back_populates="campaigns",
        cascade="save-update, merge",
    )


class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    url = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    indicator_links = relationship(
        "IndicatorSource",
        back_populates="source",
        cascade="all, delete-orphan",
    )


class IndicatorSource(Base):
    __tablename__ = "indicator_sources"

    id = Column(Integer, primary_key=True, index=True)
    indicator_id = Column(Integer, ForeignKey("indicators.id"), nullable=False, index=True)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=False, index=True)
    external_reference = Column(String, nullable=True)
    first_seen = Column(DateTime, nullable=True, index=True)
    last_seen = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("indicator_id", "source_id", name="uq_indicator_source"),
    )

    indicator = relationship("Indicator", back_populates="sources")
    source = relationship("Source", back_populates="indicator_links")


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id = Column(Integer, primary_key=True, index=True)
    indicator_id = Column(Integer, ForeignKey("indicators.id"), nullable=False, index=True)
    score = Column(Integer, nullable=False, index=True)
    severity = Column(String, nullable=False, index=True)
    explanation = Column(Text, nullable=False)
    calculated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint("indicator_id", "calculated_at", name="uq_indicator_risk_score"),
    )

    indicator = relationship("Indicator", back_populates="risk_scores")
