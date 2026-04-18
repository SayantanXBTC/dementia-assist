import asyncio
from hindsight_client import Hindsight
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    api_key = os.getenv("HINDSIGHT_API_KEY")
    api_url = os.getenv("HINDSIGHT_API_URL")
    
    schema = {
        "type": "object",
        "properties": {
            "age": {"type": "integer"},
            "relation": {"type": "string"},
            "likes": {"type": "array", "items": {"type": "string"}},
            "notes": {"type": "string"}
        }
    }
    
    async with Hindsight(base_url=api_url, api_key=api_key) as client:
        print("Recalling..")
        res = await client.areflect(
            bank_id="dementia_assist_001",
            query="Extract the profile for Sayantan. What is his age, relation, likes, and notes?",
            tags=["sayantan"],
            response_schema=schema
        )
        print("Reflect structure:")
        print(getattr(res, "structured_output", "No structured output"))
        print("Text:", getattr(res, "text", ""))
        
if __name__ == "__main__":
    asyncio.run(main())
