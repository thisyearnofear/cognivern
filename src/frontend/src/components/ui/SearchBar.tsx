/** @jsxImportSource @emotion/react */
import React, { useState, useCallback } from 'react';
import { css, keyframes } from '@emotion/react';
import { designTokens } from '../../styles/design-system';
import { Search, X, Filter, SortAsc, SortDesc } from 'lucide-react';
import { Button } from './Button';
import { Badge } from './Badge';

export interface SearchFilter {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  selected?: string[];
}

export interface SearchSortOption {
  value: string;
  label: string;
}

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  filters?: SearchFilter[];
  sortOptions?: SearchSortOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;
  activeFilters?: Record<string, string[]>;
  onFiltersChange?: (filters: Record<string, string[]>) => void;
  showClear?: boolean;
  onClear?: () => void;
  isSearching?: boolean;
  resultCount?: number;
  compact?: boolean;
}

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  filters = [],
  sortOptions = [],
  sortValue,
  onSortChange,
  activeFilters = {},
  onFiltersChange,
  showClear = false,
  onClear,
  isSearching = false,
  resultCount,
  compact = false,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [focused, setFocused] = useState(false);

  const hasActiveFilters = Object.values(activeFilters).some((arr) => arr.length > 0);
  const activeFilterCount = Object.values(activeFilters).reduce(
    (count, arr) => count + arr.length,
    0
  );

  const handleFilterToggle = useCallback(
    (filterId: string, optionValue: string) => {
      if (!onFiltersChange) return;

      const current = activeFilters[filterId] || [];
      const updated = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];

      onFiltersChange({
        ...activeFilters,
        [filterId]: updated,
      });
    },
    [activeFilters, onFiltersChange]
  );

  const handleClear = useCallback(() => {
    onChange('');
    onClear?.();
    if (onFiltersChange) {
      onFiltersChange({});
    }
  }, [onChange, onClear, onFiltersChange]);

  return (
    <div css={css`width: 100%;`}>
      {/* Main search row */}
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: ${designTokens.spacing[2]};
          padding: ${compact ? designTokens.spacing[2] : designTokens.spacing[3]};
          background: var(--bg-primary);
          border: 1px solid ${focused ? designTokens.colors.primary[400] : 'var(--border-subtle)'};
          border-radius: ${designTokens.borderRadius.lg};
          transition: all ${designTokens.animation.duration.fast} ease;

          &:hover {
            border-color: ${focused ? designTokens.colors.primary[400] : 'var(--border-default)'};
          }

          &:focus-within {
            box-shadow: 0 0 0 3px ${designTokens.colors.primary[100]};
          }
        `}
      >
        {/* Search icon */}
        <div
          css={css`
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            flex-shrink: 0;
          `}
        >
          {isSearching ? (
            <Search
              size={18}
              css={css`animation: ${spin} 1s linear infinite; color: ${designTokens.colors.primary[500]};`}
            />
          ) : (
            <Search size={18} />
          )}
        </div>

        {/* Input */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          css={css`
            flex: 1;
            min-width: 0;
            padding: 0;
            background: transparent;
            border: none;
            outline: none;
            font-size: ${designTokens.typography.fontSize.sm};
            color: var(--text-primary);

            &::placeholder {
              color: var(--text-muted);
            }
          `}
        />

        {/* Clear button */}
        {showClear && value && (
          <button
            onClick={handleClear}
            css={css`
              display: flex;
              align-items: center;
              justify-content: center;
              padding: ${designTokens.spacing[1]};
              color: var(--text-muted);
              background: transparent;
              border: none;
              border-radius: ${designTokens.borderRadius.sm};
              cursor: pointer;
              transition: all 0.15s;

              &:hover {
                color: var(--text-primary);
                background: var(--bg-secondary);
              }
            `}
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}

        {/* Sort button */}
        {sortOptions.length > 0 && (
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: ${designTokens.spacing[1]};
              padding-left: ${designTokens.spacing[2]};
              border-left: 1px solid var(--border-subtle);
            `}
          >
            <select
              value={sortValue}
              onChange={(e) => onSortChange?.(e.target.value)}
              css={css`
                padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
                font-size: ${designTokens.typography.fontSize.xs};
                color: var(--text-secondary);
                background: transparent;
                border: 1px solid var(--border-subtle);
                border-radius: ${designTokens.borderRadius.sm};
                cursor: pointer;
                outline: none;

                &:hover {
                  border-color: var(--border-default);
                }
              `}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filter button */}
        {filters.length > 0 && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            css={css`
              display: flex;
              align-items: center;
              gap: ${designTokens.spacing[1]};
              padding: ${designTokens.spacing[1]} ${designTokens.spacing[3]};
              font-size: ${designTokens.typography.fontSize.xs};
              color: ${hasActiveFilters ? designTokens.colors.primary[600] : 'var(--text-secondary)'};
              background: ${hasActiveFilters ? designTokens.colors.primary[50] : 'transparent'};
              border: 1px solid ${hasActiveFilters ? designTokens.colors.primary[200] : 'var(--border-subtle)'};
              border-radius: ${designTokens.borderRadius.sm};
              cursor: pointer;
              transition: all 0.15s;

              &:hover {
                border-color: ${designTokens.colors.primary[300]};
              }
            `}
          >
            <Filter size={14} />
            Filters
            {activeFilterCount > 0 && (
              <Badge
                variant="primary"
                size="sm"
                css={css`margin-left: ${designTokens.spacing[1]};`}
              >
                {activeFilterCount}
              </Badge>
            )}
          </button>
        )}
      </div>

      {/* Filter dropdown */}
      {showFilters && filters.length > 0 && (
        <div
          css={css`
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            margin-top: ${designTokens.spacing[2]};
            background: var(--bg-primary);
            border: 1px solid var(--border-subtle);
            border-radius: ${designTokens.borderRadius.lg};
            box-shadow: ${designTokens.shadows.lg};
            padding: ${designTokens.spacing[4]};
            z-index: ${designTokens.zIndex.dropdown};
            animation: ${fadeIn} 0.15s ease-out;
          `}
        >
          <div
            css={css`
              display: flex;
              flex-wrap: wrap;
              gap: ${designTokens.spacing[4]};
            `}
          >
            {filters.map((filter) => (
              <div key={filter.id} css={css`min-width: 160px;`}>
                <label
                  css={css`
                    display: block;
                    font-size: ${designTokens.typography.fontSize.xs};
                    font-weight: ${designTokens.typography.fontWeight.medium};
                    color: var(--text-secondary);
                    margin-bottom: ${designTokens.spacing[2]};
                  `}
                >
                  {filter.label}
                </label>
                <div css={css`display: flex; flex-wrap: wrap; gap: ${designTokens.spacing[1]};`}>
                  {filter.options.map((option) => {
                    const isSelected = (activeFilters[filter.id] || []).includes(
                      option.value
                    );
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleFilterToggle(filter.id, option.value)}
                        css={css`
                          padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
                          font-size: ${designTokens.typography.fontSize.xs};
                          color: ${isSelected ? 'white' : 'var(--text-secondary)'};
                          background: ${isSelected ? designTokens.colors.primary[600] : 'var(--bg-secondary)'};
                          border: 1px solid ${isSelected ? designTokens.colors.primary[600] : 'var(--border-subtle)'};
                          border-radius: ${designTokens.borderRadius.sm};
                          cursor: pointer;
                          transition: all 0.15s;

                          &:hover {
                            border-color: ${designTokens.colors.primary[300]};
                          }
                        `}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Clear all filters */}
          {hasActiveFilters && (
            <button
              onClick={() => onFiltersChange?.({})}
              css={css`
                margin-top: ${designTokens.spacing[4]};
                padding: 0;
                font-size: ${designTokens.typography.fontSize.xs};
                color: ${designTokens.colors.primary[600]};
                background: transparent;
                border: none;
                cursor: pointer;

                &:hover {
                  text-decoration: underline;
                }
              `}
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      {resultCount !== undefined && (
        <div
          css={css`
            margin-top: ${designTokens.spacing[2]};
            font-size: ${designTokens.typography.fontSize.xs};
            color: var(--text-muted);
          `}
        >
          {resultCount === 0 ? 'No results' : `${resultCount} result${resultCount === 1 ? '' : 's'} found`}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
