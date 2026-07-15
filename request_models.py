from pydantic import BaseModel, Field

class CommandJobRequest(BaseModel):
    command: str = Field(
        min_length=1,
        max_length=100,
        examples=["ls"]
    )
    options: list[str] = Field(
        default_factory=list,
        examples=[["-l", "-a"]],
    )

class CrawlerJobRequest(BaseModel):
    website: str = Field(
        min_length=1,
        examples=["https://www.example.com"]
    )
