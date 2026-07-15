import asyncio
import json
import os
from uuid import UUID

import aio_pika
import asyncpg

from rabbit import get_connection, declare_queues

DATABASE_URL = os.getenv('DATABASE_URL')

COMMAND_TIMEOUT_SECONDS = 9999
CRAWLER_TIMEOUT_SECONDS = 9999

async def execute_command(command:str) -> dict:
    proc = await asyncio.create_subprocess_shell(command,cwd="/app",stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.STDOUT)
    try:
        output, _ = await asyncio.wait_for(proc.communicate(),timeout=COMMAND_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.communicate()
        raise RuntimeError("Command timed out")
    return {"output": output.decode("utf-8",errors="replace"),
            "exit_code":proc.returncode,}

async def handle_command_job(
        db: asyncpg.Pool,
        message: aio_pika.IncomingMessage,) -> None:
            async with message.process(requeue=False):
                payload = json.loads(message.body.decode("utf-8"))
                command_job_id = UUID(payload["job_id"])
                async with db.acquire() as conn:
                    command_job = await conn.fetchrow("SELECT * FROM command_jobs WHERE id = $1",command_job_id)
                    if not command_job:
                        print(f"No command job found for job_id {command_job_id}")
                        return
                    if command_job["status"] != "queued":
                        print(f"Job {command_job['id']} has not been queued")
                        return
                async with db.acquire() as conn:
                    await conn.execute("UPDATE command_jobs SET status = 'running' WHERE id = $1", command_job_id)
                try:
                    command_result = await execute_command(command_job["command"])
                    status = ("completed" if command_result["exit_code"] == 0 else "failed")
                    async with db.acquire() as conn:
                        await conn.execute("UPDATE command_jobs SET status = $1, output = $2, exit_code = $3 WHERE id = $4", status, command_result["output"], command_result["exit_code"], command_job_id)
                except Exception as e:
                    async with db.acquire() as conn:
                        await conn.execute("UPDATE command_jobs SET status = 'failed', output = $1 WHERE id = $2", str(e), command_job_id)



async def execute_crawler(website: str) -> int:
    proc = await asyncio.create_subprocess_exec("katana", "-u",website,"-silent", stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(),timeout=CRAWLER_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.communicate()
        raise RuntimeError("Crawler timed out")
    if proc.returncode != 0:
        err = stderr.decode("utf-8",errors="replace")
        raise RuntimeError("katana command failed: "+(err or "Unknown error"))
    output = stdout.decode("utf-8",errors="replace")
    urls = {line.strip() for line in output.splitlines() if line.strip()}
    return len(urls)


async def handle_crawler_job(db: asyncpg.Pool,message: aio_pika.IncomingMessage) -> None:
    async with message.process(requeue=False):
        payload = json.loads(message.body.decode("utf-8"))
        crawler_job_id = UUID(payload["job_id"])
        async with db.acquire() as conn:
            crawler_job = await conn.fetchrow("SELECT * FROM crawler_jobs WHERE id = $1",crawler_job_id)
            if not crawler_job:
                print(f"No crawler job found for job_id {crawler_job_id}")
                return
            if crawler_job["status"] != "queued":
                print(f"Job {crawler_job['id']} has not been queued")
                return
        async with db.acquire() as conn:
            await conn.execute("UPDATE crawler_jobs SET status = 'running' WHERE id = $1", crawler_job_id)
        try:
            total_url_count = await execute_crawler(crawler_job["website"])
            async with db.acquire() as conn:
                await conn.execute("UPDATE crawler_jobs SET status = 'completed', total_url_count = $1 WHERE id = $2",total_url_count,crawler_job_id)
        except Exception as e:
            async with db.acquire() as conn:
                await conn.execute("UPDATE crawler_jobs SET status = 'failed' WHERE id = $1", crawler_job_id)

async def main() -> None:
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL environment variable is not defined")
    db = await asyncpg.create_pool(DATABASE_URL,min_size=1,max_size=10,)
    rabbit_connection = await get_connection()
    rabbit_channel = await rabbit_connection.channel()

    await rabbit_channel.set_qos(prefetch_count=5)

    commands_queue, crawler_queue = (await declare_queues(rabbit_channel))

    await commands_queue.consume(lambda message : handle_command_job(db, message))
    await crawler_queue.consume(lambda message : handle_crawler_job(db, message))

    try:
        await asyncio.Future()
    finally:
        await rabbit_channel.close()
        await rabbit_connection.close()
        await db.close()

if __name__ == "__main__":
    asyncio.run(main())

