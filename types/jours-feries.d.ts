declare module "@socialgouv/jours-feries" {
  function getJoursFeries(year: number, opts?: { alsace?: boolean }): Record<string, Date>;
  export default getJoursFeries;
}
