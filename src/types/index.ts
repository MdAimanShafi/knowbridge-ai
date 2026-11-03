export type UserRole = 'OWNER' | 'LEAD' | 'REVIEWER' | 'MEMBER';

export interface User {
  id: string;
  email: string;
  name: string;
  title: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
}

export type ProjectStatus = 'ACTIVE' | 'HANDOVER_IN_PROGRESS' | 'HANDOVER_COMPLETE' | 'ARCHIVED';

export interface TeamMemberConfig {
  name: string;
  email: string;
  role: string;
  responsibilities: string;
}

export interface ProjectDeadline {
  title: string;
  date: string;
  owner?: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  status: ProjectStatus;
  ownerId: string;
  ownerName: string;
  
  // Handover specific context
  departingMemberName?: string;
  departingMemberRole?: string;
  successorName?: string;
  targetHandoverDate?: string;

  // New Project Wizard initial setup fields (User-entered provenance)
  objectives?: string;
  startDate?: string;
  expectedCompletionDate?: string;
  teamMembers?: TeamMemberConfig[];
  techStack?: string[];
  importantDeadlines?: ProjectDeadline[];
  knownRisks?: string[];
  existingDependencies?: string[];
  projectDocumentationNotes?: string;
  setupCompleted?: boolean;
  currentSetupStep?: number;

  createdAt: string;
  updatedAt: string;

  // Aggregated metrics
  documentCount?: number;
  findingsCount?: number;
  pendingReviewCount?: number;
  approvedCount?: number;
  risksCount?: number;
  sourceRecordsCount?: number;
  connectedSourcesCount?: number;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: UserRole;
  responsibilities?: string;
  joinedAt: string;
}

export type DocumentStatus = 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'ERROR';

export interface DocumentPageChunk {
  pageNumber: number;
  sheetName?: string;
  text: string;
  chunkHash?: string;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  filename: string;
  originalName: string;
  filesize: number;
  mimeType: string;
  pageCount: number;
  status: DocumentStatus;
  uploaderId: string;
  uploaderName: string;
  contentHash: string; // SHA-256 for duplicate detection
  extractedText?: string;
  pages?: DocumentPageChunk[];
  summary?: string;
  uploadedAt: string;
  processedAt?: string;
  error?: string;
  provenance: 'USER_UPLOAD' | 'INTEGRATION_SYNC';
}

export type FindingCategory =
  | 'DECISION'
  | 'COMPLETED_WORK'
  | 'PENDING_TASK'
  | 'DEPENDENCY'
  | 'BLOCKER'
  | 'RISK'
  | 'ARCHITECTURE'
  | 'UNRESOLVED_QUESTION';

export type EvidenceStatus =
  | 'VERIFIED'
  | 'UNCERTAIN'
  | 'CONFLICTING'
  | 'MISSING_EVIDENCE';

export type ReviewStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'NEEDS_CLARIFICATION';

export interface Finding {
  id: string;
  projectId: string;
  title: string;
  description: string;
  category: FindingCategory;
  evidenceStatus: EvidenceStatus;
  reviewStatus: ReviewStatus;
  
  // Traceability & Evidence
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  sourceRecordId?: string;
  sourcePlatform?: 'DOCUMENT' | 'GITHUB' | 'GOOGLE_DRIVE' | 'JIRA' | 'SLACK' | 'USER_INPUT';
  sourceUrl?: string;
  pageNumber?: number;
  evidenceExcerpt?: string;
  conflictingDetails?: string;
  uncertaintyReason?: string;
  
  // Domain metadata
  owner?: string;
  deadline?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impact?: string;
  rationale?: string;
  
  // Review Audit
  reviewerId?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewerNotes?: string;
  isAiGenerated: boolean;
  provenanceType?: 'DIRECT_SOURCE_FACT' | 'AI_INTERPRETATION' | 'USER_PROVIDED' | 'UNVERIFIED_ASSUMPTION';
  createdAt: string;
  updatedAt: string;
}

// Canonical Unified Source Record Model
export type SourcePlatform = 'GITHUB' | 'DOCUMENT' | 'GOOGLE_DRIVE' | 'JIRA' | 'SLACK' | 'NOTION' | 'GOOGLE_CALENDAR' | 'MS_TEAMS';

export type SourceRecordType = 'COMMIT' | 'PULL_REQUEST' | 'ISSUE' | 'FILE' | 'COMMENT' | 'DOCUMENT_CHUNK' | 'EVENT';

export interface SourceRecord {
  id: string;
  projectId: string;
  sourcePlatform: SourcePlatform;
  externalSourceId: string;
  sourceUrl: string;
  recordType: SourceRecordType;
  title: string;
  content: string;
  author: string;
  createdDate: string;
  updatedDate: string;
  retrievedDate: string;
  lastSynchronisedDate: string;
  contentHash: string;
  permissionMetadata: {
    isPublic: boolean;
    visibility: string;
    requiredRole: string;
  };
  version: number;
  metadata?: Record<string, any>;
}

// Connector & Integration Management
export type ConnectorService =
  | 'GITHUB'
  | 'DOCUMENT'
  | 'GOOGLE_DRIVE'
  | 'JIRA'
  | 'SLACK'
  | 'NOTION'
  | 'GOOGLE_CALENDAR'
  | 'MS_TEAMS';

export type ConnectionStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'SYNCING'
  | 'AUTH_REQUIRED'
  | 'ERROR';

export interface SyncJobRecord {
  id: string;
  timestamp: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  recordsImported: number;
  recordsUpdated: number;
  errorsCount: number;
  durationMs: number;
  summary: string;
}

export interface SourceConnection {
  id: string;
  projectId: string;
  service: ConnectorService;
  name: string;
  status: ConnectionStatus;
  accountOrWorkspace: string;
  connectedProject: string;
  lastSyncAt: string | null;
  nextScheduledSyncAt: string | null;
  importedRecordsCount: number;
  failedRecordsCount: number;
  permissionStatus: string;
  authConfig: {
    repoOwner?: string;
    repoName?: string;
    branch?: string;
    accessTokenMasked?: string;
    folderId?: string;
    webhookActive?: boolean;
    scopeSummary?: string;
  };
  syncHistory: SyncJobRecord[];
  createdAt: string;
  updatedAt: string;
}

// RAG Q&A Engine Types
export type RagVerificationStatus =
  | 'VERIFIED'
  | 'PARTIALLY_VERIFIED'
  | 'CONFLICTING'
  | 'NOT_FOUND'
  | 'STALE'
  | 'UNAUTHORISED';

export interface SupportingSourceCitation {
  id: string;
  title: string;
  platform: SourcePlatform;
  recordType?: SourceRecordType;
  externalId: string;
  url: string;
  pageOrCommitId?: string;
  excerpt: string;
  author?: string;
  lastUpdated: string;
  retrievedAt: string;
  freshnessStatus?: 'FRESH' | 'STALE';
}

export interface ConflictingSourcePair {
  sourceA: {
    title: string;
    platform: string;
    excerpt: string;
    timestamp: string;
    url: string;
  };
  sourceB: {
    title: string;
    platform: string;
    excerpt: string;
    timestamp: string;
    url: string;
  };
  contradiction: string;
}

export interface RagQueryRequest {
  question: string;
  filter?: {
    sourcePlatform?: SourcePlatform;
    author?: string;
    dateRange?: string;
  };
}

export interface RagAnswerResponse {
  queryId: string;
  question: string;
  answer: string;
  verificationStatus: RagVerificationStatus;
  confidenceScore: number;
  supportingSources: SupportingSourceCitation[];
  conflictingSources?: ConflictingSourcePair[];
  missingInformation?: string[];
  latencyMs: number;
  timestamp: string;
  suggestedFollowUps?: string[];
}

export interface HandoverReport {
  id: string;
  projectId: string;
  title: string;
  version: string;
  generatedById: string;
  generatedByName: string;
  generatedAt: string;
  projectOverview: string;
  currentStatus: string;
  completedWork: Finding[];
  pendingTasks: Finding[];
  decisions: Finding[];
  dependencies: Finding[];
  risksAndBlockers: Finding[];
  unresolvedQuestions: Finding[];
  missingAndConflictingInfo: Finding[];
  unapprovedFindings?: Finding[];
  recommendedNextActions: {
    priority: number;
    title: string;
    description: string;
    suggestedOwner: string;
    deadline?: string;
  }[];
  sourceReferences: {
    documentId: string;
    filename: string;
    pagesCovered: string;
    findingsCount: number;
  }[];
  executiveSignOff?: {
    approvedBy: string;
    approvalDate: string;
    notes: string;
  };
}

export interface GitHubConnection {
  id: string;
  projectId: string;
  repoOwner: string;
  repoName: string;
  branch: string;
  connectedAt: string;
  lastSyncedAt?: string;
  openIssuesCount: number;
  openPRsCount: number;
  recentCommitsCount: number;
  status: 'CONNECTED' | 'SYNCED' | 'AUTH_REQUIRED' | 'ERROR';
}

export interface ActivityLog {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  action: string;
  category: 'DOCUMENT' | 'AI_EXTRACTION' | 'REVIEW' | 'HANDOVER' | 'GITHUB' | 'PROJECT' | 'RAG_QUERY' | 'SYNC';
  details: string;
  timestamp: string;
}
