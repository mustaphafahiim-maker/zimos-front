// The report kit: the parts every tab of the reports hub (pages/reports/) is built from —
// the tab's frame, the KPI strip, the ONE chart's card, the ONE sortable table, the ONE
// sentence, «تفاصيل أكتر», the links out, and the loading / no-permission / error gate.
// Material for all of it is in glass/reports.css.
export type { ReportTabProps, ReportColumn, ReportSort, ReportSortValue, ReportTone } from "./types";
export { ReportTab, type ReportTabFrameProps } from "./ReportTab";
export { ReportKpiStrip, type ReportKpiStripProps } from "./ReportKpiStrip";
export { ReportChartCard, ReportLegend, type ReportChartCardProps, type ReportLegendItem } from "./ReportChartCard";
export { ReportTable, type ReportTableProps } from "./ReportTable";
export { ReportTakeaway, type ReportTakeawayProps, type ReportTakeawayAction } from "./ReportTakeaway";
export { ReportMore, type ReportMoreProps } from "./ReportMore";
export { ReportLinks, type ReportLinksProps, type ReportLinkItem } from "./ReportLinks";
export { ReportTabState, ReportTabSkeleton, type ReportTabStateProps } from "./ReportTabState";
export { downloadCsv, type CsvCell } from "./csv";
export { useTabData } from "./useTabData";
export { conversionKnown, formatConversion } from "./rates";
