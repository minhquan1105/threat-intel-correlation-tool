from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="", tags=["sources"])


@router.get("/sources", response_model=list[schemas.SourceResponse])
def get_sources(db: Session = Depends(get_db)):
    sources = db.query(models.Source).all()
    return [
        schemas.SourceResponse(
            id=source.id,
            name=source.name,
            url=source.url,
            created_at=source.created_at,
        )
        for source in sources
    ]


@router.post("/sources", response_model=schemas.SourceResponse)
def create_source(source: schemas.SourceCreate, db: Session = Depends(get_db)):
    existing_source = db.query(models.Source).filter(models.Source.name == source.name).first()
    if existing_source:
        raise HTTPException(status_code=409, detail="Source already exists")

    db_source = models.Source(name=source.name, url=source.url)
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return schemas.SourceResponse(
        id=db_source.id,
        name=db_source.name,
        url=db_source.url,
        created_at=db_source.created_at,
    )
