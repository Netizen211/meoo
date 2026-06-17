import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '../App';

export interface DataPermissions {
  [pageKey: string]: { [kpiKey: string]: { value?: boolean; change?: boolean; source?: boolean; detail?: boolean } };
}

export interface FeaturePermissions {
  pages?: Record<string, boolean>;
  actions?: Record<string, boolean>;
}

interface PermissionState {
  features: FeaturePermissions;
  data: DataPermissions;
}

interface PermissionContextType extends PermissionState {
  setPermissions: (p: PermissionState) => void;
  canView: (page: string) => boolean;
  canAction: (action: string) => boolean;
  canViewKpi: (page: string, kpi: string) => boolean;
  canViewKpiField: (page: string, kpi: string, field: string) => boolean;
}

const defaultPermissions: PermissionState = {
  features: { pages: {}, actions: {} },
  data: {},
};

const PermissionContext = createContext<PermissionContextType>({
  ...defaultPermissions,
  setPermissions: () => {},
  canView: () => true,
  canAction: () => true,
  canViewKpi: () => true,
  canViewKpiField: () => true,
});

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { permissions: authPerms } = useAuth();
  const [permissions, setPermissions] = useState<PermissionState>(defaultPermissions);

  // ★ 从登录响应同步权限
  useEffect(() => {
    if (authPerms) {
      setPermissions({
        features: authPerms.features || { pages: {}, actions: {} },
        data: authPerms.data || {},
      });
    }
  }, [authPerms]);

  const canView = useCallback((page: string) => {
    return permissions.features.pages?.[page] !== false;
  }, [permissions]);

  const canAction = useCallback((action: string) => {
    return permissions.features.actions?.[action] !== false;
  }, [permissions]);

  const canViewKpi = useCallback((page: string, kpi: string) => {
    return permissions.data?.[page]?.[kpi]?.value !== false;
  }, [permissions]);

  const canViewKpiField = useCallback((page: string, kpi: string, field: string) => {
    return (permissions.data?.[page]?.[kpi] as any)?.[field] !== false;
  }, [permissions]);

  return (
    <PermissionContext.Provider value={{ ...permissions, setPermissions, canView, canAction, canViewKpi, canViewKpiField }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}

export default PermissionContext;
