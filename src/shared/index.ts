/**
 * Shared Module - DRY Architecture Foundation
 *
 * This module contains all shared code to eliminate duplication across:
 * - API services
 * - Trading agents
 * - Frontend components
 * - Scripts and utilities
 */

// Core Types (shared across all modules)
export * from './types/index.js';

// Shared Services (DRY principle)
export * from './services/index.js';

// Common Utilities (reusable across all modules)
export * from './utils/index.js';

// Configuration Management (centralized)
export * from './config/index.js';

// Validation Schemas (shared validation logic)
export * from './validation/index.js';

// Constants (single source of truth)
export * from './constants/index.js';

// Error Handling (consistent error management)
export * from './errors/index.js';

// Logging (unified logging across all services)
export * from './logging/index.js';
