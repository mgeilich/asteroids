import logging
import requests
from typing import Dict, Any

logger = logging.getLogger(__name__)

def send_to_trmnl(webhook_url: str, payload: Dict[str, Any]) -> bool:
    """
    POSTs the payload to TRMNL's custom plugin webhook endpoint.
    
    Args:
        webhook_url: The full webhook URL (including plugin settings UUID)
        payload: Dict of key/value pairs to merge into the Liquid template
        
    Returns:
        True if the request was successful, False otherwise.
    """
    if not webhook_url:
        logger.error("TRMNL webhook URL is not configured. Skipping push.")
        return False
        
    # TRMNL custom plugin webhook format requires variables inside merge_variables
    wrapped_payload = {
        "merge_variables": payload
    }
    
    logger.info(f"Pushing data to TRMNL webhook...")
    try:
        response = requests.post(
            webhook_url,
            json=wrapped_payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        # Log response status and details
        if response.status_code == 200 or response.status_code == 201:
            logger.info("Successfully pushed telemetry data to TRMNL!")
            return True
        elif response.status_code == 429:
            logger.error("Failed to push to TRMNL: Rate limit exceeded (429).")
        else:
            logger.error(f"Failed to push to TRMNL. Status code: {response.status_code}, Response: {response.text}")
            
        return False
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error when pushing to TRMNL: {e}")
        return False
