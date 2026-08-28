from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import text
from app.database import engine, get_db
from app import models
from app import schemas
from sqlalchemy.orm import Session

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Threat Intel Correlation API is running"}

@app.get("/db-health")
def database_health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"database": "connected"}

@app.post("/indicators", response_model=schemas.IndicatorResponse)
def create_indicator(
    indicator: schemas.IndicatorCreate,
    db: Session = Depends(get_db)
):
    existing_indicator = (
        db.query(models.Indicator)
        .filter(models.Indicator.value == indicator.value)
        .first()
    )

    if existing_indicator:
        raise HTTPException(
            status_code=409,
            detail="Indicator already exists"
        )

    db_indicator = models.Indicator(**indicator.model_dump())

    db.add(db_indicator)
    db.commit()
    db.refresh(db_indicator)

    return db_indicator

@app.get("/indicators", response_model=list[schemas.IndicatorResponse])
def get_indicators(db: Session = Depends(get_db)):
    return db.query(models.Indicator).all()


