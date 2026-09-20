import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { AuthResult, AuthUser, SignUpCredentials } from './cloud/auth';
import { hasLocalStudyData, mergeLocalStudyData } from './cloud/local-migration';
import { loadCloudRuntime, type CloudRuntime, unavailableCloudRuntime } from './cloud/runtime';
import { SyncCoordinator } from './cloud/sync';
import type { SyncStatus, SyncWarning } from './cloud/types';
import {
  createAgentPrepDatabase,
  db as guestDatabase,
  getUserDatabaseName,
  type AgentPrepDatabase,
} from './db';

const LAST_SYNC_KEY = 'device:lastSuccessfulSyncAt';
const GUEST_MIGRATION_KEY = 'device:guestMigrationDecision';

interface AccountContextValue {
  authAvailable: boolean;
  authLoading: boolean;
  user: AuthUser | null;
  database: AgentPrepDatabase;
  syncStatus: SyncStatus;
  lastSuccessfulSyncAt: string | null;
  syncWarnings: readonly SyncWarning[];
  guestMigrationPending: boolean;
  signIn(credentials: SignUpCredentials): Promise<void>;
  signUp(credentials: SignUpCredentials): Promise<AuthResult>;
  signOut(): Promise<void>;
  syncNow(): Promise<void>;
  mergeGuestData(): Promise<void>;
  skipGuestMigration(): Promise<void>;
  notifyLocalMutation(): void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used inside AccountProvider.');
  return value;
}

export function AccountProvider({
  children,
  database: databaseOverride,
  runtime: suppliedRuntime,
}: {
  children: ReactNode;
  database?: AgentPrepDatabase | undefined;
  runtime?: CloudRuntime | undefined;
}) {
  const [runtime, setRuntime] = useState(suppliedRuntime ?? unavailableCloudRuntime);
  const [runtimeLoaded, setRuntimeLoaded] = useState(Boolean(suppliedRuntime));
  const [authLoading, setAuthLoading] = useState(true);
  const [scope, setScope] = useState(() => ({
    user: null as AuthUser | null,
    database: databaseOverride ?? guestDatabase,
    cloudStore: null as ReturnType<CloudRuntime['createStudyStore']>,
  }));
  const ownedDatabase = useRef<AgentPrepDatabase | undefined>(undefined);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<string | null>(null);
  const [syncWarnings, setSyncWarnings] = useState<readonly SyncWarning[]>([]);
  const [guestMigrationPending, setGuestMigrationPending] = useState(false);
  const activeUserId = useRef<string | null>(null);
  const scopeVersion = useRef(0);
  const coordinatorEntry = useRef({
    database: scope.database,
    coordinator: new SyncCoordinator(),
  });
  if (coordinatorEntry.current.database !== scope.database) {
    coordinatorEntry.current = { database: scope.database, coordinator: new SyncCoordinator() };
  }
  const coordinator = coordinatorEntry.current.coordinator;

  useEffect(() => {
    if (suppliedRuntime) {
      setRuntime(suppliedRuntime);
      setRuntimeLoaded(true);
      return;
    }
    let active = true;
    void loadCloudRuntime()
      .then((loaded) => {
        if (active) setRuntime(loaded);
      })
      .catch((error: unknown) => {
        console.error('AgentPrep cloud configuration failed', error);
        if (active) setRuntime(unavailableCloudRuntime);
      })
      .finally(() => {
        if (active) setRuntimeLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [suppliedRuntime]);

  const activateUser = useCallback(
    async (user: AuthUser | null) => {
      if (activeUserId.current === user?.id) return;
      activeUserId.current = user?.id ?? null;
      scopeVersion.current += 1;
      const nextDatabase = databaseOverride
        ? databaseOverride
        : user
          ? createAgentPrepDatabase(getUserDatabaseName(user.id))
          : guestDatabase;
      const previousOwned = ownedDatabase.current;
      ownedDatabase.current = !databaseOverride && user ? nextDatabase : undefined;
      previousOwned?.close();
      setScope({
        user,
        database: nextDatabase,
        cloudStore: user ? runtime.createStudyStore(user.id) : null,
      });
      setSyncStatus(user && !navigator.onLine ? 'offline' : 'idle');
      setSyncWarnings([]);

      const lastSync = await nextDatabase.settings.get(LAST_SYNC_KEY);
      setLastSuccessfulSyncAt(typeof lastSync?.value === 'string' ? lastSync.value : null);
      if (user && !databaseOverride) {
        const migrationDecision = await nextDatabase.settings.get(GUEST_MIGRATION_KEY);
        setGuestMigrationPending(!migrationDecision && (await hasLocalStudyData(guestDatabase)));
      } else {
        setGuestMigrationPending(false);
      }
    },
    [databaseOverride, runtime],
  );

  useEffect(() => {
    if (!runtimeLoaded) return;
    let active = true;
    const unsubscribe = runtime.auth.onAuthStateChange((user) => {
      if (active) void activateUser(user);
    });
    void runtime.auth
      .getCurrentUser()
      .then((user) => (active ? activateUser(user) : undefined))
      .catch(() => (active ? activateUser(null) : undefined))
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [activateUser, runtime, runtimeLoaded]);

  useEffect(
    () => () => {
      ownedDatabase.current?.close();
    },
    [],
  );

  const syncNow = useCallback(async () => {
    if (!scope.user || !scope.cloudStore) return;
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }
    const activeScopeVersion = scopeVersion.current;
    setSyncStatus('syncing');
    try {
      const result = await coordinator.reconcile(scope.database, scope.cloudStore);
      if (result.warnings.length > 0) console.warn('AgentPrep sync warnings', result.warnings);
      const timestamp = new Date().toISOString();
      await scope.database.settings.put({
        key: LAST_SYNC_KEY,
        value: timestamp,
        updatedAt: timestamp,
      });
      if (scopeVersion.current !== activeScopeVersion) return;
      setSyncWarnings(result.warnings);
      setLastSuccessfulSyncAt(timestamp);
      setSyncStatus('synced');
    } catch (error) {
      console.error('AgentPrep sync failed', error);
      if (scopeVersion.current === activeScopeVersion) {
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
      }
    }
  }, [coordinator, scope.cloudStore, scope.database, scope.user]);

  useEffect(() => {
    if (scope.user && scope.cloudStore) void syncNow();
  }, [scope.cloudStore, scope.user, syncNow]);

  useEffect(() => {
    const handleOnline = () => void syncNow();
    const handleOffline = () => {
      if (scope.user) setSyncStatus('offline');
    };
    const handleFocus = () => void syncNow();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void syncNow();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [scope.user, syncNow]);

  async function signIn(credentials: SignUpCredentials) {
    const user = await runtime.auth.signIn(credentials);
    await activateUser(user);
    setAuthLoading(false);
  }

  async function signUp(credentials: SignUpCredentials) {
    const result = await runtime.auth.signUp(credentials);
    if (!result.requiresEmailConfirmation && result.user) await activateUser(result.user);
    setAuthLoading(false);
    return result;
  }

  async function signOut() {
    await runtime.auth.signOut();
    await activateUser(null);
  }

  async function setMigrationDecision(value: 'merged' | 'skipped') {
    const timestamp = new Date().toISOString();
    await scope.database.settings.put({
      key: GUEST_MIGRATION_KEY,
      value,
      updatedAt: timestamp,
    });
    setGuestMigrationPending(false);
  }

  async function mergeGuestData() {
    if (!scope.user) return;
    await mergeLocalStudyData(guestDatabase, scope.database);
    await setMigrationDecision('merged');
    await syncNow();
  }

  async function skipGuestMigration() {
    await setMigrationDecision('skipped');
  }

  const value: AccountContextValue = {
    authAvailable: runtime.auth.available,
    authLoading,
    user: scope.user,
    database: scope.database,
    syncStatus,
    lastSuccessfulSyncAt,
    syncWarnings,
    guestMigrationPending,
    signIn,
    signUp,
    signOut,
    syncNow,
    mergeGuestData,
    skipGuestMigration,
    notifyLocalMutation() {
      if (scope.user) void syncNow();
    },
  };

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function getSyncStatusLabel(status: SyncStatus, authenticated: boolean) {
  if (!authenticated) return '仅本机';
  switch (status) {
    case 'syncing':
      return '同步中';
    case 'synced':
      return '已同步';
    case 'offline':
      return '离线模式';
    case 'error':
      return '同步待重试';
    case 'idle':
      return '本机已就绪';
  }
}
