import React, { useState } from 'react';

export interface Column<T> {
  key?: string;
  accessor?: string | ((row: T) => any);
  label?: string;
  header?: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data?: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  actions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  pagination?: { 
    page: number; 
    pageSize?: number;
    limit?: number;
    total: number; 
    onPageChange?: (page: number) => void 
  };
}

export function DataTable<T extends Record<string, any>>({ 
  columns = [], 
  data = [], 
  loading = false,
  onRowClick, 
  searchable, 
  searchPlaceholder = 'Search...',
  actions,
  emptyMessage = 'No records found',
  pagination
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const safeData = Array.isArray(data) ? data : [];

  const normalizedColumns = columns.map((col, idx) => ({
    ...col,
    colKey: (col.key || (typeof col.accessor === 'string' ? col.accessor : '') || `col_${idx}`),
    colLabel: col.label || col.header || (col.key || '') || '',
    getValue: (row: T) => {
      if (typeof col.accessor === 'function') return col.accessor(row);
      const k = col.key || (typeof col.accessor === 'string' ? col.accessor : '');
      return k ? row[k] : '';
    }
  }));

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredData = safeData.filter(row => {
    if (!searchTerm) return true;
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
    if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
        <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid #E2E8F0', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '12px', fontSize: '14px' }}>Loading records...</p>
      </div>
    );
  }

  return (
    <div style={{ 
      background: '#FFFFFF', 
      borderRadius: '12px', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {searchable && (
        <div style={{ padding: '16px', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#94A3B8' }}>🔍</span>
            <input 
              type="text" 
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                border: '1.5px solid #E2E8F0',
                borderRadius: '8px',
                outline: 'none',
                fontSize: '14px',
                color: '#0F172A'
              }}
            />
          </div>
        </div>
      )}
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {normalizedColumns.map((col, idx) => (
                <th 
                  key={col.colKey || idx} 
                  onClick={() => col.sortable && handleSort(col.colKey)}
                  style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    color: '#64748B', 
                    fontSize: '0.75rem', 
                    textTransform: 'uppercase', 
                    fontWeight: 600,
                    cursor: col.sortable ? 'pointer' : 'default',
                    width: col.width || 'auto'
                  }}
                >
                  {col.colLabel} {col.sortable && sortConfig?.key === col.colKey && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
              ))}
              {actions && <th style={{ padding: '12px 16px', width: '80px' }}></th>}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={normalizedColumns.length + (actions ? 1 : 0)} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row, i) => (
                <tr 
                  key={row.id || i} 
                  onClick={() => onRowClick && onRowClick(row)}
                  style={{ 
                    borderBottom: '1px solid #E2E8F0', 
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {normalizedColumns.map((col, idx) => {
                    const rawVal = col.getValue(row);
                    let cellContent: React.ReactNode = '';
                    if (col.render) {
                      cellContent = col.render(rawVal, row);
                    } else if (React.isValidElement(rawVal)) {
                      cellContent = rawVal;
                    } else if (rawVal !== undefined && rawVal !== null) {
                      if (typeof rawVal === 'object') {
                        cellContent = JSON.stringify(rawVal);
                      } else {
                        cellContent = String(rawVal);
                      }
                    }
                    return (
                      <td key={col.colKey || idx} style={{ padding: '16px', color: '#0F172A', fontSize: '14px' }}>
                        {cellContent}
                      </td>
                    );
                  })}
                  {actions && (
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div style={{ padding: '16px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#64748B' }}>
            Total {pagination.total} records
          </span>
        </div>
      )}
    </div>
  );
}
