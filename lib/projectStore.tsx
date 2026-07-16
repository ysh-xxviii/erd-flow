"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  BackendTab,
  ProjectEnv,
  ProjectSection,
} from "@/lib/types";

export type ModalKind =
  | null
  | "connect"
  | "editDb"
  | "discard"
  | "prodGate"
  | "newProject";

type ProdGateAction = (() => void) | null;

type ProjectStoreValue = {
  activeSection: ProjectSection;
  setActiveSection: (s: ProjectSection) => void;
  backendTab: BackendTab;
  setBackendTab: (t: BackendTab) => void;
  selectedTableId: string | null;
  setSelectedTableId: (id: string | null) => void;
  selectedEndpointId: string | null;
  setSelectedEndpointId: (id: string | null) => void;
  selectedFilePath: string | null;
  setSelectedFilePath: (p: string | null) => void;
  selectedPlanId: string | null;
  setSelectedPlanId: (id: string | null) => void;
  planReviewMode: boolean;
  setPlanReviewMode: (v: boolean) => void;
  env: ProjectEnv;
  setEnv: (e: ProjectEnv) => void;
  repoConnected: boolean;
  dbConnected: boolean;
  setConnections: (c: {
    repoConnected?: boolean;
    dbConnected?: boolean;
    repoUrl?: string | null;
    dbHost?: string | null;
    dbName?: string | null;
    dbHint?: string | null;
  }) => void;
  repoUrl: string | null;
  dbHost: string | null;
  dbName: string | null;
  dbHint: string | null;
  isFullyConnected: boolean;
  forceConnected: boolean;
  inspectorWidth: number;
  setInspectorWidth: (w: number) => void;
  inspectorCollapsed: boolean;
  setInspectorCollapsed: (v: boolean) => void;
  modal: ModalKind;
  setModal: (m: ModalKind) => void;
  pendingProdAction: ProdGateAction;
  requestProdGate: (action: () => void) => void;
  clearProdGate: () => void;
  confirmProdGate: () => void;
};

const ProjectStoreContext = createContext<ProjectStoreValue | null>(null);

export function ProjectStoreProvider({
  children,
  initialEnv = "dev",
  initialRepoConnected = false,
  initialDbConnected = false,
  initialRepoUrl = null,
  initialDbHost = null,
  initialDbName = null,
  initialDbHint = null,
  forceConnected = false,
}: {
  children: ReactNode;
  initialEnv?: ProjectEnv;
  initialRepoConnected?: boolean;
  initialDbConnected?: boolean;
  initialRepoUrl?: string | null;
  initialDbHost?: string | null;
  initialDbName?: string | null;
  initialDbHint?: string | null;
  forceConnected?: boolean;
}) {
  const [activeSection, setActiveSection] = useState<ProjectSection>("backend");
  const [backendTab, setBackendTab] = useState<BackendTab>("schemas");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(
    null
  );
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planReviewMode, setPlanReviewMode] = useState(false);
  const [env, setEnv] = useState<ProjectEnv>(initialEnv);
  const [repoConnected, setRepoConnected] = useState(initialRepoConnected);
  const [dbConnected, setDbConnected] = useState(initialDbConnected);
  const [repoUrl, setRepoUrl] = useState<string | null>(initialRepoUrl);
  const [dbHost, setDbHost] = useState<string | null>(initialDbHost);
  const [dbName, setDbName] = useState<string | null>(initialDbName);
  const [dbHint, setDbHint] = useState<string | null>(initialDbHint);
  const [inspectorWidth, setInspectorWidth] = useState(320);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [pendingProdAction, setPendingProdAction] =
    useState<ProdGateAction>(null);

  const setConnections = useCallback(
    (c: {
      repoConnected?: boolean;
      dbConnected?: boolean;
      repoUrl?: string | null;
      dbHost?: string | null;
      dbName?: string | null;
      dbHint?: string | null;
    }) => {
      if (c.repoConnected !== undefined) setRepoConnected(c.repoConnected);
      if (c.dbConnected !== undefined) setDbConnected(c.dbConnected);
      if (c.repoUrl !== undefined) setRepoUrl(c.repoUrl);
      if (c.dbHost !== undefined) setDbHost(c.dbHost);
      if (c.dbName !== undefined) setDbName(c.dbName);
      if (c.dbHint !== undefined) setDbHint(c.dbHint);
    },
    []
  );

  const requestProdGate = useCallback(
    (action: () => void) => {
      if (env !== "prod") {
        action();
        return;
      }
      setPendingProdAction(() => action);
      setModal("prodGate");
    },
    [env]
  );

  const clearProdGate = useCallback(() => {
    setPendingProdAction(null);
    setModal(null);
  }, []);

  const confirmProdGate = useCallback(() => {
    const action = pendingProdAction;
    setPendingProdAction(null);
    setModal(null);
    action?.();
  }, [pendingProdAction]);

  const isFullyConnected =
    forceConnected || (repoConnected && dbConnected);

  const value = useMemo(
    () => ({
      activeSection,
      setActiveSection,
      backendTab,
      setBackendTab,
      selectedTableId,
      setSelectedTableId,
      selectedEndpointId,
      setSelectedEndpointId,
      selectedFilePath,
      setSelectedFilePath,
      selectedPlanId,
      setSelectedPlanId,
      planReviewMode,
      setPlanReviewMode,
      env,
      setEnv,
      repoConnected,
      dbConnected,
      setConnections,
      repoUrl,
      dbHost,
      dbName,
      dbHint,
      isFullyConnected,
      forceConnected,
      inspectorWidth,
      setInspectorWidth,
      inspectorCollapsed,
      setInspectorCollapsed,
      modal,
      setModal,
      pendingProdAction,
      requestProdGate,
      clearProdGate,
      confirmProdGate,
    }),
    [
      activeSection,
      backendTab,
      selectedTableId,
      selectedEndpointId,
      selectedFilePath,
      selectedPlanId,
      planReviewMode,
      env,
      repoConnected,
      dbConnected,
      setConnections,
      repoUrl,
      dbHost,
      dbName,
      dbHint,
      isFullyConnected,
      forceConnected,
      inspectorWidth,
      inspectorCollapsed,
      modal,
      pendingProdAction,
      requestProdGate,
      clearProdGate,
      confirmProdGate,
    ]
  );

  return (
    <ProjectStoreContext.Provider value={value}>
      {children}
    </ProjectStoreContext.Provider>
  );
}

export function useProjectStore() {
  const ctx = useContext(ProjectStoreContext);
  if (!ctx) throw new Error("useProjectStore must be used within provider");
  return ctx;
}
