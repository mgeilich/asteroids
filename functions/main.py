import datetime
import json
import os
import logging
from firebase_functions import https_fn
from firebase_admin import initialize_app, firestore

# Initialize Firebase Admin SDK
initialize_app()

from nasa_api import fetch_neo_feed
from radar_calculator import calculate_telemetry

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@https_fn.on_request()
def neo_radar(req: https_fn.Request) -> https_fn.Response:
    """
    HTTP trigger function that returns Near-Earth Object (NEO) radar telemetry.
    Utilizes Firestore to cache responses to stay within NASA API rate limits.
    """
    db = firestore.client()
    cache_ref = db.collection("cache").document("neo_telemetry")
    
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Try reading from Firestore cache
    cached_doc = None
    try:
        cached_doc = cache_ref.get()
    except Exception as e:
        logger.error(f"Error reading from Firestore cache: {e}")

    # If cache exists, check freshness (1 hour cache TTL)
    if cached_doc and cached_doc.exists:
        cache_data = cached_doc.to_dict()
        cached_at_str = cache_data.get("cached_at")
        
        if cached_at_str:
            try:
                cached_at = datetime.datetime.fromisoformat(cached_at_str)
                age = now - cached_at
                
                if age < datetime.timedelta(hours=1):
                    logger.info("Serving telemetry from fresh Firestore cache.")
                    return https_fn.Response(
                        json.dumps(cache_data["payload"]),
                        mimetype="application/json"
                    )
            except Exception as ex:
                logger.error(f"Failed to parse cached_at timestamp: {ex}")
    
    # Cache is stale or missing; fetch fresh data from NASA
    api_key = req.args.get("nasa_api_key") or os.environ.get("NASA_API_KEY", "DEMO_KEY")
    start_date = now.strftime("%Y-%m-%d")
    end_date = (now + datetime.timedelta(days=7)).strftime("%Y-%m-%d")
    
    logger.info(f"Cache stale or missing. Fetching fresh NASA NEO feed...")
    raw_data = fetch_neo_feed(start_date, end_date, api_key)
    
    if raw_data:
        # Calculate fresh radar telemetry
        payload = calculate_telemetry(raw_data)
        
        # Save to Firestore cache
        try:
            cache_ref.set({
                "payload": payload,
                "cached_at": now.isoformat()
            })
            logger.info("Successfully updated Firestore cache with fresh telemetry.")
        except Exception as e:
            logger.error(f"Failed to write to Firestore cache: {e}")
            
        return https_fn.Response(
            json.dumps(payload),
            mimetype="application/json"
        )
    else:
        # NASA API failed. Fall back to cached data if available (even if stale)
        if cached_doc and cached_doc.exists:
            logger.warning("NASA API call failed. Falling back to stale cached data.")
            cache_data = cached_doc.to_dict()
            
            # Update system status to reflect NASA API is offline, but return the stale data
            payload = cache_data["payload"]
            payload["system_status"] = "FALLBACK: NASA API OFFLINE // SHOWING CACHED DATA"
            
            return https_fn.Response(
                json.dumps(payload),
                mimetype="application/json"
            )
            
        # If absolutely no cache is available, calculate default fallback payload
        logger.error("NASA API call failed and no cached data exists. Returning empty fallback.")
        fallback_payload = calculate_telemetry(None)
        fallback_payload["system_status"] = "ERROR: NASA OFFLINE // NO CACHE AVAILABLE"
        
        return https_fn.Response(
            json.dumps(fallback_payload),
            mimetype="application/json"
        )
