/**
 * Logger utility for consistent error and info logging
 */

const logError = (context, error) => {
  const timestamp = new Date().toISOString()
  const errorMessage = error instanceof Error ? error.message : error
  const stack = error instanceof Error ? error.stack : undefined

  console.error(`[${timestamp}] ERROR [${context}]:`, errorMessage)
  if (stack) {
    console.error(`[${timestamp}] Stack trace:`, stack)
  }
}

const logInfo = (context, message) => {
  const timestamp = new Date().toISOString()
  console.info(`[${timestamp}] INFO [${context}]:`, message)
}

const logWarning = (context, message) => {
  const timestamp = new Date().toISOString()
  console.warn(`[${timestamp}] WARN [${context}]:`, message)
}

const logDebug = (context, message) => {
  const timestamp = new Date().toISOString()
  console.debug(`[${timestamp}] DEBUG [${context}]:`, message)
}

export {
  logError,
  logInfo,
  logWarning,
  logDebug
} 