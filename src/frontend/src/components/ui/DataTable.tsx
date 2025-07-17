import React, { useState, useMemo } from 'react';
import { designTokens } from '../../styles/designTokens';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { Button } from './Button';
import { Card } from './Card';

export interface Column<T> {
  key: keyof T;
  title: string;
  width?: string;
  sortable?: boolean;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  sortable?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  rowKey?: keyof T | ((record: T) => string);
  onRowClick?: (record: T, index: number) => void;
}

type SortOrder = 'asc' | 'desc' | null;

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  pagination,
  sortable = true,
  searchable = true,
  searchPlaceholder = 'Search...',
  emptyText = 'No data available',
  rowKey = 'id',
  onRowClick,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const { isMobile } = useBreakpoint();

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    
    return data.filter(record =>
      columns.some(column => {
        const value = record[column.key];
        return String(value).toLowerCase().includes(searchQuery.toLowerCase());
      })
    );
  }, [data, searchQuery, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortOrder) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortOrder]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    
    const start = (pagination.current - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return sortedData.slice(start, end);
  }, [sortedData, pagination]);

  const handleSort = (column: Column<T>) => {
    if (!sortable || !column.sortable) return;

    if (sortColumn === column.key) {
      // Cycle through: asc -> desc -> null
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else if (sortOrder === 'desc') {
        setSortColumn(null);
        setSortOrder(null);
      }
    } else {
      setSortColumn(column.key);
      setSortOrder('asc');
    }
  };

  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record);
    }
    return String(record[rowKey] || index);
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: designTokens.typography.fontSize.sm,
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: designTokens.colors.neutral[50],
    borderBottom: `2px solid ${designTokens.colors.neutral[200]}`,
  };

  const headerCellStyle = (column: Column<T>): React.CSSProperties => ({
    padding: designTokens.spacing[3],
    textAlign: column.align || 'left',
    fontWeight: designTokens.typography.fontWeight.semibold,
    color: designTokens.colors.neutral[700],
    cursor: sortable && column.sortable ? 'pointer' : 'default',
    userSelect: 'none',
    position: 'relative',
    width: column.width,
  });

  const rowStyle = (index: number): React.CSSProperties => ({
    borderBottom: `1px solid ${designTokens.colors.neutral[200]}`,
    cursor: onRowClick ? 'pointer' : 'default',
    transition: `background-color ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeInOut}`,
    backgroundColor: index % 2 === 0 ? 'transparent' : designTokens.colors.neutral[25],
  });

  const cellStyle = (column: Column<T>): React.CSSProperties => ({
    padding: designTokens.spacing[3],
    textAlign: column.align || 'left',
    color: designTokens.colors.neutral[900],
  });

  const getSortIcon = (column: Column<T>) => {
    if (!sortable || !column.sortable) return null;
    
    if (sortColumn !== column.key) {
      return <span style={{ opacity: 0.3, marginLeft: designTokens.spacing[1] }}>↕️</span>;
    }
    
    return (
      <span style={{ marginLeft: designTokens.spacing[1] }}>
        {sortOrder === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  const paginationStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: designTokens.spacing[4],
    padding: designTokens.spacing[3],
    borderTop: `1px solid ${designTokens.colors.neutral[200]}`,
  };

  const searchStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '300px',
    padding: designTokens.spacing[2],
    border: `1px solid ${designTokens.colors.neutral[300]}`,
    borderRadius: designTokens.borderRadius.md,
    fontSize: designTokens.typography.fontSize.sm,
    marginBottom: designTokens.spacing[4],
  };

  // Mobile card view
  if (isMobile) {
    return (
      <div>
        {searchable && (
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchStyle}
          />
        )}
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: designTokens.spacing[8] }}>
            <div>Loading...</div>
          </div>
        ) : paginatedData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: designTokens.spacing[8] }}>
            <div>{emptyText}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[3] }}>
            {paginatedData.map((record, index) => (
              <Card
                key={getRowKey(record, index)}
                interactive={!!onRowClick}
                onClick={() => onRowClick?.(record, index)}
                padding="md"
              >
                {columns.map((column) => (
                  <div key={String(column.key)} style={{ marginBottom: designTokens.spacing[2] }}>
                    <div style={{ 
                      fontSize: designTokens.typography.fontSize.xs,
                      color: designTokens.colors.neutral[500],
                      fontWeight: designTokens.typography.fontWeight.medium,
                      marginBottom: designTokens.spacing[1],
                    }}>
                      {column.title}
                    </div>
                    <div>
                      {column.render 
                        ? column.render(record[column.key], record, index)
                        : String(record[column.key] || '-')
                      }
                    </div>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        )}
        
        {pagination && (
          <div style={paginationStyle}>
            <div style={{ fontSize: designTokens.typography.fontSize.sm, color: designTokens.colors.neutral[600] }}>
              Showing {((pagination.current - 1) * pagination.pageSize) + 1} to{' '}
              {Math.min(pagination.current * pagination.pageSize, pagination.total)} of {pagination.total}
            </div>
            <div style={{ display: 'flex', gap: designTokens.spacing[2] }}>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.current === 1}
                onClick={() => pagination.onChange(pagination.current - 1, pagination.pageSize)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.current * pagination.pageSize >= pagination.total}
                onClick={() => pagination.onChange(pagination.current + 1, pagination.pageSize)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop table view
  return (
    <div>
      {searchable && (
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={searchStyle}
        />
      )}
      
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead style={headerStyle}>
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  style={headerCellStyle(column)}
                  onClick={() => handleSort(column)}
                >
                  {column.title}
                  {getSortIcon(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: designTokens.spacing[8] }}>
                  Loading...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: designTokens.spacing[8] }}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              paginatedData.map((record, index) => (
                <tr
                  key={getRowKey(record, index)}
                  style={rowStyle(index)}
                  onClick={() => onRowClick?.(record, index)}
                  onMouseEnter={(e) => {
                    if (onRowClick) {
                      e.currentTarget.style.backgroundColor = designTokens.colors.neutral[50];
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (onRowClick) {
                      e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'transparent' : designTokens.colors.neutral[25];
                    }
                  }}
                >
                  {columns.map((column) => (
                    <td key={String(column.key)} style={cellStyle(column)}>
                      {column.render 
                        ? column.render(record[column.key], record, index)
                        : String(record[column.key] || '-')
                      }
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {pagination && (
        <div style={paginationStyle}>
          <div style={{ fontSize: designTokens.typography.fontSize.sm, color: designTokens.colors.neutral[600] }}>
            Showing {((pagination.current - 1) * pagination.pageSize) + 1} to{' '}
            {Math.min(pagination.current * pagination.pageSize, pagination.total)} of {pagination.total}
          </div>
          <div style={{ display: 'flex', gap: designTokens.spacing[2] }}>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.current === 1}
              onClick={() => pagination.onChange(pagination.current - 1, pagination.pageSize)}
            >
              Previous
            </Button>
            <span style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: `0 ${designTokens.spacing[2]}`,
              fontSize: designTokens.typography.fontSize.sm,
            }}>
              Page {pagination.current} of {Math.ceil(pagination.total / pagination.pageSize)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.current * pagination.pageSize >= pagination.total}
              onClick={() => pagination.onChange(pagination.current + 1, pagination.pageSize)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;