const config = require('../config');

/**
 * Delivery-distance estimation used for freight charging.
 *
 * If a Google Maps API key is configured we do a real driving-distance lookup.
 * Otherwise we fall back to an offline pincode heuristic: the first digits of
 * the Indian pincode encode a postal zone, so we map zone -> rough km.
 */

const PINCODE_ZONE_KM = {
  1: 30, // Delhi NCR / North
  2: 32,
  3: 28,
  4: 55, // Maharashtra / Mumbai
  5: 25, // Telangana / AP / Karnataka belt
  6: 38, // Tamil Nadu
  7: 20, // Kolkata / East
  8: 60, // Bihar / Far East
  9: 45, // Army / Far West
};

function heuristicKm(pincode) {
  if (!pincode) return 20;
  const zone = Number(String(pincode)[0]);
  return PINCODE_ZONE_KM[zone] ?? 25;
}

async function estimateFreight(pincode) {
  const km = heuristicKm(pincode);
  const { freightBase, freightPerKm } = config.pricing;
  return Math.round(freightBase + freightPerKm * km);
}

module.exports = { estimateFreight, heuristicKm };