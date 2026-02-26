import React, { useState, useMemo } from "react";
import { useBreakpoint } from "../../hooks/useMediaQuery";
import { Button } from "./Button";
import { Card } from "./Card";
import { tableStyles } from "../../styles/design-system";

export interface Column<T> {
  key: keyof T;
  title: string;
  width?: string;
  sortable?: boolean;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  align?: "left" | "center" | "right";
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

type SortOrder = "asc" | "desc" | null;

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  pagination,
  sortable = true,
  searchable = true,
  searchPlaceholder = "Search...",
  emptyText = "No data available",
  rowKey = "id",
  onRowClick,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const { isMobile } = useBreakpoint();

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;

    return data.filter((record) =>
      columns.some((column) => {
        const value = record[column.key];
        return String(value).toLowerCase().includes(searchQuery.toLowerCase());
      }),
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
      return sortOrder === "asc" ? comparison : -comparison;
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
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else if (sortOrder === "desc") {
        setSortColumn(null);
        setSortOrder(null);
      }
    } else {
      setSortColumn(column.key);
      setSortOrder("asc");
    }
  };

  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === "function") {
      return rowKey(record);
    }
    return String(record[rowKey] || index);
  };

  const getSortIcon = (column: Column<T>) => {
    if (!sortable || !column.sortable) return null;

    if (sortColumn !== column.key) {
      return (
        <span
          css={css`
            opacity: 0.3;
            margin-left: 4px;
          `}
        >
          ↕️
        </span>
      );
    }

    return (
      <span
        css={css`
          margin-left: 4px;
        `}
      >
        {sortOrder === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  // Mobile card view
  if (isMobile) {
    return (
      <div css={tableStyles.table}>
        {searchable && (
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            css={tableStyles.search}
          />
        )}

        {loading ? (
          <div css={tableStyles.loading}>
            <div>Loading...</div>
          </div>
        ) : paginatedData.length === 0 ? (
          <div css={tableStyles.loading}>
            <div>{emptyText}</div>
          </div>
        ) : (
          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: 12px;
            `}
          >
            {paginatedData.map((record, index) => (
              <Card
                key={getRowKey(record, index)}
                interactive={!!onRowClick}
                onClick={() => onRowClick?.(record, index)}
                padding="md"
                css={tableStyles.mobileCard}
              >
                {columns.map((column) => (
                  <div key={String(column.key)} css={tableStyles.mobileCard}>
                    <div css={tableStyles.mobileCardTitle}>
                      {column.title}
                    </div>
                    <div>
                      {column.render
                        ? column.render(record[column.key], record, index)
                        : String(record[column.key] || "-")}
                    </div>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        )}

        {pagination && (
            <div css={tableStyles.pagination}>
              <div css={tableStyles.paginationInfo}>
                Showing {(pagination.current - 1) * pagination.pageSize + 1} to{" "}
                {Math.min(
                  pagination.current * pagination.pageSize,
                  pagination.total,
                )}{" "}
                of {pagination.total}
              </div>
              <div css={tableStyles.paginationControls}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current === 1}
                  onClick={() =>
                    pagination.onChange(
                      pagination.current - 1,
                      pagination.pageSize,
                    )
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    pagination.current * pagination.pageSize >= pagination.total
                  }
                  onClick={() =>
                    pagination.onChange(
                      pagination.current + 1,
                      pagination.pageSize,
                    )
                  }
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
    <div css={tableStyles.table}>
      {searchable && (
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          css={tableStyles.search}
        />
      )}

      <div
        css={css`
          overflow-x: auto;
        `}
      >
        <table css={tableStyles.table}>
          <thead css={tableStyles.header}>
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  css={tableStyles.headerCell(
                    column.align || "left",
                    !!column.sortable,
                  )}
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
                <td colSpan={columns.length} css={tableStyles.loading}>
                  Loading...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} css={tableStyles.loading}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              paginatedData.map((record, index) => (
                <tr
                  key={getRowKey(record, index)}
                  css={tableStyles.row(!!onRowClick, index)}
                  onClick={() => onRowClick?.(record, index)}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      css={tableStyles.cell(column.align || "left")}
                    >
                      {column.render
                        ? column.render(record[column.key], record, index)
                        : String(record[column.key] || "-")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div css={tableStyles.pagination}>
          <div css={tableStyles.paginationInfo}>
            Showing {(pagination.current - 1) * pagination.pageSize + 1} to{" "}
            {Math.min(
              pagination.current * pagination.pageSize,
              pagination.total,
            )}{" "}
            of {pagination.total}
          </div>
          <div css={tableStyles.paginationControls}>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.current === 1}
              onClick={() =>
                pagination.onChange(pagination.current - 1, pagination.pageSize)
              }
            >
              Previous
            </Button>
            <span css={tableStyles.paginationPageInfo}>
              Page {pagination.current} of{" "}
              {Math.ceil(pagination.total / pagination.pageSize)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={
                pagination.current * pagination.pageSize >= pagination.total
              }
              onClick={() =>
                pagination.onChange(pagination.current + 1, pagination.pageSize)
              }
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
