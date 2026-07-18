import json
import os
from contextlib import asynccontextmanager
from uuid import UUID

import aio_pika
import asyncpg
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from rabbit import (COMMANDS_QUEUE, CRAWLER_QUEUE, declare_queues, get_connection)

from request_models import CommandJobRequest, CrawlerJobRequest

DATABASE_URL = os.environ.get("DATABASE_URL")

@asynccontextmanager
async def lifespan(app: FastAPI):
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")

    app.state.db = await asyncpg.create_pool(DATABASE_URL)

    app.state.rabbit_connection = await get_connection()
    app.state.rabbit_channel = await app.state.rabbit_connection.channel()
    await declare_queues(app.state.rabbit_channel)

    try:
        yield
    finally:
        await app.state.rabbit_channel.close()
        await app.state.rabbit_connection.close()
        await app.state.db.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def publish_job(queue: str, job_id: UUID) -> None:
    payload = {"job_id": str(job_id)}
    message = aio_pika.Message(body=json.dumps(payload).encode("utf-8"), content_type="application/json", delivery_mode=aio_pika.DeliveryMode.PERSISTENT)
    await app.state.rabbit_channel.default_exchange.publish(message,routing_key=queue)

def serialize_command_job(job: asyncpg.Record) -> dict:
    return {
        "job_id": str(job["id"]),
        "job_type": "command",
        "command": job["command"],
        "status": job["status"],
        "output": job["output"],
        "exit_code": job["exit_code"],
    }

def serialize_crawler_job(job: asyncpg.Record) -> dict:
    return {
        "job_id": str(job["id"]),
        "job_type": "crawler",
        "website": job["website"],
        "status": job["status"],
        "total_url_count": job["total_url_count"],
    }

@app.get("/")
async def root():
    return {
        "name": "Job API",
        "status": "running",
    }

@app.get("/health")
async def health():
    try:
        async with app.state.db.acquire() as conn:
            is_database_connected = await conn.fetchval("SELECT 1")
            is_rabbit_connected = (not app.state.rabbit_connection.is_closed)

            if is_database_connected != 1 and not is_rabbit_connected:
                raise HTTPException(status_code=503, detail="Database connection and Rabbit connection failed")
            elif is_database_connected != 1:
                raise HTTPException(status_code=503, detail="Database connection failed")
            elif not is_rabbit_connected:
                raise HTTPException(status_code=503, detail="RabbitMQ connection failed")
            return {
                "status": "healthy",
                "database": "connected",
                "rabbitmq": "connected",
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail="Unhealthy "+str(e)) from e


@app.post("/command-jobs",status_code=202)
async def create_command_job(request: CommandJobRequest):
    full_command = request.command
    async with app.state.db.acquire() as conn:
        job = await conn.fetchrow(
            """INSERT INTO command_jobs (command, status) VALUES ($1, 'queued') RETURNING * """,
            full_command,
        )
    try:
        await publish_job(COMMANDS_QUEUE, job["id"])
    except Exception as e:
        async with app.state.db.acquire() as conn:
            await conn.execute("""UPDATE command_jobs SET status ='failed' WHERE id = $1 """, job["id"])

        raise HTTPException(status_code=503, detail="Command job failed "+str(e)) from e

    return {
        "job_id": str(job["id"]),
        "job_type": "command",
        "status": "queued",
        "command": request.command,
        "stored_command": full_command,
        "detail_url": f"/command-jobs/{job['id']}",
    }

@app.get("/command-jobs")
async def list_command_jobs():
    async with app.state.db.acquire() as conn:
        all_command_jobs = await conn.fetch("SELECT * FROM command_jobs")
        return {
            "count": len(all_command_jobs),
            "jobs": [
                serialize_command_job(job) for job in all_command_jobs
            ]

        }

@app.get("/command-jobs/{job_id}")
async def fetch_command_job(job_id: UUID):
    async with app.state.db.acquire() as conn:
        selected_command_job = await conn.fetchrow("SELECT * FROM command_jobs WHERE id = $1", job_id)
        if not selected_command_job:
            raise HTTPException(status_code=404, detail="Job not found")
        return serialize_command_job(selected_command_job)

@app.post("/crawler-jobs",status_code=202)
async def create_crawler_job(request: CrawlerJobRequest):
    website = str(request.website)
    async with app.state.db.acquire() as conn:
        job = await conn.fetchrow("""INSERT INTO crawler_jobs (website,status) VALUES ($1, 'queued') RETURNING * """,website)
    try:
        await publish_job(CRAWLER_QUEUE, job["id"])
    except Exception as e:
        async with app.state.db.acquire() as conn:
            await conn.execute("UPDATE crawler_jobs SET status ='failed' WHERE id = $1", job["id"])
        raise HTTPException(status_code=503, detail="Crawler job failed "+str(e)) from e

    return {
        "job_id": str(job["id"]),
        "job_type": "crawler",
        "status": "queued",
        "website": website,
        "detail_url": f"/crawler-jobs/{job['id']}",
    }

@app.get("/crawler-jobs")
async def list_crawler_jobs():
    async with app.state.db.acquire() as conn:
        all_crawl_jobs = await conn.fetch("SELECT * FROM crawler_jobs")
        return {
            "count": len(all_crawl_jobs),
            "jobs": [serialize_crawler_job(job) for job in all_crawl_jobs],
        }

@app.get("/crawler-jobs/{job_id}")
async def fetch_crawler_job(job_id: UUID):
    async with app.state.db.acquire() as conn:
        selected_crawl_job = await conn.fetchrow("SELECT * FROM crawler_jobs WHERE id = $1", job_id)
        if not selected_crawl_job:
            raise HTTPException(status_code=404, detail="Job not found")
        return serialize_crawler_job(selected_crawl_job)
