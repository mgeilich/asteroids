import logging
import requests
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

NASA_FEED_URL = "https://api.nasa.gov/neo/rest/v1/feed"

def fetch_neo_feed(start_date: str, end_date: str, api_key: str = "DEMO_KEY") -> Optional[Dict[str, Any]]:
    """
    Fetches the Near-Earth Objects (NEO) feed from NASA API for a given date range.
    
    Args:
        start_date: Start date string in YYYY-MM-DD format
        end_date: End date string in YYYY-MM-DD format
        api_key: NASA API key (defaults to 'DEMO_KEY')
        
    Returns:
        A dictionary containing the API response, or None if the request failed.
    """
    params = {
        "start_date": start_date,
        "end_date": end_date,
        "api_key": api_key
    }
    
    logger.info(f"Fetching NASA NEO feed from {start_date} to {end_date}...")
    try:
        response = requests.get(NASA_FEED_URL, params=params, timeout=15)
        
        # Check rate limits in headers
        limit = response.headers.get("X-RateLimit-Limit")
        remaining = response.headers.get("X-RateLimit-Remaining")
        if remaining:
            logger.debug(f"NASA API Rate Limit: {remaining}/{limit} remaining.")
            
        if response.status_code == 429:
            logger.error("NASA API Rate limit exceeded! Try using a personal API key.")
            return None
            
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch data from NASA NeoWS API: {e}")
        return None
