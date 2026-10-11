from datetime import datetime


def severity_from_score(score: int) -> str:
    if score >= 75:
        return "critical"
    if score >= 50:
        return "high"
    if score >= 25:
        return "medium"
    return "low"


def calculate_indicator_risk(
    source_count: int,
    campaign_count: int,
    recent_observations: int,
    days_since_first_seen: int,
    repeated_observation_count: int,
) -> int:
    score = 0
    score += min(30, max(0, source_count) * 10)
    score += min(25, max(0, campaign_count) * 12)
    score += min(25, max(0, recent_observations) * 6)
    if days_since_first_seen <= 30:
        score += min(20, max(0, 30 - days_since_first_seen) * 1)
    score += min(15, max(0, repeated_observation_count) * 2)

    if source_count >= 3 and campaign_count >= 1:
        score += 10

    return max(0, min(100, int(round(score))))


def build_risk_explanation(score: int, source_count: int, campaign_count: int, recent_observations: int, days_since_first_seen: int) -> str:
    parts = []
    if source_count:
        source_points = min(30, source_count * 10)
        parts.append(f"observed by {source_count} sources (+{source_points})")
    if campaign_count:
        campaign_points = min(25, campaign_count * 12)
        parts.append(f"associated with {campaign_count} campaigns (+{campaign_points})")
    if recent_observations:
        recent_points = min(25, recent_observations * 6)
        parts.append(f"recently observed {recent_observations} times (+{recent_points})")
    if days_since_first_seen <= 30:
        recency_points = min(20, max(0, 30 - days_since_first_seen))
        parts.append(f"observed within {max(1, 30 - days_since_first_seen)} days (+{recency_points})")

    if not parts:
        return f"Risk score {score}: insufficient evidence to assign significant risk."

    return f"Risk score {score}: " + ", ".join(parts) + "."


def build_indicator_risk(
    source_count: int,
    campaign_count: int,
    recent_observations: int,
    days_since_first_seen: int,
    repeated_observation_count: int,
) -> dict:
    score = calculate_indicator_risk(
        source_count=source_count,
        campaign_count=campaign_count,
        recent_observations=recent_observations,
        days_since_first_seen=days_since_first_seen,
        repeated_observation_count=repeated_observation_count,
    )
    return {
        "score": score,
        "severity": severity_from_score(score),
        "explanation": build_risk_explanation(
            score=score,
            source_count=source_count,
            campaign_count=campaign_count,
            recent_observations=recent_observations,
            days_since_first_seen=days_since_first_seen,
        ),
    }
