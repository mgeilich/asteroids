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
    Parses NASA NeoWS feed data and computes linear timeline coordinates and metrics.
    X-axis is Time with NOW in the center (span: NOW - 3.5 days to NOW + 3.5 days).
    Y-axis is Distance in Lunar Distances (LD) from 0 LD (Earth) up to 40 LD.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    last_updated_str = now.strftime("%b %d, %H:%M UTC")
    
    default_payload = {
        "chart_asteroids_full": [],
        "chart_ticks_full": [],
        "chart_gridlines_full": [],
        "chart_asteroids_half_horizontal": [],
        "chart_ticks_half_horizontal": [],
        "chart_gridlines_half_horizontal": [],
        "chart_asteroids_half_vertical": [],
        "chart_ticks_half_vertical": [],
        "chart_gridlines_half_vertical": [],
        "chart_asteroids_quadrant": [],
        "chart_ticks_quadrant": [],
        "chart_gridlines_quadrant": [],
        "closest_list": [],
        "total_count": 0,
        "upcoming_count": 0,
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
    # Timeline spans 7 days total: 3.5 days past to 3.5 days future
    start_ms = now_ms - int(3.5 * 24 * 3600 * 1000)
    end_ms = now_ms + int(3.5 * 24 * 3600 * 1000)
    total_window_ms = end_ms - start_ms
    
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
                
            # Filter encounters within the 7-day timeline window
            if start_ms <= epoch <= end_ms:
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
                    "epoch": epoch,
                    "is_past": epoch < now_ms
                })
                
    closest_list_payload = []
    warning_active = False
    closest_dist_ld = "—"
    closest_name = "—"
    max_size_m = "—"
    upcoming_count = sum(1 for c in candidates if not c["is_past"])
    
    if candidates:
        # Closest approach across entire window
        closest_candidate = min(candidates, key=lambda c: c["miss_distance_ld"])
        closest_dist_ld = f"{closest_candidate['miss_distance_ld']:.1f} LD"
        closest_name = closest_candidate["name"]
        
        # Max diameter
        max_diam_candidate = max(candidates, key=lambda c: c["avg_diameter"])
        max_size_m = f"{int(max_diam_candidate['avg_diameter'])}m"
        
        # List of closest upcoming encounters (or sorted by distance)
        upcoming_candidates = [c for c in candidates if not c["is_past"]]
        display_candidates = upcoming_candidates if upcoming_candidates else candidates
        sorted_by_distance = sorted(display_candidates, key=lambda c: c["miss_distance_ld"])
        closest_3 = sorted_by_distance[:3]
        
        for item in closest_3:
            if item["is_hazardous"] and item["miss_distance_ld"] <= 15.0:
                warning_active = True
                
            diff_ms = item["epoch"] - now_ms
            hours_diff = int(diff_ms / (3600 * 1000))
            is_neg = hours_diff < 0
            abs_hours = abs(hours_diff)
            days = abs_hours // 24
            rem_hours = abs_hours % 24
            
            prefix = "T-" if is_neg else "T+"
            if days > 0:
                time_str = f"{prefix}{days}d {rem_hours}h"
            else:
                time_str = f"{prefix}{rem_hours}h"
                
            closest_list_payload.append({
                "name": item["name"],
                "dist_ld": f"{item['miss_distance_ld']:.1f}",
                "vel_kph": f"{int(item['velocity_kph']):,}",
                "size_m": f"{int(item['avg_diameter'])}m",
                "is_hazardous": bool(item["is_hazardous"]),
                "time_str": time_str
            })
            
    # Chart coordinate setups for each layout
    layouts = {
        "full": {
            "width": 360, "height": 260,
            "x_min": 40, "x_max": 345,
            "y_min": 25, "y_max": 230,
            "max_ld": 40.0,
            "grid_levels": [10, 20, 30, 40],
            "limit": 12
        },
        "half_horizontal": {
            "width": 260, "height": 150,
            "x_min": 35, "x_max": 245,
            "y_min": 18, "y_max": 128,
            "max_ld": 40.0,
            "grid_levels": [10, 20, 30, 40],
            "limit": 6
        },
        "half_vertical": {
            "width": 360, "height": 180,
            "x_min": 40, "x_max": 345,
            "y_min": 20, "y_max": 155,
            "max_ld": 40.0,
            "grid_levels": [10, 20, 30, 40],
            "limit": 8
        },
        "quadrant": {
            "width": 160, "height": 120,
            "x_min": 25, "x_max": 145,
            "y_min": 15, "y_max": 100,
            "max_ld": 40.0,
            "grid_levels": [20, 40],
            "limit": 4
        }
    }
    
    outputs = {}
    
    for name, cfg in layouts.items():
        x_min = cfg["x_min"]
        x_max = cfg["x_max"]
        y_min = cfg["y_min"]
        y_max = cfg["y_max"]
        plot_w = x_max - x_min
        plot_h = y_max - y_min
        max_ld = cfg["max_ld"]
        now_x = round(x_min + plot_w / 2.0, 1)
        
        # 1. Compute Horizontal Gridlines
        gridlines = []
        for level in cfg["grid_levels"]:
            y_pos = round(y_max - (level / max_ld) * plot_h, 1)
            gridlines.append({
                "y": y_pos,
                "label": f"{level} LD",
                "x_label": x_min - 4
            })
            
        # 2. Compute Day Ticks along X-axis
        ticks = []
        # Generate ticks for days -3, -2, -1, 0 (NOW), +1, +2, +3
        for day_offset in range(-3, 4):
            t_norm = (day_offset + 3.5) / 7.0
            x_pos = round(x_min + t_norm * plot_w, 1)
            
            if day_offset == 0:
                label = "NOW"
            elif day_offset < 0:
                label = f"{day_offset}d"
            else:
                label = f"+{day_offset}d"
                
            ticks.append({
                "x": x_pos,
                "label": label,
                "is_now": day_offset == 0,
                "y_tick_top": y_max,
                "y_tick_bottom": y_max + 4,
                "y_label": y_max + 14
            })
            
        # 3. Compute Asteroid Coordinates
        radar_candidates = [c for c in candidates if c["miss_distance_ld"] <= max_ld]
        radar_candidates = sorted(radar_candidates, key=lambda c: c["miss_distance_ld"])[:cfg["limit"]]
        
        asteroids_payload = []
        for item in radar_candidates:
            # X coordinate: Linear time
            t_norm = (item["epoch"] - start_ms) / total_window_ms
            t_norm = max(0.0, min(1.0, t_norm))
            x_pos = x_min + t_norm * plot_w
            
            # Y coordinate: Linear distance (0 LD is at y_max, max_ld is at y_min)
            d_norm = item["miss_distance_ld"] / max_ld
            d_norm = max(0.0, min(1.0, d_norm))
            y_pos = y_max - d_norm * plot_h
            
            # Radius based on size
            if item["avg_diameter"] < 30:
                r = 3
            elif item["avg_diameter"] < 100:
                r = 5
            elif item["avg_diameter"] < 300:
                r = 7
            else:
                r = 9
                
            if name == "quadrant":
                r = max(2, int(r * 0.6))
            elif name == "half_horizontal":
                r = max(3, int(r * 0.8))
                
            # Label position
            if x_pos >= now_x:
                label_x = x_pos + r + 3
                anchor = "start"
                if label_x > cfg["width"] - 25:
                    label_x = x_pos - r - 3
                    anchor = "end"
            else:
                label_x = x_pos - r - 3
                anchor = "end"
                if label_x < 5:
                    label_x = x_pos + r + 3
                    anchor = "start"
                    
            label_y = y_pos + 3
            
            asteroids_payload.append({
                "name": item["name"],
                "x": round(x_pos, 1),
                "y": round(y_pos, 1),
                "r": r,
                "label_x": round(label_x, 1),
                "label_y": round(label_y, 1),
                "anchor": anchor,
                "is_hazardous": bool(item["is_hazardous"]),
                "is_past": bool(item["is_past"]),
                "dist_ld": round(item["miss_distance_ld"], 1)
            })
            
        outputs[f"chart_asteroids_{name}"] = asteroids_payload
        outputs[f"chart_ticks_{name}"] = ticks
        outputs[f"chart_gridlines_{name}"] = gridlines
        outputs[f"now_x_{name}"] = now_x

    # Sector status message
    if not candidates:
        status_msg = "SYSTEM STATUS: NOMINAL // CLEAR SPACE"
    elif warning_active:
        status_msg = "WARNING: POTENTIALLY HAZARDOUS OBJECT IN SECTOR"
    else:
        status_msg = "SYSTEM STATUS: NOMINAL // ALL ENCOUNTERS SAFE"

    result = {
        "closest_list": closest_list_payload,
        "total_count": total_objects_in_range,
        "upcoming_count": upcoming_count,
        "closest_dist_ld": closest_dist_ld,
        "closest_name": closest_name,
        "max_size_m": max_size_m,
        "system_status": status_msg,
        "last_updated": last_updated_str,
        "has_asteroids": len(candidates) > 0,
        "candidates": candidates
    }
    
    result.update(outputs)
    return result
