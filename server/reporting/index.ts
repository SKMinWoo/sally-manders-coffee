// Reporting: what the back of house reads. A day's figures, the hours, the best sellers, and the
// sales export. It only reads. Depends on the menu, and on orders for what counts as placed.

export { getBehind } from "./behind";
export { checkSalesWorkbook } from "./export/check";
export { exportSales, XLSX, type ExportResult } from "./export/sales";
export { daySummary, itemsSold, ordersByHour, type DaySummary } from "./metrics";
export { spanStats } from "./sales";
