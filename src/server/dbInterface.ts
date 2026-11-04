import {
  User,
  Project,
  ProjectMember,
  ProjectDocument,
  Finding,
  HandoverReport,
  GitHubConnection,
  ActivityLog,
  SourceRecord,
  SourceConnection,
} from '../types/index.ts';

export type DatabaseMode = 'postgres' | 'json';

export interface DatabaseHealth {
  status: 'UP' | 'DOWN';
  mode: DatabaseMode;
  latencyMs?: number;
  error?: string;
}

export interface IKnowbridgeDatabase {
  readonly mode: DatabaseMode;

  // --- Users ---
  findUserByEmail(email: string): Promise<(User & { passwordHash: string }) | undefined>;
  findUserById(id: string): Promise<User | null>;
  createUser(userData: {
    email: string;
    name: string;
    title: string;
    password: string;
    role?: 'OWNER' | 'ADMIN' | 'MANAGER' | 'LEAD' | 'REVIEWER' | 'MEMBER';
  }): Promise<User>;

  // --- Projects ---
  getProjects(): Promise<Project[]>;
  getProjectsForUser(userId: string): Promise<Project[]>;
  getProjectById(id: string): Promise<Project | null>;
  createProject(projectData: Partial<Project> & { name: string; ownerId: string; ownerName: string }): Promise<Project | null>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | null>;

  // --- Project Members ---
  getProjectMembers(projectId: string): Promise<ProjectMember[]>;
  addProjectMember(projectId: string, user: User, role: User['role']): Promise<ProjectMember>;
  removeProjectMember(projectId: string, userId: string): Promise<boolean>;

  // --- Documents ---
  getDocuments(projectId: string): Promise<ProjectDocument[]>;
  getDocumentById(id: string): Promise<ProjectDocument | null>;
  addDocument(doc: ProjectDocument): Promise<ProjectDocument>;
  ingestDocumentIfAbsent(
    doc: ProjectDocument,
    sourceRecords: SourceRecord[],
  ): Promise<{ document: ProjectDocument; inserted: boolean }>;
  updateDocument(id: string, updates: Partial<ProjectDocument>): Promise<ProjectDocument | null>;
  deleteDocument(id: string): Promise<boolean>;
  findDocumentByHash(projectId: string, contentHash: string): Promise<ProjectDocument | null>;

  // --- Findings ---
  getFindings(projectId: string): Promise<Finding[]>;
  getFindingById(id: string): Promise<Finding | null>;
  addFinding(finding: Finding): Promise<Finding>;
  addFindings(newFindings: Finding[]): Promise<Finding[]>;
  replaceAiFindingsForDocument(documentId: string, newFindings: Finding[]): Promise<boolean>;
  updateFinding(id: string, updates: Partial<Finding>): Promise<Finding | null>;

  // --- Handover Reports ---
  getHandoverReports(projectId: string): Promise<HandoverReport[]>;
  getHandoverReportById(id: string): Promise<HandoverReport | null>;
  saveHandoverReport(report: HandoverReport): Promise<HandoverReport>;

  // --- GitHub Integrations ---
  getGitHubConnection(projectId: string): Promise<GitHubConnection | null>;
  saveGitHubConnection(conn: GitHubConnection): Promise<GitHubConnection>;

  // --- Activity Logs ---
  logActivity(log: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<ActivityLog>;
  getActivityLogs(projectId: string): Promise<ActivityLog[]>;

  // --- Source Records (Unified Canonical Model) ---
  getSourceRecords(projectId: string): Promise<SourceRecord[]>;
  saveSourceRecords(records: SourceRecord[]): Promise<SourceRecord[]>;
  deleteSourceRecordsByPlatform(projectId: string, platform: string): Promise<void>;

  // --- Source Connections (Connectors Center) ---
  getSourceConnections(projectId: string): Promise<SourceConnection[]>;
  getSourceConnection(projectId: string, service: string): Promise<SourceConnection | null>;
  saveSourceConnection(conn: SourceConnection): Promise<SourceConnection>;
  removeSourceConnection(projectId: string, service: string): Promise<void>;

  // --- RAG Queries & Audit Trail ---
  saveRagQuery(projectId: string, question: string, answer: any, userId?: string): Promise<{
    id: string;
    projectId: string;
    userId?: string;
    question: string;
    answer: any;
    timestamp: string;
  }>;
  getRagQueries(projectId: string): Promise<any[]>;

  // --- Transaction Support ---
  withTransaction<T>(fn: (txDb: IKnowbridgeDatabase) => Promise<T>): Promise<T>;

  // --- Lifecycle & Testing Utilities ---
  save(): Promise<void>;
  resetToDefaultSeed(): Promise<boolean>;
}
