import asyncio
import os
import aio_pika

RABBITMQ_URL = os.getenv("RABBITMQ_URL")
COMMANDS_QUEUE = "commands_queue"
CRAWLER_QUEUE = "crawler_queue"

async def get_connection() -> aio_pika.RobustConnection:
    error = ""
    for i in range(10):
        try:
            connection = await aio_pika.connect_robust(RABBITMQ_URL)
            print("Connected to RabbitMQ")
            return connection
        except Exception as e:
            error = str(e)
            print("Attempt: "+str(i+1)+ " Error: "+str(e))
            await asyncio.sleep(5)

    raise RuntimeError("Unable to connect to RabbitMQ " + (error or "Unknown error"))

async def declare_queues(channel: aio_pika.Channel) -> tuple[aio_pika.Queue, aio_pika.Queue]:
    commands_queue = await channel.declare_queue(COMMANDS_QUEUE,durable=True)
    crawler_queue = await channel.declare_queue(CRAWLER_QUEUE,durable=True)
    return commands_queue, crawler_queue