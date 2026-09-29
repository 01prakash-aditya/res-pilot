"""
API key authentication middleware.
If API_KEY is empty (default), authentication is disabled — safe for local development.
For production, set a strong API_KEY in your .env file.

SSE endpoints (progress streaming) cannot send custom headers via EventSource,
so they accept the key as a query parameter: ?api_key=<key>
"""
import os
from fastapi import HTTPException, Security, Query
from fastapi.security.api_key import APIKeyHeader

API_KEY: str = os.getenv("API_KEY", "")

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(
    header_key: str = Security(_api_key_header),
    query_key: str = Query(None, alias="api_key"),
) -> str:
    """
    Accept the API key from either the X-API-Key header or ?api_key= query param.
    Returns immediately if API_KEY env var is empty (auth disabled).
    """
    if not API_KEY:
        return ""
    provided = header_key or query_key or ""
    if provided != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")
    return provided
