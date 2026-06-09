export type DashboardHygieneTaskItem = {
  id: string;
  kind: "cleaning" | "temperature";
  title: string;
  subtitle: string;
  dueLabel: string;
  riskLabel?: string;
  href: string;
  overdue: boolean;
};
