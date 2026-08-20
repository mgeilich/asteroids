import datetime
import math
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

def clean_asteroid_name(raw_name: str) -> str:
    """Strips leading/trailing parentheses, spaces, and extraneous numbers from names."""
    if not raw_name:
        return "—"
    name = raw_name.replace("(", "").replace(")", "").strip()
    parts = name.split()
    if len(parts) > 1 and parts[0].isdigit():
        name = " ".join(parts[1:])
    if len(name) > 8:
        name = name[:6] + ".."
    return name

def calculate_telemetry(raw_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Parses NASA NeoWS feed data and computes the e-ink radar coordinates and metrics.
    
    Returns a dictionary suitable for sending as 'merge_variables' to TRMNL.
    """
    # Safe fallback if raw_data is missing or invalid
    now = datetime.datetime.now(datetime.timezone.utc)
    last_updated_str = now.strftime("%b %d, %H:%M UTC")
    
    default_payload = {
        "radar_asteroids": [],
        "radar_ticks": [],
        "radar_asteroids_full": [],
        "radar_ticks_full": [],
        "radar_asteroids_half_horizontal": [],
        "radar_ticks_half_horizontal": [],
        "radar_asteroids_half_vertical": [],
        "radar_ticks_half_vertical": [],
        "radar_asteroids_quadrant": [],
        "radar_ticks_quadrant": [],
        "closest_list": [],
        "total_count": 0,
        "closest_dist_ld": "—",
        "closest_name": "—",
        "max_size_m": "—",
        "system_status": "SYSTEM NOMINAL // NO DATA",
        "last_updated": last_updated_str,
        "has_asteroids": False
    }
    
    if not raw_data or "near_earth_objects" not in raw_data:
        default_payload["system_status"] = "ERROR: NASA OFFLINE"
        return default_payload

    now_ms = int(now.timestamp() * 1000)
    end_ms = now_ms + 7 * 24 * 3600 * 1000  # 7 days in ms
    
    candidates = []
    total_objects_in_range = 0
    
    # Iterate through near_earth_objects dictionary
    neo_dict = raw_data["near_earth_objects"]
    for date_str, asteroid_list in neo_dict.items():
        for asteroid in asteroid_list:
            if not asteroid.get("close_approach_data"):
                continue
                
            approach = asteroid["close_approach_data"][0]
            epoch = approach.get("epoch_date_close_approach")
            if not epoch:
                continue
                
            # We filter for upcoming encounters in the next 7 days
            if now_ms <= epoch <= end_ms:
                total_objects_in_range += 1
                
                # Estimated diameter
                diam_m_min = asteroid["estimated_diameter"]["meters"]["estimated_diameter_min"]
                diam_m_max = asteroid["estimated_diameter"]["meters"]["estimated_diameter_max"]
                avg_diam = (diam_m_min + diam_m_max) / 2
                
                # Miss distance
                miss_distance_ld = float(approach["miss_distance"]["lunar"])
                
                # Velocity
                vel_kph = float(approach["relative_velocity"]["kilometers_per_hour"])
                
                candidates.append({
                    "id": asteroid["id"],
                    "name": clean_asteroid_name(asteroid["name"]),
                    "miss_distance_ld": miss_distance_ld,
                    "velocity_kph": vel_kph,
                    "diameter_min": diam_m_min,
                    "diameter_max": diam_m_max,
                    "avg_diameter": avg_diam,
                    "is_hazardous": bool(asteroid["is_potentially_hazardous_asteroid"]),
                    "epoch": epoch
                })
                
    closest_list_payload = []
    warning_active = False
    closest_dist_ld = "—"
    closest_name = "—"
    max_size_m = "—"
    
    if candidates:
        # Find the stats overall for the 7-day window
        # 1. Closest approach
        closest_candidate = min(candidates, key=lambda c: c["miss_distance_ld"])
        closest_dist_ld = f"{closest_candidate['miss_distance_ld']:.1f} LD"
        closest_name = closest_candidate["name"]
        
        # 2. Maximum diameter
        max_diam_candidate = max(candidates, key=lambda c: c["avg_diameter"])
        max_size_m = f"{int(max_diam_candidate['avg_diameter'])}m"
        
        # Build list of 3 closest encounters for the sidebar list
        sorted_by_distance = sorted(candidates, key=lambda c: c["miss_distance_ld"])
        closest_3 = sorted_by_distance[:3]
        
        for item in closest_3:
            # Check if any close encounter is potentially hazardous and very close
            if item["is_hazardous"] and item["miss_distance_ld"] <= 15.0:
                warning_active = True
                
            dt = datetime.datetime.fromtimestamp(item["epoch"] / 1000, tz=datetime.timezone.utc)
            # Calculate hours/days until encounter
            diff = dt - now
            hours_to = int(diff.total_seconds() / 3600)
            days_to = hours_to // 24
            rem_hours = hours_to % 24
            
            if days_to > 0:
                time_str = f"T+{days_to}d {rem_hours}h"
            else:
                time_str = f"T+{rem_hours}h"
                
            closest_list_payload.append({
                "name": item["name"],
                "dist_ld": f"{item['miss_distance_ld']:.1f}",
                "vel_kph": f"{int(item['velocity_kph']):,}",
                "size_m": f"{int(item['avg_diameter'])}m",
                "is_hazardous": "HAZARD" if item["is_hazardous"] else "",
                "time_str": time_str
            })
        
    # Layout dimensions configurations
    layouts = {
        "full": {"cx": 140, "cy": 130, "R_max": 120, "D_max": 40.0, "tick_inner": 121, "tick_outer": 126, "tick_label": 132},
        "half_horizontal": {"cx": 110, "cy": 80, "R_max": 65, "D_max": 40.0, "tick_inner": 62, "tick_outer": 68, "tick_label": 75},
        "half_vertical": {"cx": 110, "cy": 80, "R_max": 65, "D_max": 40.0, "tick_inner": 62, "tick_outer": 68, "tick_label": 75},
        "quadrant": {"cx": 75, "cy": 75, "R_max": 67, "D_max": 40.0, "tick_inner": 64, "tick_outer": 70, "tick_label": 0}
    }
    
    outputs = {}
    tomorrow_midnight = datetime.datetime(now.year, now.month, now.day, tzinfo=datetime.timezone.utc) + datetime.timedelta(days=1)
    
    for name, layout in layouts.items():
        # Select and calculate asteroids
        radar_candidates = [c for c in candidates if c["miss_distance_ld"] <= layout["D_max"]]
        limit = 10
        if name == "quadrant":
            limit = 4
        elif name == "half_horizontal":
            limit = 6
        elif name == "half_vertical":
            limit = 10
        radar_candidates = sorted(radar_candidates, key=lambda c: c["miss_distance_ld"])[:limit]
        
        asteroids_payload = []
        for item in radar_candidates:
            R = layout["R_max"] * (item["miss_distance_ld"] / layout["D_max"])
            t_norm = (item["epoch"] - now_ms) / (end_ms - now_ms)
            angle = t_norm * 360.0
            alpha = math.radians(angle)
            
            x = layout["cx"] + R * math.sin(alpha)
            y = layout["cy"] - R * math.cos(alpha)
            
            # Map circle radius
            if item["avg_diameter"] < 30:
                r = 3
            elif item["avg_diameter"] < 100:
                r = 5
            elif item["avg_diameter"] < 300:
                r = 7
            else:
                r = 9
                
            # Scale radius down slightly for quadrant layout
            if name == "quadrant":
                r = max(2, int(r * 0.6))
                
            # Label offsets
            if x >= layout["cx"]:
                label_x = x + r + 4
                anchor = "start"
            else:
                label_x = x - r - 4
                anchor = "end"
            label_y = y + 3
            
            parts = item["name"].split()
            if len(parts) > 1:
                name_parts = [parts[0], " ".join(parts[1:])]
            else:
                name_parts = [item["name"]]

            asteroids_payload.append({
                "name": item["name"],
                "name_parts": name_parts,
                "x": round(x, 1),
                "y": round(y, 1),
                "r": r,
                "label_x": round(label_x, 1),
                "label_y": round(label_y, 1),
                "anchor": anchor,
                "is_hazardous": item["is_hazardous"]
            })
            
        # Calculate ticks
        ticks_payload = []
        for i in range(7):
            mid = tomorrow_midnight + datetime.timedelta(days=i)
            mid_ms = int(mid.timestamp() * 1000)
            
            if now_ms <= mid_ms <= end_ms:
                t_norm = (mid_ms - now_ms) / (end_ms - now_ms)
                angle = t_norm * 360.0
                alpha = math.radians(angle)
                
                x1 = layout["cx"] + layout["tick_inner"] * math.sin(alpha)
                y1 = layout["cy"] - layout["tick_inner"] * math.cos(alpha)
                x2 = layout["cx"] + layout["tick_outer"] * math.sin(alpha)
                y2 = layout["cy"] - layout["tick_outer"] * math.cos(alpha)
                
                label_x = 0
                label_y = 0
                anchor = "middle"
                
                if layout["tick_label"] > 0:
                    xl = layout["cx"] + layout["tick_label"] * math.sin(alpha)
                    yl = layout["cy"] - layout["tick_label"] * math.cos(alpha)
                    
                    if 15.0 < angle < 165.0:
                        anchor = "start"
                    elif 195.0 < angle < 345.0:
                        anchor = "end"
                        
                    label_x = xl
                    if angle < 15.0 or angle > 345.0:
                        label_y = yl - 2
                    elif 165.0 < angle < 195.0:
                        label_y = yl + 8
                    else:
                        label_y = yl + 3
                        
                ticks_payload.append({
                    "x1": round(x1, 1),
                    "y1": round(y1, 1),
                    "x2": round(x2, 1),
                    "y2": round(y2, 1),
                    "label": mid.strftime("%a").upper(),
                    "label_x": round(label_x, 1),
                    "label_y": round(label_y, 1),
                    "anchor": anchor
                })
                
        outputs[f"radar_asteroids_{name}"] = asteroids_payload
        outputs[f"radar_ticks_{name}"] = ticks_payload

    # Sector status message
    if not candidates:
        status_msg = "SYSTEM STATUS: NOMINAL // CLEAR SPACE"
    elif warning_active:
        status_msg = "WARNING: POTENTIALLY HAZARDOUS OBJECT IN SECTOR"
    else:
        status_msg = "SYSTEM STATUS: NOMINAL // ALL ENCOUNTERS SAFE"

    # Assemble and return the complete payload
    result = {
        "closest_list": closest_list_payload,
        "total_count": total_objects_in_range,
        "closest_dist_ld": closest_dist_ld,
        "closest_name": closest_name,
        "max_size_m": max_size_m,
        "system_status": status_msg,
        "last_updated": last_updated_str,
        "has_asteroids": len(candidates) > 0,
        "candidates": candidates  # Pass along candidates for transform.js if needed
    }
    
    # Merge computed coordinate layouts
    result.update(outputs)
    return result

