export const money = (v, currency = "Rs.") =>
  `${currency === "PKR" ? "PKR" : currency} ${Number(v || 0).toFixed(0)}`;
export const sizeLabel = (s, u) =>
  s < 1000
    ? `${s} ${u === "liter" ? "ml" : "g"}`
    : `${s / 1000} ${u === "liter" ? "L" : "kg"}`;
export const sizes = [250, 500, 1000, 2000, 3000, 4000, 5000];

export const defaultSizeOptions = (unit) =>
  unit === "dozen"
    ? [{ value: 1, label: "1 dozen" }]
    : sizes.map((value) => ({ value, label: sizeLabel(value, unit) }));
