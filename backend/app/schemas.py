from datetime import datetime
from pydantic import BaseModel

class IndicatorCreate(BaseModel):
    value: str
    indicator_type: str
    description: str | None = None
    first_seen: datetime | None = None
    last_seen: datetime | None = None

class IndicatorResponse(IndicatorCreate):
    id: int
    created_at: datetime

    model_config = {
        "from_attributes": True
    }