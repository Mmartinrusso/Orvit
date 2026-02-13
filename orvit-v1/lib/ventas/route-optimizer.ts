/**
 * Route Optimizer - TSP Solver
 *
 * Optimizes delivery routes using nearest-neighbor heuristic.
 * For production, consider using:
 * - Google Maps Directions API
 * - OSRM (Open Source Routing Machine)
 * - OR-Tools (Google's optimization library)
 */

export interface Location {
  id: number;
  lat: number;
  lng: number;
  address?: string;
  priority?: number; // 1-5 (5 = highest priority)
  timeWindow?: { start: Date; end: Date };
}

export interface RouteSegment {
  from: Location;
  to: Location;
  distance: number; // km
  duration: number; // minutes
}

export interface OptimizedRoute {
  sequence: Location[];
  totalDistance: number; // km
  totalDuration: number; // minutes
  segments: RouteSegment[];
}

/**
 * Calculate straight-line distance between two points (Haversine formula)
 */
function calculateDistance(loc1: Location, loc2: Location): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(loc2.lat - loc1.lat);
  const dLon = toRad(loc2.lng - loc1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(loc1.lat)) *
      Math.cos(toRad(loc2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Estimate driving duration from distance (rough estimate)
 * Assumes average speed of 40 km/h in urban areas
 */
function estimateDuration(distance: number): number {
  const avgSpeed = 40; // km/h
  return (distance / avgSpeed) * 60; // minutes
}

/**
 * Optimize route using Nearest Neighbor heuristic
 * This is a greedy algorithm with O(n²) complexity.
 * Not optimal but fast and gives decent results (within 25% of optimal).
 */
export function optimizeRoute(
  depot: Location,
  destinations: Location[]
): OptimizedRoute {
  if (destinations.length === 0) {
    return {
      sequence: [depot],
      totalDistance: 0,
      totalDuration: 0,
      segments: [],
    };
  }

  // Start at depot
  const sequence: Location[] = [depot];
  const visited = new Set<number>();
  let currentLocation = depot;
  let totalDistance = 0;
  let totalDuration = 0;
  const segments: RouteSegment[] = [];

  // Visit all destinations
  while (visited.size < destinations.length) {
    let nearestDest: Location | null = null;
    let minDistance = Infinity;

    // Find nearest unvisited destination
    for (const dest of destinations) {
      if (visited.has(dest.id)) continue;

      const distance = calculateDistance(currentLocation, dest);

      // Consider priority (higher priority destinations get a distance "discount")
      const priorityFactor = dest.priority ? 1 - (dest.priority - 1) * 0.1 : 1;
      const adjustedDistance = distance * priorityFactor;

      if (adjustedDistance < minDistance) {
        minDistance = distance; // Use actual distance, not adjusted
        nearestDest = dest;
      }
    }

    if (!nearestDest) break;

    // Add to route
    const distance = calculateDistance(currentLocation, nearestDest);
    const duration = estimateDuration(distance);

    segments.push({
      from: currentLocation,
      to: nearestDest,
      distance,
      duration,
    });

    sequence.push(nearestDest);
    visited.add(nearestDest.id);
    currentLocation = nearestDest;
    totalDistance += distance;
    totalDuration += duration;
  }

  // Return to depot (optional - comment out if not needed)
  const returnDistance = calculateDistance(currentLocation, depot);
  const returnDuration = estimateDuration(returnDistance);

  segments.push({
    from: currentLocation,
    to: depot,
    distance: returnDistance,
    duration: returnDuration,
  });

  sequence.push(depot);
  totalDistance += returnDistance;
  totalDuration += returnDuration;

  return {
    sequence,
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalDuration: Math.round(totalDuration),
    segments,
  };
}

/**
 * Batch optimize: split locations into multiple routes based on vehicle capacity
 */
export function optimizeMultipleRoutes(
  depot: Location,
  destinations: Location[],
  options: {
    maxStopsPerRoute?: number;
    maxDistancePerRoute?: number; // km
  } = {}
): OptimizedRoute[] {
  const maxStops = options.maxStopsPerRoute || 15;
  const routes: OptimizedRoute[] = [];

  // Simple batching: split destinations into chunks
  for (let i = 0; i < destinations.length; i += maxStops) {
    const batch = destinations.slice(i, i + maxStops);
    const route = optimizeRoute(depot, batch);
    routes.push(route);
  }

  return routes;
}

/**
 * Suggest route consolidation opportunities
 * Identifies groups of deliveries in close proximity
 */
export function suggestConsolidation(
  destinations: Location[],
  maxDistanceKm: number = 5
): Array<{ cluster: Location[]; center: Location }> {
  const clusters: Array<{ cluster: Location[]; center: Location }> = [];
  const assigned = new Set<number>();

  for (const loc of destinations) {
    if (assigned.has(loc.id)) continue;

    const cluster: Location[] = [loc];
    assigned.add(loc.id);

    // Find nearby locations
    for (const other of destinations) {
      if (assigned.has(other.id)) continue;

      const distance = calculateDistance(loc, other);
      if (distance <= maxDistanceKm) {
        cluster.push(other);
        assigned.add(other.id);
      }
    }

    // Only create cluster if it has multiple locations
    if (cluster.length > 1) {
      // Calculate center of cluster
      const avgLat = cluster.reduce((sum, l) => sum + l.lat, 0) / cluster.length;
      const avgLng = cluster.reduce((sum, l) => sum + l.lng, 0) / cluster.length;

      clusters.push({
        cluster,
        center: { id: -1, lat: avgLat, lng: avgLng },
      });
    }
  }

  return clusters;
}

/**
 * Calculate savings from optimized route vs original order
 */
export function calculateSavings(
  originalSequence: Location[],
  optimizedSequence: Location[]
): { distanceSaved: number; timeSaved: number; percentSaved: number } {
  // Calculate original route distance
  let originalDistance = 0;
  for (let i = 0; i < originalSequence.length - 1; i++) {
    originalDistance += calculateDistance(originalSequence[i], originalSequence[i + 1]);
  }

  // Calculate optimized route distance
  let optimizedDistance = 0;
  for (let i = 0; i < optimizedSequence.length - 1; i++) {
    optimizedDistance += calculateDistance(
      optimizedSequence[i],
      optimizedSequence[i + 1]
    );
  }

  const distanceSaved = originalDistance - optimizedDistance;
  const timeSaved = estimateDuration(distanceSaved);
  const percentSaved = originalDistance > 0 ? (distanceSaved / originalDistance) * 100 : 0;

  return {
    distanceSaved: Math.round(distanceSaved * 100) / 100,
    timeSaved: Math.round(timeSaved),
    percentSaved: Math.round(percentSaved * 10) / 10,
  };
}
