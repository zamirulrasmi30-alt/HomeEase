const config = require('../config');

/**
 * Bulk discount tier.
 * If product has discount_tier_qty set and quantity >= tier, apply percent off.
 */
function effectiveUnitPrice(product, qty) {
  const base = Number(product.price_per_unit);
  if (
    product.discount_tier_qty != null &&
    product.discount_tier_percent != null &&
    qty >= Number(product.discount_tier_qty)
  ) {
    return round2(base * (1 - Number(product.discount_tier_percent) / 100));
  }
  return round2(base);
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Build a full price breakdown for a set of [{ product, quantity }].
 * Returns itemized lines plus GST and freight breakdown.
 */
function buildPricing(productRows, pincode = null, freight = 0) {
  const gstRate = config.pricing.gstRate;

  let items = [];
  let subtotal = 0;
  let discountAmount = 0;

  for (const row of productRows) {
    const qty = Number(row.quantity);
    const product = row.product;
    const listPrice = Number(product.price_per_unit);

    let price = listPrice;
    let discountPercent = 0;
    if (
      product.discount_tier_qty != null &&
      product.discount_tier_percent != null &&
      qty >= Number(product.discount_tier_qty)
    ) {
      discountPercent = Number(product.discount_tier_percent);
      price = effectiveUnitPrice(product, qty);
    }

    const subtotalLine = round2(price * qty);
    subtotal += subtotalLine;
    discountAmount += round2((listPrice - price) * qty);

    items.push({
      product_id: product.id,
      product_name: product.name,
      brand: product.brand,
      unit_type: product.unit_type,
      quantity: qty,
      unit_price: round2(listPrice),
      discount_percent: discountPercent,
      unit_price_effective: round2(price),
      subtotal: subtotalLine,
    });
  }

  subtotal = round2(subtotal);
  discountAmount = round2(discountAmount);

  // GST applied on the discounted value of goods.
  const gstBase = round2(subtotal - discountAmount);
  const gstAmount = round2((gstBase * gstRate) / 100);
  const freightCharge = round2(freight ?? 0);
  const total = round2(gstBase + gstAmount + freightCharge);

  return {
    items,
    item_subtotal: subtotal,
    discount_amount: discountAmount,
    gst_rate: gstRate,
    gst_amount: gstAmount,
    freight_charge: freightCharge,
    total_amount: total,
  };
}

module.exports = { effectiveUnitPrice, buildPricing, round2 };