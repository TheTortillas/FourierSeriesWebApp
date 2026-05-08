/** Clase CSS para badge de acción de audit log, compartida entre Dashboard y Audit. */
export function auditBadgeClass(action: string): string {
  if (action.includes('login') || action.includes('register'))
    return 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
  if (action.includes('deactivat') || action.includes('fail') || action.includes('clear'))
    return 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800';
  if (action.includes('tier') || action.includes('activat'))
    return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
  if (action.includes('calculat') || action.includes('transform') || action.includes('perform'))
    return 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
  if (action.includes('password') || action.includes('recovery'))
    return 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800';
  return 'bg-paper dark:bg-dark-bg text-muted dark:text-dark-muted border-border dark:border-dark-border';
}
