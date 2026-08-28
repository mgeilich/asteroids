/**
 * TRMNL Serverless Transform Script for "Asteroids" (NEO Timeline Monitor)
 * Supports future 7-day timeline calculation and precalculated payload pass-through.
 */

function cleanAsteroidName(rawName) {
  if (!rawName) return "—";
  let name = rawName.replace(/\(/g, "").replace(/\)/g, "").trim();
  let parts = name.split(/\s+/);
  if (parts.length > 1 && /^\d+$/.test(parts[0])) {
    name = parts.slice(1).join(" ");
  }
  if (name.length > 8) {
    name = name.substring(0, 6) + "..";
  }
  return name;
}

function run(input) {
  const LAYOUTS = {
    full: {
      width: 360, height: 260,
      x_min: 40, x_max: 345,
      y_min: 25, y_max: 230,
      max_ld: 40.0,
      grid_levels: [10, 20, 30, 40],
      limit: 12
    },
    half_horizontal: {
      width: 260, height: 150,
      x_min: 35, x_max: 245,
      y_min: 18, y_max: 128,
      max_ld: 40.0,
      grid_levels: [10, 20, 30, 40],
      limit: 6
    },
    half_vertical: {
      width: 360, height: 180,
      x_min: 40, x_max: 345,
      y_min: 20, y_max: 155,
      max_ld: 40.0,
      grid_levels: [10, 20, 30, 40],
      limit: 8
    },
    quadrant: {
      width: 160, height: 120,
      x_min: 25, x_max: 145,
      y_min: 15, y_max: 100,
      max_ld: 40.0,
      grid_levels: [20, 40],
      limit: 4
    }
  };

  const emptyPayload = {
    scan_completed: false,
    system_status: "SYSTEM OFFLINE: NO DATA",
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
    if (!input || typeof input !== 'object') {
      return emptyPayload;
    }

    const now = new Date();
    const now_ms = now.getTime();
    const end_ms = now_ms + (7 * 24 * 3600 * 1000);
    const total_window_ms = end_ms - now_ms;

    // Check if valid precalculated payload is provided
    const hasPrecomputed = input &&
      Array.isArray(input.chart_ticks_full) && input.chart_ticks_full.length > 0 &&
      Array.isArray(input.chart_asteroids_full);

    if (hasPrecomputed) {
      return {
        scan_completed: true,
        system_status: input.system_status || "SYSTEM NOMINAL",
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

    // Dynamic computation from candidates
    let rawCandidates = [];
    if (Array.isArray(input.candidates)) {
      rawCandidates = input.candidates;
    }

    let candidates = [];
    let isSynthetic = false;

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

    // If no candidates
    if (candidates.length === 0) {
      return {
        ...emptyPayload,
        scan_completed: true,
        system_status: "SYSTEM STATUS: NOMINAL // CLEAR SPACE",
        total_count: 0,
        upcoming_count: 0,
        last_updated: now.toUTCString()
      };
    }

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
      total_count: (input.total_count !== undefined && input.total_count !== null) ? input.total_count : candidates.length,
      upcoming_count: candidates.length,
      closest_dist_ld: closest_dist_ld,
      closest_name: closest_name,
      max_size_m: max_size_m,
      last_updated: now.toUTCString(),
      closest_list: closestList
    };

    // Calculate layout coordinates
    Object.keys(LAYOUTS).forEach(key => {
      const cfg = LAYOUTS[key];
      const plotW = cfg.x_max - cfg.x_min;
      const plotH = cfg.y_max - cfg.y_min;

      // Gridlines
      const gridlines = cfg.grid_levels.map(level => ({
        y: parseFloat((cfg.y_max - (level / cfg.max_ld) * plotH).toFixed(1)),
        label: `${level} LD`,
        x_label: cfg.x_min - 4
      }));

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

      // Asteroid dots
      const inRange = candidates.filter(c => c.miss_distance_ld <= cfg.max_ld);
      const sorted = inRange.sort((a, b) => a.miss_distance_ld - b.miss_distance_ld).slice(0, cfg.limit);

      const asteroids = sorted.map(item => {
        let tNorm = (item.epoch - now_ms) / total_window_ms;
        tNorm = Math.max(0.0, Math.min(1.0, tNorm));
        const xPos = parseFloat((cfg.x_min + tNorm * plotW).toFixed(1));

        let dNorm = item.miss_distance_ld / cfg.max_ld;
        dNorm = Math.max(0.0, Math.min(1.0, dNorm));
        const yPos = parseFloat((cfg.y_max - dNorm * plotH).toFixed(1));

        let r = 4;
        if (item.avg_diameter < 30) r = 3;
        else if (item.avg_diameter < 100) r = 5;
        else if (item.avg_diameter < 300) r = 7;
        else r = 9;

        if (key === "quadrant") r = Math.max(2, Math.round(r * 0.6));
        else if (key === "half_horizontal") r = Math.max(3, Math.round(r * 0.8));

        let labelX = xPos + r + 3;
        let anchor = "start";
        if (labelX > cfg.width - 25) { labelX = xPos - r - 3; anchor = "end"; }
        if (labelX < 5) { labelX = xPos + r + 3; anchor = "start"; }

        return {
          name: item.name,
          x: xPos,
          y: yPos,
          r: r,
          label_x: parseFloat(labelX.toFixed(1)),
          label_y: parseFloat((yPos + 3).toFixed(1)),
          anchor: anchor,
          is_hazardous: !!item.is_hazardous,
          dist_ld: parseFloat(item.miss_distance_ld.toFixed(1))
        };
      }).filter(a => isFinite(a.x) && isFinite(a.y));

      result[`chart_asteroids_${key}`] = asteroids;
      result[`chart_ticks_${key}`] = ticks;
      result[`chart_gridlines_${key}`] = gridlines;
    });

    return result;
  } catch (err) {
    console.error("[transform.js] Error in transform script:", err);
    return emptyPayload;
  }
}
