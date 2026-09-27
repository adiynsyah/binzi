export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // Importing the env modules validates every variable at module scope and
  // aborts server startup with a clear message on misconfiguration (PRD §12.5).
  await import('./config/env.server')
  await import('./config/env.client')
}
