import { Policy } from "./Policy.js";

/**
 * Repository interface for Policy entities
 * Defines the contract for storing and retrieving policies
 * Implementation will be provided in the infrastructure layer
 */
export interface PolicyRepository {
  /**
   * Find a policy by its ID
   * @param id Policy ID
   * @returns Policy or null if not found
   */
  findById(id: string): Promise<Policy | null>;

  /**
   * Find all policies
   * @returns Array of policies
   */
  findAll(): Promise<Policy[]>;

  /**
   * Find policies by status
   * @param status Policy status
   * @returns Array of policies with the specified status
   */
  findByStatus(status: string): Promise<Policy[]>;

  /**
   * Save a policy (create or update)
   * @param policy Policy to save
   */
  save(policy: Policy): Promise<void>;

  /**
   * Delete a policy by ID
   * @param id Policy ID
   */
  delete(id: string): Promise<void>;
}
