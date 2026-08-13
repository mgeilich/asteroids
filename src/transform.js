/**
 * TRMNL Serverless Transform Script for "Asteroids" (NEO Radar Monitor)
 * Can process raw NASA NeoWS API response directly, OR act as a pass-through/enricher.
 */

function cleanAsteroidName(rawName) {
  if (!rawName) return "—";
  let name = rawName.replace(/\(/g, "").replace(/\)/g, "").trim();
  let parts = name.split(/\s+/);
  if (parts.length > 1 && /^\d+$/.test(parts[0])) {
    return parts.slice(1).join(" ");
  }
  return name;
}

function run(input) {
  // Radar layouts configuration
  const LAYOUTS = {
    full: { cx: 220, cy: 220, R_max: 195, D_max: 40, tick_inner: 196, tick_outer: 204, tick_label: 214 },
    half_horizontal: { cx: 110, cy: 80, R_max: 65, D_max: 40, tick_inner: 62, tick_outer: 68, tick_label: 75 },
    half_vertical: { cx: 190, cy: 175, R_max: 150, D_max: 40, tick_inner: 143, tick_outer: 155, tick_label: 165 },
    quadrant: { cx: 75, cy: 75, R_max: 67, D_max: 40, tick_inner: 64, tick_outer: 70, tick_label: 0 }
  };

  // If the input is empty or invalid
  if (!input) {
    return {
      system_status: "SYSTEM OFFLINE: NO DATA RECEIVED",
      total_count: "—",
      closest_dist_ld: "—",
      closest_name: "—",
      last_updated: "—",
      radar_ticks_full: [],
      radar_asteroids_full: [],
      radar_ticks_half_horizontal: [],
      radar_asteroids_half_horizontal: [],
      radar_ticks_half_vertical: [],
      radar_asteroids_half_vertical: [],
      radar_ticks_quadrant: [],
      radar_asteroids_quadrant: [],
      closest_list: []
    };
  }

  // Handle case where input is from our Python Cloud Function
  // If the Cloud Function already did the processing, we pass it through but calculate 4-way layout coordinates if not present
  const has_neo_dict = input.near_earth_objects ? true : false;
  
  const now = new Date();
  const now_ms = now.getTime();
  const end_ms = now_ms + 7 * 24 * 3600 * 1000;
  
  let candidates = [];
  let total_count = 0;
  
  if (has_neo_dict) {
    const neo_dict = input.near_earth_objects;
    for (const date_str in neo_dict) {
      const asteroid_list = neo_dict[date_str];
      for (const asteroid of asteroid_list) {
        if (!asteroid.close_approach_data || asteroid.close_approach_data.length === 0) continue;
        const approach = asteroid.close_approach_data[0];
        const epoch = approach.epoch_date_close_approach;
        if (!epoch) continue;
        
        if (epoch >= now_ms && epoch <= end_ms) {
          total_count++;
          const diam_min = asteroid.estimated_diameter.meters.estimated_diameter_min;
          const diam_max = asteroid.estimated_diameter.meters.estimated_diameter_max;
          const avg_diam = (diam_min + diam_max) / 2;
          const miss_dist = parseFloat(approach.miss_distance.lunar);
          const vel = parseFloat(approach.relative_velocity.kilometers_per_hour);
          
          candidates.push({
            id: asteroid.id,
            name: cleanAsteroidName(asteroid.name),
            miss_distance_ld: miss_dist,
            velocity_kph: vel,
            avg_diameter: avg_diam,
            is_hazardous: asteroid.is_potentially_hazardous_asteroid,
            epoch: epoch
          });
        }
      }
    }
  } else if (input.candidates) {
    candidates = input.candidates;
    total_count = input.total_count || candidates.length;
  } else if (input.radar_asteroids) {
    // If we only have precalculated full-layout asteroids, we extract their properties to reconstruct candidates
    candidates = input.radar_asteroids.map(a => {
      // Map back to relative values
      const x_diff = a.x - 220;
      const y_diff = 220 - a.y; // cy is 220
      const R = Math.sqrt(x_diff * x_diff + y_diff * y_diff);
      const miss_dist = (R / 195.0) * 40.0;
      
      let angle_rad = Math.atan2(x_diff, y_diff);
      if (angle_rad < 0) angle_rad += 2 * Math.PI;
      const epoch = now_ms + (angle_rad / (2 * Math.PI)) * (end_ms - now_ms);
      
      let avg_diam = 20;
      if (a.r === 5) avg_diam = 80;
      else if (a.r === 7) avg_diam = 200;
      else if (a.r === 9) avg_diam = 400;
      
      return {
        name: a.name,
        miss_distance_ld: miss_dist,
        avg_diameter: avg_diam,
        is_hazardous: a.is_hazardous,
        epoch: epoch
      };
    });
    total_count = input.total_count || candidates.length;
  }

  // Fallback if no asteroids found
  if (candidates.length === 0) {
    return {
      system_status: "SYSTEM STATUS: NOMINAL // CLEAR SPACE",
      total_count: 0,
      closest_dist_ld: "—",
      closest_name: "—",
      last_updated: now.toUTCString(),
      radar_ticks_full: computeTicks(LAYOUTS.full) || [],
      radar_asteroids_full: [],
      radar_ticks_half_horizontal: computeTicks(LAYOUTS.half_horizontal) || [],
      radar_asteroids_half_horizontal: [],
      radar_ticks_half_vertical: computeTicks(LAYOUTS.half_vertical) || [],
      radar_asteroids_half_vertical: [],
      radar_ticks_quadrant: computeTicks(LAYOUTS.quadrant) || [],
      radar_asteroids_quadrant: [],
      closest_list: []
    };
  }

  // Sort and extract metrics
  const sorted_by_distance = [...candidates].sort((a, b) => a.miss_distance_ld - b.miss_distance_ld);
  const closest_candidate = sorted_by_distance[0];
  const closest_dist_ld = closest_candidate.miss_distance_ld.toFixed(1) + " LD";
  const closest_name = closest_candidate.name;
  
  let warning_active = false;
  const closest_list_payload = [];
  const closest_3 = sorted_by_distance.slice(0, 3);
  
  for (const item of closest_3) {
    if (item.is_hazardous && item.miss_distance_ld <= 15.0) {
      warning_active = true;
    }
    const diff_ms = item.epoch - now_ms;
    const hours_to = Math.floor(diff_ms / 3600000);
    const days_to = Math.floor(hours_to / 24);
    const rem_hours = hours_to % 24;
    const time_str = days_to > 0 ? `T+${days_to}d ${rem_hours}h` : `T+${rem_hours}h`;
    
    closest_list_payload.push({
      name: item.name,
      dist_ld: item.miss_distance_ld.toFixed(1),
      size_m: Math.round(item.avg_diameter) + "m",
      is_hazardous: item.is_hazardous ? "HAZARD" : "",
      time_str: time_str
    });
  }


  const tomorrow_midnight = new Date();
  tomorrow_midnight.setUTCHours(24, 0, 0, 0);

  // Helper to compute ticks
  function computeTicks(layout) {
    const ticks = [];
    for (let i = 0; i < 7; i++) {
      const tick_time = tomorrow_midnight.getTime() + i * 24 * 3600 * 1000;
      if (tick_time >= now_ms && tick_time <= end_ms) {
        const t_norm = (tick_time - now_ms) / (end_ms - now_ms);
        const angle = t_norm * 360.0;
        const alpha = (angle * Math.PI) / 180.0;
        
        const x1 = layout.cx + layout.tick_inner * Math.sin(alpha);
        const y1 = layout.cy - layout.tick_inner * Math.cos(alpha);
        const x2 = layout.cx + layout.tick_outer * Math.sin(alpha);
        const y2 = layout.cy - layout.tick_outer * Math.cos(alpha);
        
        let label_x = 0;
        let label_y = 0;
        let anchor = "middle";
        
        if (layout.tick_label > 0) {
          const xl = layout.cx + layout.tick_label * Math.sin(alpha);
          const yl = layout.cy - layout.tick_label * Math.cos(alpha);
          
          if (angle > 15.0 && angle < 165.0) anchor = "start";
          else if (angle > 195.0 && angle < 345.0) anchor = "end";
          
          label_x = xl;
          if (angle < 15.0 || angle > 345.0) {
            label_y = yl - 2;
          } else if (angle > 165.0 && angle < 195.0) {
            label_y = yl + 8;
          } else {
            label_y = yl + 3;
          }
        }
        
        const date = new Date(tick_time);
        const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        const label = days[date.getUTCDay()];
        
        ticks.push({
          x1: parseFloat(x1.toFixed(1)),
          y1: parseFloat(y1.toFixed(1)),
          x2: parseFloat(x2.toFixed(1)),
          y2: parseFloat(y2.toFixed(1)),
          label_x: parseFloat(label_x.toFixed(1)),
          label_y: parseFloat(label_y.toFixed(1)),
          anchor: anchor,
          label: label
        });
      }
    }
    return ticks;
  }

  // Helper to compute asteroids
  function computeAsteroids(layout) {
    const radar_candidates = candidates
      .filter(c => c.miss_distance_ld <= layout.D_max && c.name && c.name.trim() !== '')
      .sort((a, b) => {
        if (a.is_hazardous && !b.is_hazardous) return -1;
        if (!a.is_hazardous && b.is_hazardous) return 1;
        return a.miss_distance_ld - b.miss_distance_ld;
      })
      .slice(0, 10);
      
    return radar_candidates.map(item => {
      const t_norm = (item.epoch - now_ms) / (end_ms - now_ms);
      const angle = t_norm * 360.0;
      const alpha = (angle * Math.PI) / 180.0;
      
      const R = layout.R_max * (item.miss_distance_ld / layout.D_max);
      const x = layout.cx + R * Math.sin(alpha);
      const y = layout.cy - R * Math.cos(alpha);
      
      let r = 3;
      if (item.avg_diameter < 30) r = 3;
      else if (item.avg_diameter < 100) r = 5;
      else if (item.avg_diameter < 300) r = 7;
      else r = 9;
      
      if (layout.cx === 75) {
        r = Math.max(2, Math.round(r * 0.6));
      }
      
      let label_x = 0;
      let anchor = "start";
      if (x >= layout.cx) {
        label_x = x + r + 4;
        anchor = "start";
      } else {
        label_x = x - r - 4;
        anchor = "end";
      }
      const label_y = y + 3;
      
      const parts = item.name.split(" ");
      let name_part_1 = "";
      let name_part_2 = "";
      let label_x1 = label_x;
      let label_y1 = label_y;
      let label_x2 = null;
      let label_y2 = null;

      if (parts.length > 1) {
        name_part_1 = parts[0];
        name_part_2 = parts.slice(1).join(" ");
        label_y1 = label_y - 5;
        label_y2 = label_y + 7;
        label_x2 = label_x;
      } else {
        name_part_1 = item.name;
      }
      
      return {
        name: item.name,
        name_part_1: name_part_1,
        name_part_2: name_part_2 ? name_part_2 : null,
        x: parseFloat(x.toFixed(1)),
        y: parseFloat(y.toFixed(1)),
        r: r,
        label_x1: parseFloat(label_x1.toFixed(1)),
        label_y1: parseFloat(label_y1.toFixed(1)),
        label_x2: label_x2 ? parseFloat(label_x2.toFixed(1)) : null,
        label_y2: label_y2 ? parseFloat(label_y2.toFixed(1)) : null,
        anchor: anchor,
        is_hazardous: item.is_hazardous
      };
    });
  }

  const system_status = warning_active
    ? "WARNING: POTENTIALLY HAZARDOUS OBJECT IN SECTOR"
    : "SYSTEM STATUS: NOMINAL // ALL ENCOUNTERS SAFE";

  const last_updated = now.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }) + " UTC";

  return {
    system_status: system_status,
    total_count: total_count,
    closest_dist_ld: closest_dist_ld,
    closest_name: closest_name,
    last_updated: last_updated,
    radar_ticks_full: computeTicks(LAYOUTS.full) || [],
    radar_asteroids_full: computeAsteroids(LAYOUTS.full) || [],
    radar_ticks_half_horizontal: computeTicks(LAYOUTS.half_horizontal) || [],
    radar_asteroids_half_horizontal: computeAsteroids(LAYOUTS.half_horizontal) || [],
    radar_ticks_half_vertical: computeTicks(LAYOUTS.half_vertical) || [],
    radar_asteroids_half_vertical: computeAsteroids(LAYOUTS.half_vertical) || [],
    radar_ticks_quadrant: computeTicks(LAYOUTS.quadrant) || [],
    radar_asteroids_quadrant: computeAsteroids(LAYOUTS.quadrant) || [],
    closest_list: closest_list_payload || []
  };
}
