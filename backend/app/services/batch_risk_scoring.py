
from collections import Counter
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.services.risk_scoring import (
    build_indicator_risk,
)


def preview_batch_risk_scores(
    db: Session,
    batch_size: int = 500,
) -> dict:
    """
    Preview risk scores for existing indicators.

    Read-only: does not save scores or modify indicators.
    """
    if batch_size < 1:
        raise ValueError("batch_size must be positive")

    now = datetime.now(timezone.utc)
    distribution = Counter()
    processed = 0
    last_id = 0

    while True:
        indicators = (
            db.query(
                models.Indicator.id,
                models.Indicator.first_seen,
            )
            .filter(models.Indicator.id > last_id)
            .order_by(models.Indicator.id)
            .limit(batch_size)
            .all()
        )

        if not indicators:
            break

        indicator_ids = [row.id for row in indicators]

        source_counts = dict(
            db.query(
                models.IndicatorSource.indicator_id,
                func.count(models.IndicatorSource.id),
            )
            .filter(
                models.IndicatorSource.indicator_id.in_(
                    indicator_ids
                )
            )
            .group_by(models.IndicatorSource.indicator_id)
            .all()
        )

        # Exclude generic feed labels from campaign evidence.
        campaign_counts = dict(
            db.query(
                models.indicator_campaign.c.indicator_id,
                func.count(
                    models.indicator_campaign.c.campaign_id
                ),
            )
            .join(
                models.Campaign,
                models.Campaign.id
                == models.indicator_campaign.c.campaign_id,
            )
            .filter(
                models.indicator_campaign.c.indicator_id.in_(
                    indicator_ids
                ),
                models.Campaign.name != "urlhaus-feed",
            )
            .group_by(
                models.indicator_campaign.c.indicator_id
            )
            .all()
        )

        for indicator in indicators:
            first_seen = indicator.first_seen

            if first_seen is None:
                days_since_first_seen = 365
            else:
                # PostgreSQL may return naive datetimes.
                if first_seen.tzinfo is None:
                    first_seen = first_seen.replace(
                        tzinfo=timezone.utc
                    )

                days_since_first_seen = max(
                    0,
                    (now - first_seen).days,
                )

            risk = build_indicator_risk(
                source_count=source_counts.get(
                    indicator.id, 0
                ),
                campaign_count=campaign_counts.get(
                    indicator.id, 0
                ),
                # Observation history is not tracked yet.
                recent_observations=0,
                repeated_observation_count=0,
                days_since_first_seen=days_since_first_seen,
            )

            distribution[risk["severity"]] += 1
            processed += 1

        last_id = indicators[-1].id

    return {
        "mode": "dry_run",
        "processed": processed,
        "distribution": {
            severity: distribution[severity]
            for severity in (
                "low",
                "medium",
                "high",
                "critical",
            )
        },
        "database_modified": False,
    }

def apply_batch_risk_scores(
    db: Session,
    batch_size: int = 500,
) -> dict:
    """
    Calculate and persist risk scores in batches.

    Preserves indicators and avoids creating duplicate
    score records when the calculated result is unchanged.
    """
    if batch_size < 1:
        raise ValueError("batch_size must be positive")

    now = datetime.now(timezone.utc)
    processed = 0
    created = 0
    unchanged = 0
    last_id = 0
    distribution = Counter()

    while True:
        indicators = (
            db.query(
                models.Indicator.id,
                models.Indicator.first_seen,
            )
            .filter(models.Indicator.id > last_id)
            .order_by(models.Indicator.id)
            .limit(batch_size)
            .all()
        )

        if not indicators:
            break

        indicator_ids = [row.id for row in indicators]

        source_counts = dict(
            db.query(
                models.IndicatorSource.indicator_id,
                func.count(models.IndicatorSource.id),
            )
            .filter(
                models.IndicatorSource.indicator_id.in_(
                    indicator_ids
                )
            )
            .group_by(models.IndicatorSource.indicator_id)
            .all()
        )

        campaign_counts = dict(
            db.query(
                models.indicator_campaign.c.indicator_id,
                func.count(
                    models.indicator_campaign.c.campaign_id
                ),
            )
            .join(
                models.Campaign,
                models.Campaign.id
                == models.indicator_campaign.c.campaign_id,
            )
            .filter(
                models.indicator_campaign.c.indicator_id.in_(
                    indicator_ids
                ),
                models.Campaign.name != "urlhaus-feed",
            )
            .group_by(
                models.indicator_campaign.c.indicator_id
            )
            .all()
        )

        latest_scores = {}

        existing_scores = (
            db.query(models.RiskScore)
            .filter(
                models.RiskScore.indicator_id.in_(
                    indicator_ids
                )
            )
            .order_by(
                models.RiskScore.calculated_at.desc(),
                models.RiskScore.id.desc(),
            )
            .all()
        )

        for existing in existing_scores:
            latest_scores.setdefault(
                existing.indicator_id, existing
            )

        pending_scores = []

        for indicator in indicators:
            first_seen = indicator.first_seen

            if first_seen is None:
                days_since_first_seen = 365
            else:
                if first_seen.tzinfo is None:
                    first_seen = first_seen.replace(
                        tzinfo=timezone.utc
                    )

                days_since_first_seen = max(
                    0, (now - first_seen).days
                )

            risk = build_indicator_risk(
                source_count=source_counts.get(
                    indicator.id, 0
                ),
                campaign_count=campaign_counts.get(
                    indicator.id, 0
                ),
                recent_observations=0,
                repeated_observation_count=0,
                days_since_first_seen=days_since_first_seen,
            )

            distribution[risk["severity"]] += 1
            processed += 1

            latest = latest_scores.get(indicator.id)

            if (
                latest is not None
                and latest.score == risk["score"]
                and latest.severity == risk["severity"]
                and latest.explanation == risk["explanation"]
            ):
                unchanged += 1
                continue

            pending_scores.append(
                models.RiskScore(
                    indicator_id=indicator.id,
                    score=risk["score"],
                    severity=risk["severity"],
                    explanation=risk["explanation"],
                    calculated_at=now,
                )
            )

        if pending_scores:
            db.add_all(pending_scores)

        # One commit per batch, not per indicator.
        db.commit()

        created += len(pending_scores)
        last_id = indicators[-1].id

    return {
        "mode": "apply",
        "processed": processed,
        "created": created,
        "unchanged": unchanged,
        "distribution": {
            severity: distribution[severity]
            for severity in (
                "low",
                "medium",
                "high",
                "critical",
            )
        },
        "database_modified": created > 0,
    }
