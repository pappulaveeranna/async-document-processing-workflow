# Project Architecture Document

## Overview

This document describes the architecture of the async document processing system.
The system is designed to handle large volumes of document uploads with real-time
progress tracking and structured data extraction.

## Components

### Backend API
Built with FastAPI, the backend exposes RESTful endpoints for document upload,
job management, and result export. All processing is offloaded to background workers.

### Background Workers
Celery workers consume tasks from a Redis broker. Each worker processes one document
at a time through a multi-stage pipeline: parsing, extraction, and storage.

### Progress Tracking
Redis Pub/Sub channels broadcast progress events from workers to the API layer.
The frontend subscribes via Server-Sent Events for real-time updates.

### Database
PostgreSQL stores document metadata, job state, extracted data, and finalized results.
SQLAlchemy ORM provides a clean abstraction over raw SQL queries.

## Data Flow

1. User uploads document via frontend
2. API saves file and creates job record in PostgreSQL
3. Celery task is dispatched to Redis broker
4. Worker picks up task and begins processing
5. Progress events published to Redis Pub/Sub channel
6. Frontend receives events via SSE and updates UI
7. Final result stored in PostgreSQL
8. User reviews, edits, finalizes, and exports result

## Deployment

Docker Compose orchestrates all services locally.
Production deployment targets container orchestration platforms.
