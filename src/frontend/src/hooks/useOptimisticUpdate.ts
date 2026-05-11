/**
 * useOptimisticUpdate - Optimistic UI pattern for instant feedback
 *
 * Core Principles:
 * - PREVENTION BLOAT: Single hook handles all optimistic patterns
 * - ENHANCEMENT FIRST: Immediate visual feedback
 * - DRY: Reusable across components
 */

import { useState, useCallback, useRef } from 'react';

export interface OptimisticState<T> {
  data: T | null;
  isPending: boolean;
  error: Error | null;
}

export interface UseOptimisticOptions<T> {
  initialData?: T;
  onSuccess?: (data: T) => void;
  onError?: (error: Error, rollback: () => void) => void;
  rollbackDelay?: number;
}

/**
 * Hook for optimistic updates with rollback support
 */
export function useOptimisticUpdate<T>(options: UseOptimisticOptions<T> = {}) {
  const { initialData, onSuccess, onError, rollbackDelay = 3000 } = options;

  const [state, setState] = useState<OptimisticState<T>>({
    data: initialData || null,
    isPending: false,
    error: null,
  });

  const previousDataRef = useRef<T | null>(initialData || null);
  const rollbackTimeoutRef = useRef<NodeJS.Timeout>();

  const optimisticUpdate = useCallback(
    async (updateFn: () => Promise<T>): Promise<T | null> => {
      // Clear any pending rollback
      if (rollbackTimeoutRef.current) {
        clearTimeout(rollbackTimeoutRef.current);
      }

      // Store current data for potential rollback
      previousDataRef.current = state.data;

      // Optimistically update UI immediately
      setState((prev) => ({
        ...prev,
        isPending: true,
        error: null,
      }));

      try {
        // Execute the actual update
        const result = await updateFn();

        // Success - update with real data
        setState({
          data: result,
          isPending: false,
          error: null,
        });

        onSuccess?.(result);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Update failed');

        // Set error state
        setState((prev) => ({
          ...prev,
          isPending: false,
          error: err,
        }));

        // Automatic rollback after delay
        rollbackTimeoutRef.current = setTimeout(() => {
          setState({
            data: previousDataRef.current,
            isPending: false,
            error: null,
          });
        }, rollbackDelay);

        // Call error handler with rollback function
        onError?.(err, () => {
          if (rollbackTimeoutRef.current) {
            clearTimeout(rollbackTimeoutRef.current);
          }
          setState({
            data: previousDataRef.current,
            isPending: false,
            error: null,
          });
        });

        return null;
      }
    },
    [state.data, onSuccess, onError, rollbackDelay]
  );

  const reset = useCallback(() => {
    if (rollbackTimeoutRef.current) {
      clearTimeout(rollbackTimeoutRef.current);
    }
    setState({
      data: initialData || null,
      isPending: false,
      error: null,
    });
    previousDataRef.current = initialData || null;
  }, [initialData]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    optimisticUpdate,
    reset,
    clearError,
  };
}

/**
 * Simplified hook for list operations (add/remove/update)
 */
export function useOptimisticList<T extends { id: string | number }>() {
  const [items, setItems] = useState<T[]>([]);
  const [isPending, setIsPending] = useState(false);

  const addItem = useCallback(async (item: T, apiCall: () => Promise<T>) => {
    // Optimistically add
    setItems((prev) => [...prev, item]);

    try {
      const result = await apiCall();
      // Replace temp item with real data
      setItems((prev) => prev.map((i) => (i.id === item.id ? result : i)));
      return result;
    } catch {
      // Rollback
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      throw new Error('Failed to add item');
    }
  }, []);

  const removeItem = useCallback(
    async (id: string | number, apiCall: () => Promise<void>) => {
      // Store for rollback
      const removedItem = items.find((i) => i.id === id);

      // Optimistically remove
      setItems((prev) => prev.filter((i) => i.id !== id));
      setIsPending(true);

      try {
        await apiCall();
      } catch {
        // Rollback
        if (removedItem) {
          setItems((prev) => [removedItem, ...prev]);
        }
        throw new Error('Failed to remove item');
      } finally {
        setIsPending(false);
      }
    },
    [items]
  );

  const updateItem = useCallback(
    async (id: string | number, updates: Partial<T>, apiCall: () => Promise<T>) => {
      // Store original for rollback
      const originalItem = items.find((i) => i.id === id);

      // Optimistically update
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));

      try {
        const result = await apiCall();
        setItems((prev) => prev.map((i) => (i.id === id ? result : i)));
        return result;
      } catch {
        // Rollback
        if (originalItem) {
          setItems((prev) => prev.map((i) => (i.id === id ? originalItem : i)));
        }
        throw new Error('Failed to update item');
      }
    },
    [items]
  );

  const setList = useCallback((newItems: T[]) => {
    setItems(newItems);
  }, []);

  return {
    items,
    setList,
    isPending,
    addItem,
    removeItem,
    updateItem,
  };
}

/**
 * Toggle state with optimistic feedback
 */
export function useOptimisticToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);
  const [isPending, setIsPending] = useState(false);
  const previousValueRef = useRef(initialValue);

  const toggle = useCallback(
    async (apiCall: () => Promise<boolean>) => {
      const previousValue = value;
      previousValueRef.current = value;

      // Optimistically toggle
      setValue(!value);
      setIsPending(true);

      try {
        const result = await apiCall();
        setValue(result);
        return result;
      } catch {
        // Rollback
        setValue(previousValue);
        throw new Error('Toggle failed');
      } finally {
        setIsPending(false);
      }
    },
    [value]
  );

  return { value, isPending, toggle, setValue };
}

export default useOptimisticUpdate;
