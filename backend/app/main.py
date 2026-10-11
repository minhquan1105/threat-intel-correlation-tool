from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app import models
from app.database import engine, initialize_database
from app.routers.campaigns import router as campaigns_router
from app.routers.graph import router as graph_router
from app.routers.indicators import router as indicators_router
from app.routers.ingestion import router as ingestion_router
from app.routers.sources import router as sources_router
from app.routers.stats import router as stats_router

app = FastAPI(title="Threat Intel Correlation API", version="1.0.0")


@app.on_event("startup")
def startup_event():
    initialize_database()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Threat Intel Correlation API is running"}


@app.get("/db-health")
def database_health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"database": "connected"}


app.include_router(indicators_router)
app.include_router(campaigns_router)
app.include_router(sources_router)
app.include_router(stats_router)
app.include_router(graph_router)
app.include_router(ingestion_router)

