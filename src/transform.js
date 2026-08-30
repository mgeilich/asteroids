/**
 * TRMNL Serverless Transform Script for "Asteroids" (NEO Timeline Monitor)
 * 
 * Supports 3 data ingestion modes:
 * 1. Precalculated backend payload (from Cloud Functions / proxy cache)
 * 2. Raw NASA NeoWS API feed (near_earth_objects dictionary)
 * 3. Static/sample candidate payload (settings.yml test data)
 */

function cleanAsteroidName(rawName) {
  if (!rawName) return "—";
  let name = rawName.replace(/\(/g, "").replace(/\)/g, "").trim();
  let parts = name.split(/\s+/);
  if (parts.length > 1 && /^\d+$/.test(parts[0])) {
    name = parts.slice(1).join(" ");
  }
  if (name.length > 7) {
    name = name.substring(0, 5) + "..";
  }
  return name;
}

function run(input) {
  const LAYOUTS = {
    full: {
      width: 360, height: 260,
      x_min: 46, x_max: 350,
      y_min: 25, y_max: 230,
      grid_levels: [2, 5, 10, 25, 50, 100, 200],
      limit: 18,
      min_dx: 26, min_dy: 14, min_r_sq: 400
    },
    half_horizontal: {
      width: 280, height: 150,
      x_min: 48, x_max: 270,
      y_min: 22, y_max: 128,
      grid_levels: [5, 20, 100, 200],
      limit: 8,
      min_dx: 24, min_dy: 12, min_r_sq: 324
    },
    half_vertical: {
      width: 360, height: 160,
      x_min: 48, x_max: 350,
      y_min: 20, y_max: 135,
      grid_levels: [5, 20, 50, 100, 200],
      limit: 10,
      min_dx: 26, min_dy: 13, min_r_sq: 361
    },
    quadrant: {
      width: 160, height: 120,
      x_min: 35, x_max: 145,
      y_min: 15, y_max: 100,
      grid_levels: [10, 50, 200],
      limit: 5,
      min_dx: 20, min_dy: 10, min_r_sq: 256
    }
  };

  const MIN_LD = 1.0;
  const MAX_LD = 200.0;
  const LOG_MIN = Math.log10(MIN_LD);
  const LOG_MAX = Math.log10(MAX_LD);
  const LOG_RANGE = LOG_MAX - LOG_MIN;

  const emptyPayload = {
    scan_completed: false,
    system_status: "SYSTEM OFFLINE: NO DATA",
    is_alert: false,
    last_error: "Telemetry feed unreachable. Checking for updates...",
    total_count: "—",
    upcoming_count: "—",
    closest_dist_ld: "—",
    closest_name: "—",
    max_size_m: "—",
    last_updated: "—",
    chart_asteroids_full: [],
    chart_ticks_full: [],
    chart_gridlines_full: [],
    chart_asteroids_half_horizontal: [],
    chart_ticks_half_horizontal: [],
    chart_gridlines_half_horizontal: [],
    chart_asteroids_half_vertical: [],
    chart_ticks_half_vertical: [],
    chart_gridlines_half_vertical: [],
    chart_asteroids_quadrant: [],
    chart_ticks_quadrant: [],
    chart_gridlines_quadrant: [],
    closest_list: []
  };

  try {
    if (!input || typeof input !== 'object' || Object.keys(input).length === 0) {
      return emptyPayload;
    }

    const now = new Date();
    const now_ms = now.getTime();
    const end_ms = now_ms + (7 * 24 * 3600 * 1000);
    const total_window_ms = end_ms - now_ms;

    // Mode 1: Precalculated layout payload (from backend Cloud Function)
    const hasPrecomputed = input &&
      Array.isArray(input.chart_ticks_full) && input.chart_ticks_full.length > 0 &&
      Array.isArray(input.chart_asteroids_full);

    if (hasPrecomputed) {
      const isPrecomputedAlert = (input.is_alert !== undefined && input.is_alert !== null) 
        ? Boolean(input.is_alert)
        : (input.system_status ? (input.system_status.toLowerCase().includes("warning") || input.system_status.toLowerCase().includes("alert")) : false);

      return {
        scan_completed: true,
        system_status: input.system_status || "SYSTEM NOMINAL",
        is_alert: isPrecomputedAlert,
        last_error: input.last_error || "",
        total_count: (input.total_count !== undefined && input.total_count !== null) ? input.total_count : (input.chart_asteroids_full ? input.chart_asteroids_full.length : "—"),
        upcoming_count: (input.upcoming_count !== undefined && input.upcoming_count !== null) ? input.upcoming_count : "—",
        closest_dist_ld: input.closest_dist_ld || "—",
        closest_name: input.closest_name || "—",
        max_size_m: input.max_size_m || "—",
        last_updated: input.last_updated || now.toUTCString(),
        chart_asteroids_full: input.chart_asteroids_full || [],
        chart_ticks_full: input.chart_ticks_full || [],
        chart_gridlines_full: input.chart_gridlines_full || [],
        chart_asteroids_half_horizontal: input.chart_asteroids_half_horizontal || [],
        chart_ticks_half_horizontal: input.chart_ticks_half_horizontal || [],
        chart_gridlines_half_horizontal: input.chart_gridlines_half_horizontal || [],
        chart_asteroids_half_vertical: input.chart_asteroids_half_vertical || [],
        chart_ticks_half_vertical: input.chart_ticks_half_vertical || [],
        chart_gridlines_half_vertical: input.chart_gridlines_half_vertical || [],
        chart_asteroids_quadrant: input.chart_asteroids_quadrant || [],
        chart_ticks_quadrant: input.chart_ticks_quadrant || [],
        chart_gridlines_quadrant: input.chart_gridlines_quadrant || [],
        closest_list: input.closest_list || []
      };
    }

    // Mode 2 & 3: Ingest from raw NASA NeoWS feed or candidates list
    let rawCandidates = [];
    if (input.near_earth_objects && typeof input.near_earth_objects === 'object' && input.near_earth_objects !== null && !Array.isArray(input.near_earth_objects)) {
      try {
        Object.keys(input.near_earth_objects).forEach(dateKey => {
          const list = input.near_earth_objects[dateKey];
          if (Array.isArray(list)) {
            list.forEach(ast => {
              if (ast && ast.close_approach_data && Array.isArray(ast.close_approach_data) && ast.close_approach_data.length > 0) {
                const app = ast.close_approach_data[0];
                const epoch = Number(app.epoch_date_close_approach);
                if (epoch && epoch >= now_ms && epoch <= end_ms) {
                  const diamMin = (ast.estimated_diameter && ast.estimated_diameter.meters) ? ast.estimated_diameter.meters.estimated_diameter_min : 50;
                  const diamMax = (ast.estimated_diameter && ast.estimated_diameter.meters) ? ast.estimated_diameter.meters.estimated_diameter_max : 150;
                  rawCandidates.push({
                    id: ast.id,
                    name: ast.name,
                    miss_distance_ld: parseFloat(app.miss_distance ? app.miss_distance.lunar : 10) || 10,
                    velocity_kph: parseFloat(app.relative_velocity ? app.relative_velocity.kilometers_per_hour : 35000) || 35000,
                    avg_diameter: (diamMin + diamMax) / 2,
                    is_hazardous: Boolean(ast.is_potentially_hazardous_asteroid),
                    epoch: epoch
                  });
                }
              }
            });
          }
        });
      } catch (ingestErr) {
        console.error("[transform.js] Error ingesting NASA raw feed:", ingestErr);
      }
    } else if (Array.isArray(input.candidates) && input.candidates.length > 0) {
      rawCandidates = input.candidates;
    }

    // If no valid candidates or payload data found, return scan_completed: false
    if (rawCandidates.length === 0) {
      return emptyPayload;
    }

    let candidates = [];
    let isSynthetic = false;

    // For test data where epochs are omitted, compute relative test schedule
    rawCandidates.forEach((c, idx) => {
      let epoch = Number(c.epoch);
      if (!epoch || isNaN(epoch) || epoch === 0 || epoch < now_ms) {
        epoch = now_ms + ((idx + 0.5) * 1.5 * 24 * 3600 * 1000);
        isSynthetic = true;
      }
      const missDist = Number(c.miss_distance_ld) || 0;
      const diam = Number(c.avg_diameter) || 50;
      const isHaz = Boolean(c.is_hazardous);
      
      candidates.push({
        id: c.id || String(idx),
        name: cleanAsteroidName(c.name),
        miss_distance_ld: missDist,
        velocity_kph: Number(c.velocity_kph) || 30000,
        avg_diameter: diam,
        is_hazardous: isHaz,
        epoch: epoch,
        is_past: false
      });
    });

    // Sort & compute metrics
    const sortedByDist = [...candidates].sort((a, b) => a.miss_distance_ld - b.miss_distance_ld);
    const closest = sortedByDist[0];
    const closest_dist_ld = closest.miss_distance_ld.toFixed(1) + " LD";
    const closest_name = closest.name;

    const maxDiamObj = [...candidates].sort((a, b) => b.avg_diameter - a.avg_diameter)[0];
    const max_size_m = Math.round(maxDiamObj.avg_diameter) + "m";

    let warningActive = false;
    const closestList = [];
    const closest3 = [...candidates].sort((a, b) => a.miss_distance_ld - b.miss_distance_ld).slice(0, 3);

    closest3.forEach(item => {
      if (item.is_hazardous && item.miss_distance_ld <= 15.0) {
        warningActive = true;
      }
      const diffMs = Math.max(0, item.epoch - now_ms);
      const hoursDiff = Math.floor(diffMs / (3600 * 1000));
      const days = Math.floor(hoursDiff / 24);
      const remHours = hoursDiff % 24;
      const timeStr = days > 0 ? `T+${days}d ${remHours}h` : `T+${remHours}h`;

      closestList.push({
        name: item.name,
        dist_ld: item.miss_distance_ld.toFixed(1),
        vel_kph: Math.round(item.velocity_kph).toLocaleString(),
        size_m: Math.round(item.avg_diameter) + "m",
        is_hazardous: !!item.is_hazardous,
        time_str: timeStr
      });
    });

    const result = {
      scan_completed: true,
      system_status: isSynthetic ? "DEMO MODE: SAMPLE ASTEROID DATA" : (warningActive ? "WARNING: POTENTIALLY HAZARDOUS OBJECT IN SECTOR" : "SYSTEM STATUS: NOMINAL // ALL ENCOUNTERS SAFE"),
      is_alert: warningActive,
      last_error: "",
      total_count: (input.total_count !== undefined && input.total_count !== null) ? input.total_count : candidates.length,
      upcoming_count: candidates.length,
      closest_dist_ld: closest_dist_ld,
      closest_name: closest_name,
      max_size_m: max_size_m,
      last_updated: now.toUTCString(),
      closest_list: closestList
    };

    // Priority sort: Hazardous -> Distance -> Diameter
    const prioritized = [...candidates]
      .filter(c => c.miss_distance_ld <= MAX_LD)
      .sort((a, b) => {
        if (a.is_hazardous !== b.is_hazardous) return b.is_hazardous ? 1 : -1;
        if (a.miss_distance_ld !== b.miss_distance_ld) return a.miss_distance_ld - b.miss_distance_ld;
        return b.avg_diameter - a.avg_diameter;
      });

    // Calculate layout coordinates
    Object.keys(LAYOUTS).forEach(key => {
      try {
        const cfg = LAYOUTS[key];
        const plotW = cfg.x_max - cfg.x_min;
        const plotH = cfg.y_max - cfg.y_min;

        // Logarithmic Gridlines
        const gridlines = cfg.grid_levels.map(level => {
          const logVal = Math.log10(Math.max(MIN_LD, level));
          const norm = (logVal - LOG_MIN) / LOG_RANGE;
          return {
            y: parseFloat((cfg.y_max - norm * plotH).toFixed(1)),
            label: `${level} LD`,
            x_label: cfg.x_min - 4
          };
        });

        // Ticks (0d to +7d)
        const ticks = [];
        for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
          const tNorm = dayOffset / 7.0;
          const xPos = parseFloat((cfg.x_min + tNorm * plotW).toFixed(1));
          let label = dayOffset === 0 ? "NOW" : `+${dayOffset}d`;
          ticks.push({
            x: xPos,
            label: label,
            is_now: dayOffset === 0,
            y_tick_top: cfg.y_max,
            y_tick_bottom: cfg.y_max + 4,
            y_label: cfg.y_max + 14
          });
        }

        // Asteroids with non-overlap collision filter
        const selectedAsteroids = [];

        for (let i = 0; i < prioritized.length; i++) {
          if (selectedAsteroids.length >= cfg.limit) break;
          const item = prioritized[i];

          let tNorm = (item.epoch - now_ms) / total_window_ms;
          tNorm = Math.max(0.0, Math.min(1.0, tNorm));
          const xPos = parseFloat((cfg.x_min + tNorm * plotW).toFixed(1));

          const distClamped = Math.max(MIN_LD, Math.min(MAX_LD, item.miss_distance_ld));
          const dNorm = Math.max(0.0, Math.min(1.0, (Math.log10(distClamped) - LOG_MIN) / LOG_RANGE));
          const yPos = parseFloat((cfg.y_max - dNorm * plotH).toFixed(1));

          // Overlap check
          let overlap = false;
          for (let j = 0; j < selectedAsteroids.length; j++) {
            const ex = selectedAsteroids[j];
            const dx = Math.abs(xPos - ex.x);
            const dy = Math.abs(yPos - ex.y);
            if ((dx < cfg.min_dx && dy < cfg.min_dy) || (dx * dx + dy * dy < cfg.min_r_sq)) {
              overlap = true;
              break;
            }
          }

          if (overlap) continue;

          let r = 4;
          if (item.avg_diameter < 30) r = 3;
          else if (item.avg_diameter < 100) r = 5;
          else if (item.avg_diameter < 300) r = 7;
          else r = 9;

          if (key === "quadrant") r = Math.max(2, Math.round(r * 0.6));
          else if (key === "half_horizontal") r = Math.max(3, Math.round(r * 0.8));

          let labelX = xPos + r + 3;
          let anchor = "start";
          if (xPos + r + 3 > cfg.x_max - 15 || xPos + r + 28 > cfg.width) {
            labelX = xPos - r - 3;
            anchor = "end";
          } else if (xPos - r - 3 < cfg.x_min + 5) {
            labelX = xPos + r + 3;
            anchor = "start";
          } else {
            labelX = xPos + r + 3;
            anchor = "start";
          }

          selectedAsteroids.push({
            name: item.name,
            x: xPos,
            y: yPos,
            r: r,
            label_x: parseFloat(labelX.toFixed(1)),
            label_y: parseFloat((yPos + 3).toFixed(1)),
            anchor: anchor,
            is_hazardous: !!item.is_hazardous,
            dist_ld: parseFloat(item.miss_distance_ld.toFixed(1))
          });
        }

        result[`chart_asteroids_${key}`] = selectedAsteroids.filter(a => isFinite(a.x) && isFinite(a.y));
        result[`chart_ticks_${key}`] = ticks;
        result[`chart_gridlines_${key}`] = gridlines;
      } catch (layoutErr) {
        console.error(`[transform.js] Error calculating layout ${key}:`, layoutErr);
        result[`chart_asteroids_${key}`] = [];
        result[`chart_ticks_${key}`] = [];
        result[`chart_gridlines_${key}`] = [];
      }
    });

    return result;
  } catch (err) {
    console.error("[transform.js] Error in transform script:", err);
    return {
      ...emptyPayload,
      last_error: "Telemetry error: " + (err && err.message ? err.message : String(err))
    };
  }
}
