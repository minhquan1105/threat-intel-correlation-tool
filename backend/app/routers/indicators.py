from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services.correlation import build_indicator_correlations
from app.services.normalization import normalize_indicator_value
from app.services.risk_scoring import build_indicator_risk

router = APIRouter(prefix="", tags=["indicators"])


def serialize_indicator_response(db: Session, indicator: models.Indicator) -> schemas.IndicatorResponse:
    latest_risk = (
        db.query(models.RiskScore)
        .filter(models.RiskScore.indicator_id == indicator.id)
        .order_by(models.RiskScore.calculated_at.desc())
        .first()
    )

    return schemas.IndicatorResponse(
        id=indicator.id,
        value=indicator.value,
        indicator_type=indicator.indicator_type,
        description=indicator.description,
        first_seen=indicator.first_seen,
        last_seen=indicator.last_seen,
        created_at=indicator.created_at,
        source_count=len(indicator.sources),
        campaign_count=len(indicator.campaigns),
        risk_score=latest_risk.score if latest_risk else None,
        risk_severity=latest_risk.severity if latest_risk else None,
    )


@router.get("/indicators", response_model=list[schemas.IndicatorResponse])
def get_indicators(limit: int = 100, db: Session = Depends(get_db)):
    indicators = (
        db.query(models.Indicator)
        .order_by(models.Indicator.id.desc())
        .limit(limit)
        .all()
    )
    return [serialize_indicator_response(db, indicator) for indicator in indicators]


@router.get("/indicators/{indicator_id}", response_model=schemas.IndicatorDetailResponse)
def get_indicator(indicator_id: int, db: Session = Depends(get_db)):
    indicator = db.query(models.Indicator).filter(models.Indicator.id == indicator_id).first()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicator not found")

    latest_risk = (
        db.query(models.RiskScore)
        .filter(models.RiskScore.indicator_id == indicator.id)
        .order_by(models.RiskScore.calculated_at.desc())
        .first()
    )

    return schemas.IndicatorDetailResponse(
        id=indicator.id,
        value=indicator.value,
        indicator_type=indicator.indicator_type,
        description=indicator.description,
        first_seen=indicator.first_seen,
        last_seen=indicator.last_seen,
        created_at=indicator.created_at,
        source_count=len(indicator.sources),
        campaign_count=len(indicator.campaigns),
        risk_score=latest_risk.score if latest_risk else None,
        risk_severity=latest_risk.severity if latest_risk else None,
        campaigns=[schemas.CampaignResponse(
            id=campaign.id,
            name=campaign.name,
            description=campaign.description,
            created_at=campaign.created_at,
            indicator_count=len(campaign.indicators),
        ) for campaign in indicator.campaigns],
        sources=[schemas.IndicatorSourceResponse(
            id=source_link.id,
            indicator_id=source_link.indicator_id,
            source_id=source_link.source_id,
            source_name=source_link.source.name,
            external_reference=source_link.external_reference,
            first_seen=source_link.first_seen,
            last_seen=source_link.last_seen,
            created_at=source_link.created_at,
        ) for source_link in indicator.sources],
        risk=schemas.RiskScoreResponse(
            id=latest_risk.id,
            indicator_id=latest_risk.indicator_id,
            score=latest_risk.score,
            severity=latest_risk.severity,
            explanation=latest_risk.explanation,
            calculated_at=latest_risk.calculated_at,
        ) if latest_risk else None,
    )


@router.post("/indicators", response_model=schemas.IndicatorResponse)
def create_indicator(indicator: schemas.IndicatorCreate, db: Session = Depends(get_db)):
    normalized_value = normalize_indicator_value(indicator.value, indicator.indicator_type)
    existing_indicator = (
        db.query(models.Indicator)
        .filter(func.lower(models.Indicator.value) == normalized_value.lower())
        .first()
    )

    if existing_indicator:
        raise HTTPException(status_code=409, detail="Indicator already exists")

    db_indicator = models.Indicator(
        value=normalized_value,
        indicator_type=indicator.indicator_type.lower(),
        description=indicator.description,
        first_seen=indicator.first_seen or datetime.now(timezone.utc),
        last_seen=indicator.last_seen or indicator.first_seen or datetime.now(timezone.utc),
    )

    db.add(db_indicator)
    db.commit()
    db.refresh(db_indicator)

    return serialize_indicator_response(db, db_indicator)


@router.get("/indicators/{indicator_id}/risk", response_model=schemas.RiskScoreResponse)
def get_indicator_risk(indicator_id: int, db: Session = Depends(get_db)):
    indicator = db.query(models.Indicator).filter(models.Indicator.id == indicator_id).first()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicator not found")

    risk_score = (
        db.query(models.RiskScore)
        .filter(models.RiskScore.indicator_id == indicator_id)
        .order_by(models.RiskScore.calculated_at.desc())
        .first()
    )

    if not risk_score:
        raise HTTPException(status_code=404, detail="No risk score available for this indicator")

    return schemas.RiskScoreResponse(
        id=risk_score.id,
        indicator_id=risk_score.indicator_id,
        score=risk_score.score,
        severity=risk_score.severity,
        explanation=risk_score.explanation,
        calculated_at=risk_score.calculated_at,
    )


@router.get("/indicators/{indicator_id}/correlations", response_model=schemas.CorrelationResponse)
def get_indicator_correlations(indicator_id: int, db: Session = Depends(get_db)):
    indicator = db.query(models.Indicator).filter(models.Indicator.id == indicator_id).first()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicator not found")

    correlations = build_indicator_correlations(db, indicator_id)
    return schemas.CorrelationResponse(**correlations)


@router.get("/risk-scores", response_model=list[schemas.RiskScoreResponse])
def get_risk_scores(db: Session = Depends(get_db)):
    risk_scores = db.query(models.RiskScore).order_by(models.RiskScore.calculated_at.desc()).all()
    return [
        schemas.RiskScoreResponse(
            id=score.id,
            indicator_id=score.indicator_id,
            score=score.score,
            severity=score.severity,
            explanation=score.explanation,
            calculated_at=score.calculated_at,
        )
        for score in risk_scores
    ]


def update_indicator_risk(db: Session, indicator: models.Indicator):
    source_count = len(indicator.sources)
    campaign_count = len(indicator.campaigns)
    recent_observations = max(0, source_count + campaign_count)

    first_seen = indicator.first_seen or datetime.now(timezone.utc) - timedelta(days=30)
    if indicator.last_seen:
        recent_window = datetime.now(timezone.utc) - indicator.last_seen
        days_since_first_seen = max(0, (datetime.now(timezone.utc) - first_seen).days)
    else:
        days_since_first_seen = max(0, (datetime.now(timezone.utc) - first_seen).days)

    repeated_observation_count = min(10, source_count + campaign_count)
    risk = build_indicator_risk(
        source_count=source_count,
        campaign_count=campaign_count,
        recent_observations=recent_observations,
        days_since_first_seen=days_since_first_seen,
        repeated_observation_count=repeated_observation_count,
    )

    latest_risk = (
        db.query(models.RiskScore)
        .filter(models.RiskScore.indicator_id == indicator.id)
        .order_by(models.RiskScore.calculated_at.desc())
        .first()
    )

    if latest_risk and latest_risk.score == risk["score"] and latest_risk.severity == risk["severity"]:
        return latest_risk

    risk_entry = models.RiskScore(
        indicator_id=indicator.id,
        score=risk["score"],
        severity=risk["severity"],
        explanation=risk["explanation"],
    )

    db.add(risk_entry)
    db.commit()
    db.refresh(risk_entry)
    return risk_entry
