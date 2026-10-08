"""Pydantic request/response contracts for the PREDICTIVE API."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "ml"))
from schema import CATEGORY_VALUES  # noqa: E402


def _enum(name: str) -> type:
    return Literal[tuple(CATEGORY_VALUES[name])]  # type: ignore[misc]


class CustomerFeatures(BaseModel):
    gender: _enum("gender")
    SeniorCitizen: _enum("SeniorCitizen")
    Partner: _enum("Partner")
    Dependents: _enum("Dependents")
    tenure: int = Field(ge=0, le=100, description="Months with the company")
    PhoneService: _enum("PhoneService")
    MultipleLines: _enum("MultipleLines")
    InternetService: _enum("InternetService")
    OnlineSecurity: _enum("OnlineSecurity")
    OnlineBackup: _enum("OnlineBackup")
    DeviceProtection: _enum("DeviceProtection")
    TechSupport: _enum("TechSupport")
    StreamingTV: _enum("StreamingTV")
    StreamingMovies: _enum("StreamingMovies")
    Contract: _enum("Contract")
    PaperlessBilling: _enum("PaperlessBilling")
    PaymentMethod: _enum("PaymentMethod")
    MonthlyCharges: float = Field(ge=0, le=500)
    TotalCharges: float = Field(ge=0, le=20000)

    @field_validator("MonthlyCharges", "TotalCharges")
    @classmethod
    def finite(cls, v: float) -> float:
        import math

        if math.isnan(v) or math.isinf(v):
            raise ValueError("must be a finite number")
        return v


class PredictionResponse(BaseModel):
    churn_probability: float
    churn_prediction: Literal["Yes", "No"]
    model_name: str
    model_version: str


class BatchPredictRequest(BaseModel):
    customers: list[CustomerFeatures] = Field(min_length=1, max_length=500)


class BatchPredictionItem(PredictionResponse):
    index: int


class BatchPredictResponse(BaseModel):
    predictions: list[BatchPredictionItem]


class ExplanationResponse(BaseModel):
    churn_probability: float
    top_factors: list[dict]


class DriftPoint(BaseModel):
    day: int
    mean_tenure: float
    mean_monthly_charges: float
    predicted_churn_rate: float
    drift_flag: bool
