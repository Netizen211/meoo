import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiClient } from '../../api/client';

export interface PanelConfig {
  id: string; label: string; visible: boolean; width?: string;
}

export interface PageLayout {
  panels: PanelConfig[];
}

interface LayoutContextType {
  editMode: boolean;
  layouts: Record<string, PageLayout>;
  toggleEditMode: () => void;
  saveLayout: (page: string) => Promise<void>;
  loadLayout: (page: string) => Promise<void>;
  resetLayout: (page: string, defaults: PanelConfig[]) => void;
  updatePanel: (page: string, panelId: string, updates: Partial<PanelConfig>) => void;
  reorderPanels: (page: string, fromIndex: number, toIndex: number) => void;
}

const LayoutContext = createContext<LayoutContextType>(null!);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [editMode, setEditMode] = useState(false);
  const [layouts, setLayouts] = useState<Record<string, PageLayout>>({});

  const toggleEditMode = useCallback(() => setEditMode(p => !p), []);

  const loadLayout = useCallback(async (page: string) => {
    try {
      const res = await apiClient.get('/admin/layout?page=' + page);
      if (res.success && res.data) {
        setLayouts(prev => ({ ...prev, [page]: res.data }));
      }
    } catch {}
  }, []);

  const saveLayout = useCallback(async (page: string) => {
    const layout = layouts[page];
    if (!layout) return;
    try {
      await apiClient.put('/admin/layout', { page, layout });
    } catch {}
  }, [layouts]);

  const resetLayout = useCallback((page: string, defaults: PanelConfig[]) => {
    setLayouts(prev => ({ ...prev, [page]: { panels: defaults } }));
  }, []);

  const updatePanel = useCallback((page: string, panelId: string, updates: Partial<PanelConfig>) => {
    setLayouts(prev => {
      const current = prev[page] || { panels: [] };
      return {
        ...prev,
        [page]: {
          ...current,
          panels: current.panels.map(p => p.id === panelId ? { ...p, ...updates } : p),
        }
      };
    });
  }, []);

  const reorderPanels = useCallback((page: string, fromIndex: number, toIndex: number) => {
    setLayouts(prev => {
      const current = prev[page] || { panels: [] };
      const panels = [...current.panels];
      const [moved] = panels.splice(fromIndex, 1);
      panels.splice(toIndex, 0, moved);
      return { ...prev, [page]: { ...current, panels } };
    });
  }, []);

  return (
    <LayoutContext.Provider value={{ editMode, layouts, toggleEditMode, saveLayout, loadLayout, resetLayout, updatePanel, reorderPanels }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() { return useContext(LayoutContext); }
export default LayoutContext;
