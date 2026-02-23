/**
 * Node.js-only instrumentation
 *
 * El bot de Discord ahora corre como servicio separado en Railway.
 * Este archivo es un no-op mantenido por compatibilidad.
 */

export async function autoConnectDiscordBot() {
  // No-op: bot corre como servicio externo en Railway
  console.log('ℹ️ [Discord Bot] Bot corre como servicio externo (Railway)');
}
