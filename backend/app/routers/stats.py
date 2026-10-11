from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="", tags=["stats"])


@router.get("/stats", response_model=schemas.StatsResponse)
def get_statistics(db: Session = Depends(get_db)):
    total_indicators = db.query(models.Indicator).count()
    total_campaigns = db.query(models.Campaign).count()
    total_sources = db.query(models.Source).count()

    high_critical_risk_count = (
        db.query(models.RiskScore.indicator_id)
        .filter(models.RiskScore.score >= 50)
        .distinct()
        .count()
    )

    recent_cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    recently_observed_count = db.query(models.Indicator).filter(models.Indicator.last_seen >= recent_cutoff).count()

    type_distribution = {
        entry[0]: entry[1]
        for entry in db.query(models.Indicator.indicator_type, func.count(models.Indicator.id))
        .group_by(models.Indicator.indicator_type)
        .all()
    }

    return schemas.StatsResponse(
        total_indicators=total_indicators,
        total_campaigns=total_campaigns,
        total_sources=total_sources,
        high_critical_risk_count=high_critical_risk_count,
        recently_observed_count=recently_observed_count,
        indicator_type_distribution=type_distribution,
    )
