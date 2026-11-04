import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
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
import { IKnowbridgeDatabase, DatabaseMode, DatabaseHealth } from './dbInterface.ts';
import { pgDb, PgDatabase } from './pgDb.ts';
import { isPostgresConfigured, checkPostgresHealth, runMigrations, closePool } from './pgPool.ts';

export type { IKnowbridgeDatabase, DatabaseMode, DatabaseHealth };

export interface DatabaseSchema {
  users: (User & { passwordHash: string })[];
  projects: Project[];
  projectMembers: ProjectMember[];
  documents: ProjectDocument[];
  findings: Finding[];
  handoverReports: HandoverReport[];
  githubConnections: GitHubConnection[];
  sourceRecords: SourceRecord[];
  sourceConnections: SourceConnection[];
  ragQueries: {
    id: string;
    projectId: string;
    userId?: string;
    question: string;
    answer: any;
    timestamp: string;
  }[];
  activityLogs: ActivityLog[];
}

const DATA_FILE = path.resolve(
  process.env.KNOWBRIDGE_DATA_FILE || path.join(process.cwd(), 'data', 'knowbridge_store.json')
);
const DATA_DIR = path.dirname(DATA_FILE);

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Seed Data with Real Synthetic Documents for Hackathon Demo
export function getInitialData(): DatabaseSchema {
  const salt = bcrypt.genSaltSync(10);
  const defaultPasswordHash = bcrypt.hashSync('demo123', salt);

  const demoUser: User & { passwordHash: string } = {
    id: 'user-demo-1',
    email: 'demo@knowbridge.ai',
    name: 'Alex Rivera',
    title: 'Incoming Senior Engineer (Successor)',
    role: 'LEAD',
    passwordHash: defaultPasswordHash,
    createdAt: '2026-10-15T09:00:00Z',
  };

  const sarahUser: User & { passwordHash: string } = {
    id: 'user-sarah-2',
    email: 'sarah.lin@phoenix-retail.com',
    name: 'Sarah Lin',
    title: 'Staff Platform Architect (Departing)',
    role: 'OWNER',
    passwordHash: defaultPasswordHash,
    createdAt: '2026-08-01T10:00:00Z',
  };

  const marcusUser: User & { passwordHash: string } = {
    id: 'user-marcus-3',
    email: 'marcus.vance@phoenix-retail.com',
    name: 'Marcus Vance',
    title: 'Engineering Director & Reviewer',
    role: 'REVIEWER',
    passwordHash: defaultPasswordHash,
    createdAt: '2026-08-10T11:00:00Z',
  };

  const phoenixProject: Project = {
    id: 'proj-phoenix-001',
    name: 'E-Commerce Platform Migration',
    code: 'PHX-MIG',
    description:
      'Mission-critical replatforming of legacy monolithic storefront to distributed microservices on Kubernetes, including multi-region database migration and payment gateway overhaul.',
    category: 'Cloud Infrastructure & Core Services',
    status: 'HANDOVER_IN_PROGRESS',
    ownerId: sarahUser.id,
    ownerName: sarahUser.name,
    departingMemberName: 'Sarah Lin (Staff Architect)',
    departingMemberRole: 'Original Core Architect & Tech Lead',
    successorName: 'Alex Rivera (Incoming Senior Engineer)',
    targetHandoverDate: '2026-11-15',
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-11-01T18:30:00Z',
  };

  const telehealthProject: Project = {
    id: 'proj-telehealth-002',
    name: 'HealthBridge Telehealth Gateway v2.4',
    code: 'HLT-GW',
    description:
      'HIPAA-compliant WebRTC audio/video consultations proxy with end-to-end audit trails and EHR integration.',
    category: 'Healthcare & Regulatory',
    status: 'ACTIVE',
    ownerId: sarahUser.id,
    ownerName: sarahUser.name,
    departingMemberName: 'Dr. Emily Chen (Lead Systems Eng)',
    departingMemberRole: 'Security & Video Pipeline Lead',
    successorName: 'David Kalu (Systems Engineer)',
    targetHandoverDate: '2026-12-01',
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-28T14:15:00Z',
  };

  const members: ProjectMember[] = [
    {
      id: 'pm-1',
      projectId: phoenixProject.id,
      userId: sarahUser.id,
      userName: sarahUser.name,
      userEmail: sarahUser.email,
      role: 'OWNER',
      joinedAt: '2026-09-01T08:00:00Z',
    },
    {
      id: 'pm-2',
      projectId: phoenixProject.id,
      userId: demoUser.id,
      userName: demoUser.name,
      userEmail: demoUser.email,
      role: 'LEAD',
      joinedAt: '2026-10-20T10:00:00Z',
    },
    {
      id: 'pm-3',
      projectId: phoenixProject.id,
      userId: marcusUser.id,
      userName: marcusUser.name,
      userEmail: marcusUser.email,
      role: 'REVIEWER',
      joinedAt: '2026-09-05T09:00:00Z',
    },
  ];

  const docArchitecture: ProjectDocument = {
    id: 'doc-arch-001',
    projectId: phoenixProject.id,
    filename: 'Project_Architecture_Specification_v3.pdf',
    originalName: 'Project Architecture Specification v3.pdf',
    filesize: 1420800,
    mimeType: 'application/pdf',
    pageCount: 14,
    status: 'EXTRACTED',
    uploaderId: sarahUser.id,
    uploaderName: sarahUser.name,
    contentHash: 'hash-arch-seed-001',
    provenance: 'USER_UPLOAD',
    uploadedAt: '2026-09-12T14:22:00Z',
    processedAt: '2026-09-12T14:25:00Z',
    summary:
      'Defines the target microservices topology, PostgreSQL 16 read-replica clusters, Envoy gateway routing rules, and JWT auth flow.',
    pages: [
      {
        pageNumber: 1,
        text: 'E-COMMERCE PLATFORM MIGRATION SPECIFICATION\nDocument ID: DOC-PHX-ARCH-03\nAuthor: Sarah Lin, Staff Platform Architect\n1. Executive Summary\nThe legacy monolith (PHP/MySQL) is being decommissioned in favor of an event-driven Go and Node.js microservices architecture deployed to Google Kubernetes Engine (GKE). Core data persistence will transition to managed PostgreSQL with Citus distributed sharding.',
      },
      {
        pageNumber: 3,
        text: '3. Technical Decision Record: Database Migration Strategy\nDECISION: We have chosen PostgreSQL 16 over DynamoDB and MongoDB.\nRATIONALE: Relational consistency across order line items, strict ACID guarantees during payment transactions, and native JSONB capabilities for flexible product catalog facets.\nSTATUS: Migration tooling (Debezium + Kafka CDC pipeline) is completed for 80% of tables. Final cutover scheduled for November 12, 2026.',
      },
      {
        pageNumber: 7,
        text: '7. Authentication and Service Mesh Communication\nDECISION: All inter-service gRPC communication will enforce mutual TLS (mTLS) through Istio sidecars.\nDEPENDENCY: Service-to-service authorization depends strictly on the central user-service auth module emitting RS256 signed tokens.\nBLOCKER: The auth module latency spikes under load (p99 > 340ms) when validating expired session tokens against Redis.',
      },
    ],
  };

  const docPaymentNotes: ProjectDocument = {
    id: 'doc-pay-002',
    projectId: phoenixProject.id,
    filename: 'Payment_Integration_and_PCI_Scope_Notes.pdf',
    originalName: 'Payment Integration and PCI Scope Notes.pdf',
    filesize: 852000,
    mimeType: 'application/pdf',
    pageCount: 8,
    status: 'EXTRACTED',
    uploaderId: sarahUser.id,
    uploaderName: sarahUser.name,
    contentHash: 'hash-pay-seed-002',
    provenance: 'USER_UPLOAD',
    uploadedAt: '2026-10-02T09:15:00Z',
    processedAt: '2026-10-02T09:17:00Z',
    summary:
      'Payment provider integration analysis, Stripe vs Adyen evaluation, tokenization workflow, and PCI-DSS Level 1 compliance requirements.',
    pages: [
      {
        pageNumber: 2,
        text: 'PAYMENT INTEGRATION ARCHITECTURE & PCI SCOPE\nAuthor: Sarah Lin\nEvaluated: Stripe vs Adyen.\nDECISION: Primary gateway is Stripe Checkout Custom Flow with customer vaulting.\nCRITICAL CAVEAT: The multi-currency settlement webhook handler has an unhandled edge case: idempotent retry loops can fail if Stripe sends duplicated invoice.payment_succeeded events within 500ms.',
      },
      {
        pageNumber: 5,
        text: '5. Regulatory & Audit Requirements\nAll credit card payloads must never touch application disk storage. SAQ-A-EP scope is enforced via Stripe Elements iframe integration.\nRISK: Legacy PCI SAQ certificate expires on December 31, 2026. Recertification audit has not been booked with the QSA.',
      },
    ],
  };

  const docStatusReport: ProjectDocument = {
    id: 'doc-stat-003',
    projectId: phoenixProject.id,
    filename: 'Q3_Engineering_Handover_Status_Report.pdf',
    originalName: 'Q3 Engineering Handover Status Report.pdf',
    filesize: 640000,
    mimeType: 'application/pdf',
    pageCount: 5,
    status: 'EXTRACTED',
    uploaderId: sarahUser.id,
    uploaderName: sarahUser.name,
    contentHash: 'hash-stat-seed-003',
    provenance: 'USER_UPLOAD',
    uploadedAt: '2026-10-25T16:00:00Z',
    processedAt: '2026-10-25T16:02:00Z',
    summary:
      'Sprint velocity overview, remaining cutover milestones, infrastructure cost projections, and open team operational dependencies.',
    pages: [
      {
        pageNumber: 1,
        text: 'PHOENIX RETAIL PLATFORM - TRANSITION STATUS\nSprint 42-44 Final Report\nAuthor: Sarah Lin\nTarget Handover Date: November 15, 2026.\nIncoming Successor: Alex Rivera.\nOverall Project Status: YELLOW (Amber) due to pending third-party load testing and staging database synchronization.',
      },
      {
        pageNumber: 4,
        text: '4. Outstanding Risks and Unresolved Questions\n1. Database failover test in staging showed a 42-second connection drop when primary node restarted.\n2. GitHub Actions secret rotation pipeline lacks automated token refresh for the staging deployment bot.\n3. Kafka consumer lag on order-events topic increases during 4x simulated load peaks.',
      },
    ],
  };

  const findings: any[] = [
    {
      id: 'fnd-arch-001',
      projectId: phoenixProject.id,
      title: 'PostgreSQL 16 Citus Distributed Cluster Migration Strategy',
      description:
        'Monolithic PHP/MySQL decommissioned in favor of managed PostgreSQL 16 with Citus distributed sharding. 80% of CDC tables synced via Debezium Kafka connector.',
      category: 'DECISION',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'APPROVED',
      sourceDocumentId: docArchitecture.id,
      sourceDocumentName: docArchitecture.originalName,
      pageNumber: 3,
      evidenceExcerpt:
        'DECISION: We have chosen PostgreSQL 16 over DynamoDB and MongoDB.\nRATIONALE: Relational consistency across order line items, strict ACID guarantees during payment transactions...',
      rationale:
        'ACID transactions across order lines require relational integrity, ruling out NoSQL alternatives.',
      impact: 'HIGH',
      severity: 'MEDIUM',
      reviewerId: marcusUser.id,
      reviewerName: marcusUser.name,
      reviewedAt: '2026-10-26T11:20:00Z',
      reviewerNotes: 'Approved architecture direction. Ensure Citus distributed query coordinator benchmarks are logged.',
      isAiGenerated: true,
      provenanceType: 'DOCUMENT_ANALYSIS',
      createdAt: '2026-10-25T16:05:00Z',
      updatedAt: '2026-10-26T11:20:00Z',
    },
    {
      id: 'fnd-arch-002',
      projectId: phoenixProject.id,
      title: 'Auth Module p99 Latency Spikes Under Load',
      description:
        'Central user-service auth module exhibits severe p99 latency spikes exceeding 340ms when validating session tokens under burst traffic against Redis cluster.',
      category: 'BLOCKER',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'NEEDS_CLARIFICATION',
      sourceDocumentId: docArchitecture.id,
      sourceDocumentName: docArchitecture.originalName,
      pageNumber: 7,
      evidenceExcerpt:
        'BLOCKER: The auth module latency spikes under load (p99 > 340ms) when validating expired session tokens against Redis.',
      conflictingDetails:
        'Architecture doc notes 340ms p99; recent staging Grafana dashboard showed 520ms p99 during black Friday load simulation.',
      uncertaintyReason: 'Root cause unclear whether Redis connection pooling or RS256 token verification CPU throttling.',
      severity: 'CRITICAL',
      impact: 'HIGH',
      owner: 'Sarah Lin',
      deadline: '2026-11-08',
      reviewerId: marcusUser.id,
      reviewerName: marcusUser.name,
      reviewedAt: '2026-10-27T09:15:00Z',
      reviewerNotes: 'Must resolve before cutover. Need concrete load test profiling from Sarah before final signoff.',
      isAiGenerated: true,
      provenanceType: 'DOCUMENT_ANALYSIS',
      createdAt: '2026-10-25T16:05:00Z',
      updatedAt: '2026-10-27T09:15:00Z',
    },
    {
      id: 'fnd-pay-001',
      projectId: phoenixProject.id,
      title: 'Stripe Webhook Concurrency Race Condition on Idempotency Keys',
      description:
        'Duplicate invoice.payment_succeeded events arriving within a 500ms window can bypass the redis idempotency lock due to lack of atomic distributed mutex.',
      category: 'RISK',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'APPROVED',
      sourceDocumentId: docPaymentNotes.id,
      sourceDocumentName: docPaymentNotes.originalName,
      pageNumber: 2,
      evidenceExcerpt:
        'CRITICAL CAVEAT: The multi-currency settlement webhook handler has an unhandled edge case: idempotent retry loops can fail if Stripe sends duplicated invoice.payment_succeeded events within 500ms.',
      severity: 'HIGH',
      impact: 'HIGH',
      owner: 'Alex Rivera',
      deadline: '2026-11-10',
      reviewerId: marcusUser.id,
      reviewerName: marcusUser.name,
      reviewedAt: '2026-10-28T14:00:00Z',
      reviewerNotes: 'Alex confirmed he will implement Redis Redlock algorithm to guard webhook ingestion.',
      isAiGenerated: true,
      provenanceType: 'DOCUMENT_ANALYSIS',
      createdAt: '2026-10-25T16:05:00Z',
      updatedAt: '2026-10-28T14:00:00Z',
    },
    {
      id: 'fnd-pay-002',
      projectId: phoenixProject.id,
      title: 'Legacy PCI-DSS SAQ-A-EP Certification Expiration on Dec 31, 2026',
      description:
        'Annual PCI Attestation of Compliance (AOC) expires December 31, 2026. Third-party QSA external penetration test and vulnerability scans must be scheduled by mid-November.',
      category: 'RISK',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'PENDING',
      sourceDocumentId: docPaymentNotes.id,
      sourceDocumentName: docPaymentNotes.originalName,
      pageNumber: 5,
      evidenceExcerpt:
        'RISK: Legacy PCI SAQ certificate expires on December 31, 2026. Recertification audit has not been booked with the QSA.',
      severity: 'HIGH',
      impact: 'MEDIUM',
      owner: 'Marcus Vance',
      deadline: '2026-11-14',
      isAiGenerated: true,
      provenanceType: 'DOCUMENT_ANALYSIS',
      createdAt: '2026-10-25T16:05:00Z',
      updatedAt: '2026-10-25T16:05:00Z',
    },
    {
      id: 'fnd-stat-001',
      projectId: phoenixProject.id,
      title: 'Database Failover Incurred 42-Second Staging Connection Outage',
      description:
        'Automated failover from primary to standby replica in GCP Cloud SQL took 42 seconds to re-route DNS, causing 18 HTTP 500 errors in upstream checkout-service.',
      category: 'RISK',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'APPROVED',
      sourceDocumentId: docStatusReport.id,
      sourceDocumentName: docStatusReport.originalName,
      pageNumber: 4,
      evidenceExcerpt:
        '1. Database failover test in staging showed a 42-second connection drop when primary node restarted.',
      severity: 'HIGH',
      impact: 'HIGH',
      owner: 'Sarah Lin',
      reviewerId: marcusUser.id,
      reviewerName: marcusUser.name,
      reviewedAt: '2026-10-29T10:00:00Z',
      reviewerNotes: 'Switch checkout connection string to use pgBouncer pooling with client_idle_timeout tuning.',
      isAiGenerated: true,
      provenanceType: 'DOCUMENT_ANALYSIS',
      createdAt: '2026-10-25T16:05:00Z',
      updatedAt: '2026-10-29T10:00:00Z',
    },
    {
      id: 'fnd-stat-002',
      projectId: phoenixProject.id,
      title: 'Kafka Consumer Lag on order-events Topic Under 4x Simulated Load',
      description:
        'Partition rebalancing storm observed when consumers autoscale from 4 to 12 pods, causing message lag to spike from 120ms to 4.8 seconds for 6 minutes.',
      category: 'BLOCKER',
      evidenceStatus: 'UNCERTAIN',
      reviewStatus: 'PENDING',
      sourceDocumentId: docStatusReport.id,
      sourceDocumentName: docStatusReport.originalName,
      pageNumber: 4,
      evidenceExcerpt:
        '3. Kafka consumer lag on order-events topic increases during 4x simulated load peaks.',
      uncertaintyReason:
        'Exact partition count (currently 16) may need expansion to 32 to prevent hot partitions on enterprise buyer accounts.',
      severity: 'MEDIUM',
      impact: 'MEDIUM',
      owner: 'Alex Rivera',
      deadline: '2026-11-12',
      isAiGenerated: true,
      provenanceType: 'DOCUMENT_ANALYSIS',
      createdAt: '2026-10-25T16:05:00Z',
      updatedAt: '2026-10-25T16:05:00Z',
    },
    {
      id: 'fnd-git-001',
      projectId: phoenixProject.id,
      title: 'Pending PR #142: Fix Redis Session Expiration Cache Stampede',
      description:
        'Implements probabilistic early expiration (XFetch algorithm) to prevent the auth module p99 latency spike identified in architecture doc.',
      category: 'TASK',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'APPROVED',
      sourcePlatform: 'GITHUB',
      sourceUrl: 'https://github.com/phoenix-retail/ecommerce-core/pull/142',
      evidenceExcerpt:
        'Pull Request #142: perf(auth): implement xfetch probabilistic cache stampede prevention for redis session lookups',
      owner: 'Sarah Lin',
      deadline: '2026-11-05',
      severity: 'LOW',
      impact: 'HIGH',
      reviewerId: marcusUser.id,
      reviewerName: marcusUser.name,
      reviewedAt: '2026-10-30T15:00:00Z',
      reviewerNotes: 'Alex Rivera will review and merge after running staging load test benchmark.',
      isAiGenerated: true,
      provenanceType: 'CONNECTOR_SYNC',
      createdAt: '2026-10-28T09:00:00Z',
      updatedAt: '2026-10-30T15:00:00Z',
    },
    {
      id: 'fnd-git-002',
      projectId: phoenixProject.id,
      title: 'Open Issue #89: CI/CD Pipeline Staging Deploy Bot Token Expiry',
      description:
        'GitHub Actions runner deployment secret expires in 11 days. Requires manual OAuth re-authorization or migration to Workload Identity Federation.',
      category: 'DEPENDENCY',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'PENDING',
      sourcePlatform: 'GITHUB',
      sourceUrl: 'https://github.com/phoenix-retail/ecommerce-core/issues/89',
      evidenceExcerpt:
        'Issue #89: Staging deployment bot token expires on 2026-11-10. Blockers for automatic rollback testing.',
      owner: 'Alex Rivera',
      deadline: '2026-11-09',
      severity: 'MEDIUM',
      impact: 'MEDIUM',
      isAiGenerated: true,
      provenanceType: 'CONNECTOR_SYNC',
      createdAt: '2026-10-28T09:00:00Z',
      updatedAt: '2026-10-28T09:00:00Z',
    },
    {
      id: 'fnd-jira-001',
      projectId: phoenixProject.id,
      title: 'Jira PHX-482: Final Database Cutover Runbook Signoff',
      description:
        'Task tracking all operational steps for live production traffic switchover from MySQL monolith to Postgres read-replicas. 8 steps completed, 4 pending.',
      category: 'TASK',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'APPROVED',
      sourcePlatform: 'JIRA',
      sourceUrl: 'https://phoenix-retail.atlassian.net/browse/PHX-482',
      evidenceExcerpt:
        'Jira Issue [PHX-482]: Database cutover execution runbook. Assignee: Sarah Lin. Status: In Progress. Estimate: 16h remaining.',
      owner: 'Sarah Lin',
      deadline: '2026-11-12',
      severity: 'LOW',
      impact: 'HIGH',
      reviewerId: marcusUser.id,
      reviewerName: marcusUser.name,
      reviewedAt: '2026-10-31T11:00:00Z',
      reviewerNotes: 'Alex will shadow the dry run on November 4.',
      isAiGenerated: true,
      provenanceType: 'CONNECTOR_SYNC',
      createdAt: '2026-10-29T10:00:00Z',
      updatedAt: '2026-10-31T11:00:00Z',
    },
    {
      id: 'fnd-slack-001',
      projectId: phoenixProject.id,
      title: 'Slack Confirmation: Stripe Multi-Currency Settlement Approved',
      description:
        'Finance team lead (Dave K.) verified EUR and GBP settlement accounts are verified in Stripe Dashboard. No cross-border FX fee risks remaining.',
      category: 'DECISION',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'APPROVED',
      sourcePlatform: 'SLACK',
      sourceUrl: 'https://phoenix-retail.slack.com/archives/C05ABC123/p1698240000',
      evidenceExcerpt:
        'Slack Thread #proj-phoenix-migration: Dave K. (Treasury): All multi-currency bank payouts are activated on the live account.',
      owner: 'Sarah Lin',
      severity: 'LOW',
      impact: 'MEDIUM',
      reviewerId: marcusUser.id,
      reviewerName: marcusUser.name,
      reviewedAt: '2026-10-30T16:00:00Z',
      reviewerNotes: 'Treasury signoff confirmed. Documentation attached to finance audit ticket.',
      isAiGenerated: true,
      provenanceType: 'CONNECTOR_SYNC',
      createdAt: '2026-10-29T12:00:00Z',
      updatedAt: '2026-10-30T16:00:00Z',
    },
  ];

  const github: GitHubConnection = {
    id: 'gh-conn-001',
    projectId: phoenixProject.id,
    repoOwner: 'phoenix-retail',
    repoName: 'ecommerce-core',
    branch: 'main',
    connectedAt: '2026-10-20T10:00:00Z',
    lastSyncedAt: '2026-11-01T14:30:00Z',
    openIssuesCount: 4,
    openPRsCount: 3,
    recentCommitsCount: 18,
    status: 'CONNECTED',
  };

  const initialSourceConnections: any[] = [
    {
      id: 'conn-github-001',
      projectId: phoenixProject.id,
      service: 'GITHUB',
      name: 'GitHub Repository',
      status: 'CONNECTED',
      accountOrWorkspace: 'phoenix-retail',
      connectedProject: 'ecommerce-core (branch: main)',
      lastSyncAt: '2026-11-01T14:30:00Z',
      importedRecordsCount: 3,
      failedRecordsCount: 0,
      permissionStatus: 'Read (Issues, PRs, Commits)',
      authConfig: { repoOwner: 'phoenix-retail', repoName: 'ecommerce-core', branch: 'main' },
      syncHistory: [
        {
          timestamp: '2026-11-01T14:30:00Z',
          status: 'SUCCESS',
          recordsImported: 3,
          durationMs: 420,
        },
      ],
      createdAt: '2026-10-20T10:00:00Z',
      updatedAt: '2026-11-01T14:30:00Z',
    },
    {
      id: 'conn-gdrive-001',
      projectId: phoenixProject.id,
      service: 'GOOGLE_DRIVE',
      name: 'Google Drive Architecture Shared Folder',
      status: 'CONNECTED',
      accountOrWorkspace: 'phoenix-retail.com (GSuite)',
      connectedProject: 'Platform Engineering / 2026 Migrations',
      lastSyncAt: '2026-10-28T09:15:00Z',
      importedRecordsCount: 1,
      failedRecordsCount: 0,
      permissionStatus: 'Read-only Shared Drive',
      authConfig: { folderId: 'folder-arch-phoenix-2026' },
      syncHistory: [
        {
          timestamp: '2026-10-28T09:15:00Z',
          status: 'SUCCESS',
          recordsImported: 1,
          durationMs: 380,
        },
      ],
      createdAt: '2026-10-22T11:00:00Z',
      updatedAt: '2026-10-28T09:15:00Z',
    },
    {
      id: 'conn-jira-001',
      projectId: phoenixProject.id,
      service: 'JIRA',
      name: 'Atlassian Jira Project Board',
      status: 'CONNECTED',
      accountOrWorkspace: 'phoenix-retail.atlassian.net',
      connectedProject: 'PHX (Phoenix Core Replatform)',
      lastSyncAt: '2026-10-31T08:00:00Z',
      importedRecordsCount: 1,
      failedRecordsCount: 0,
      permissionStatus: 'Read Issues & Sprints',
      authConfig: { projectKey: 'PHX' },
      syncHistory: [
        {
          timestamp: '2026-10-31T08:00:00Z',
          status: 'SUCCESS',
          recordsImported: 1,
          durationMs: 510,
        },
      ],
      createdAt: '2026-10-23T14:00:00Z',
      updatedAt: '2026-10-31T08:00:00Z',
    },
    {
      id: 'conn-slack-001',
      projectId: phoenixProject.id,
      service: 'SLACK',
      name: 'Slack Migration War Room',
      status: 'CONNECTED',
      accountOrWorkspace: 'phoenix-retail.slack.com',
      connectedProject: '#proj-phoenix-migration',
      lastSyncAt: '2026-11-01T10:00:00Z',
      importedRecordsCount: 1,
      failedRecordsCount: 0,
      permissionStatus: 'Bot channel history read',
      authConfig: { channelId: 'C05ABC123' },
      syncHistory: [
        {
          timestamp: '2026-11-01T10:00:00Z',
          status: 'SUCCESS',
          recordsImported: 1,
          durationMs: 290,
        },
      ],
      createdAt: '2026-10-24T16:00:00Z',
      updatedAt: '2026-11-01T10:00:00Z',
    },
    {
      id: 'conn-confluence-001',
      projectId: phoenixProject.id,
      service: 'CONFLUENCE',
      name: 'Confluence Architecture Space',
      status: 'DISCONNECTED',
      accountOrWorkspace: '',
      connectedProject: '',
      importedRecordsCount: 0,
      failedRecordsCount: 0,
      permissionStatus: 'Unauthorised',
      authConfig: {},
      syncHistory: [],
      createdAt: '2026-10-24T16:00:00Z',
      updatedAt: '2026-10-24T16:00:00Z',
    },
  ];

  const initialSourceRecords: any[] = [
    {
      id: 'sr-gh-issue-89',
      projectId: phoenixProject.id,
      sourcePlatform: 'GITHUB',
      externalSourceId: 'issue-89',
      sourceUrl: 'https://github.com/phoenix-retail/ecommerce-core/issues/89',
      recordType: 'ISSUE',
      title: 'Staging deployment bot token expires on 2026-11-10',
      content:
        'CI/CD bot token for staging cluster GKE workload identity binding expires in 11 days. If not renewed, scheduled nightly rollback and canary deployments will fail with 401 Unauthorized.',
      author: 'Sarah Lin',
      createdDate: '2026-10-28T08:30:00Z',
      retrievedDate: '2026-11-01T14:30:00Z',
      lastSynchronisedDate: '2026-11-01T14:30:00Z',
      contentHash: 'hash-sr-gh-89',
      permissionMetadata: { roleRequired: 'Developer' },
      version: 1,
      metadata: { labels: ['devops', 'blocker', 'security'], state: 'OPEN' },
    },
    {
      id: 'sr-gh-pr-142',
      projectId: phoenixProject.id,
      sourcePlatform: 'GITHUB',
      externalSourceId: 'pr-142',
      sourceUrl: 'https://github.com/phoenix-retail/ecommerce-core/pull/142',
      recordType: 'PULL_REQUEST',
      title: 'perf(auth): implement xfetch probabilistic cache stampede prevention for redis session lookups',
      content:
        'Addresses p99 latency spikes during session token validation. Replaces simple TTL expiration with XFetch algorithm (optimal delta computation). Staging benchmark shows 82% reduction in redis read bursts.',
      author: 'Sarah Lin',
      createdDate: '2026-10-28T09:00:00Z',
      retrievedDate: '2026-11-01T14:30:00Z',
      lastSynchronisedDate: '2026-11-01T14:30:00Z',
      contentHash: 'hash-sr-gh-142',
      permissionMetadata: { roleRequired: 'Developer' },
      version: 1,
      metadata: { reviewers: ['marcus-vance', 'alex-rivera'], additions: 184, deletions: 42, state: 'OPEN' },
    },
    {
      id: 'sr-gh-commit-b94e82c',
      projectId: phoenixProject.id,
      sourcePlatform: 'GITHUB',
      externalSourceId: 'commit-b94e82c',
      sourceUrl: 'https://github.com/phoenix-retail/ecommerce-core/commit/b94e82c',
      recordType: 'COMMIT',
      title: 'fix(db): add foreign key cascade and dead-letter queue index on orders_audit table',
      content:
        'Resolves orphaned audit records when test checkout sessions are purged. Adds compound index on (account_id, created_at DESC) for fast replay queries.',
      author: 'Alex Rivera',
      createdDate: '2026-10-30T17:15:00Z',
      retrievedDate: '2026-11-01T14:30:00Z',
      lastSynchronisedDate: '2026-11-01T14:30:00Z',
      contentHash: 'hash-sr-gh-b94e82c',
      permissionMetadata: { roleRequired: 'Developer' },
      version: 1,
      metadata: { sha: 'b94e82c7d91a', filesChanged: 3 },
    },
    {
      id: 'sr-gdrive-arch-spec',
      projectId: phoenixProject.id,
      sourcePlatform: 'GOOGLE_DRIVE',
      externalSourceId: 'gdrive-file-0912',
      sourceUrl: 'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view',
      recordType: 'SPECIFICATION',
      title: 'Phoenix Architecture Target State Specification (Google Doc Live Version)',
      content:
        'Live working draft of platform specifications. Section 8.4 newly added: Disaster Recovery RTO is 15 minutes, RPO is 0 seconds via synchronous Citus WAL streaming.',
      author: 'Sarah Lin',
      createdDate: '2026-10-22T10:00:00Z',
      updatedDate: '2026-10-27T16:45:00Z',
      retrievedDate: '2026-10-28T09:15:00Z',
      lastSynchronisedDate: '2026-10-28T09:15:00Z',
      contentHash: 'hash-sr-gd-arch',
      permissionMetadata: { visibility: 'Domain with link' },
      version: 3,
      metadata: { lastEditor: 'Sarah Lin', mimeType: 'application/vnd.google-apps.document' },
    },
    {
      id: 'sr-jira-phx-482',
      projectId: phoenixProject.id,
      sourcePlatform: 'JIRA',
      externalSourceId: 'jira-phx-482',
      sourceUrl: 'https://phoenix-retail.atlassian.net/browse/PHX-482',
      recordType: 'TASK',
      title: 'Database cutover execution runbook and smoke tests',
      content:
        'Step 1-8 verified in dry run. Step 9: Re-route DNS TTL to 60s (Pending). Step 10: Put MySQL storefront in maintenance mode (Pending). Step 11: Final CDC catchup sync verification (Pending). Step 12: Promote Postgres Citus master (Pending).',
      author: 'Sarah Lin',
      createdDate: '2026-10-18T11:00:00Z',
      updatedDate: '2026-10-31T07:55:00Z',
      retrievedDate: '2026-10-31T08:00:00Z',
      lastSynchronisedDate: '2026-10-31T08:00:00Z',
      contentHash: 'hash-sr-jr-482',
      permissionMetadata: { projectKey: 'PHX' },
      version: 4,
      metadata: { status: 'IN_PROGRESS', storyPoints: 8, priority: 'HIGHEST' },
    },
    {
      id: 'sr-slack-thread-settlement',
      projectId: phoenixProject.id,
      sourcePlatform: 'SLACK',
      externalSourceId: 'slack-msg-1698240000',
      sourceUrl: 'https://phoenix-retail.slack.com/archives/C05ABC123/p1698240000',
      recordType: 'DISCUSSION',
      title: 'Stripe Multi-Currency Settlement confirmation from Finance Lead',
      content:
        'Dave K. (Treasury VP): "Confirming for the handover records that GBP and EUR merchant bank accounts are fully linked in Stripe production dashboard. Payout schedule is set to daily rolling T+2. No reserve holdbacks requested."',
      author: 'Dave Kalu (Treasury)',
      createdDate: '2026-10-29T11:58:00Z',
      retrievedDate: '2026-11-01T10:00:00Z',
      lastSynchronisedDate: '2026-11-01T10:00:00Z',
      contentHash: 'hash-sr-slk-settle',
      permissionMetadata: { channel: '#proj-phoenix-migration' },
      version: 1,
      metadata: { repliesCount: 7, channelName: 'proj-phoenix-migration' },
    },
  ];

  const activityLogs: any[] = [
    {
      id: 'act-seed-1',
      projectId: phoenixProject.id,
      userId: sarahUser.id,
      userName: sarahUser.name,
      action: 'Project Created',
      category: 'PROJECT',
      details: 'Project "E-Commerce Platform Migration" created with target handover date 2026-11-15.',
      timestamp: '2026-09-01T08:00:00Z',
    },
    {
      id: 'act-seed-2',
      projectId: phoenixProject.id,
      userId: sarahUser.id,
      userName: sarahUser.name,
      action: 'Document Uploaded',
      category: 'DOCUMENT',
      details: 'Uploaded Project_Architecture_Specification_v3.pdf (14 pages).',
      timestamp: '2026-09-12T14:22:00Z',
    },
    {
      id: 'act-seed-3',
      projectId: phoenixProject.id,
      userId: sarahUser.id,
      userName: sarahUser.name,
      action: 'Document Uploaded',
      category: 'DOCUMENT',
      details: 'Uploaded Payment_Integration_and_PCI_Scope_Notes.pdf (8 pages).',
      timestamp: '2026-10-02T09:15:00Z',
    },
    {
      id: 'act-seed-4',
      projectId: phoenixProject.id,
      userId: sarahUser.id,
      userName: sarahUser.name,
      action: 'Member Added',
      category: 'MEMBER',
      details: 'Alex Rivera added as incoming technical successor (Lead Engineer).',
      timestamp: '2026-10-20T10:00:00Z',
    },
    {
      id: 'act-seed-5',
      projectId: phoenixProject.id,
      userId: sarahUser.id,
      userName: sarahUser.name,
      action: 'GitHub Connected',
      category: 'CONNECTOR',
      details: 'Connected repository phoenix-retail/ecommerce-core (branch: main).',
      timestamp: '2026-10-20T10:05:00Z',
    },
    {
      id: 'act-seed-6',
      projectId: phoenixProject.id,
      userId: sarahUser.id,
      userName: sarahUser.name,
      action: 'Document Uploaded',
      category: 'DOCUMENT',
      details: 'Uploaded Q3_Engineering_Handover_Status_Report.pdf (5 pages).',
      timestamp: '2026-10-25T16:00:00Z',
    },
    {
      id: 'act-seed-7',
      projectId: phoenixProject.id,
      userId: marcusUser.id,
      userName: marcusUser.name,
      action: 'Finding Approved',
      category: 'REVIEW',
      details: 'Approved finding "PostgreSQL 16 Citus Distributed Cluster Migration Strategy".',
      timestamp: '2026-10-26T11:20:00Z',
    },
    {
      id: 'act-seed-8',
      projectId: phoenixProject.id,
      userId: marcusUser.id,
      userName: marcusUser.name,
      action: 'Clarification Requested',
      category: 'REVIEW',
      details: 'Requested clarification on finding "Auth Module p99 Latency Spikes Under Load".',
      timestamp: '2026-10-27T09:15:00Z',
    },
    {
      id: 'act-seed-9',
      projectId: phoenixProject.id,
      userId: marcusUser.id,
      userName: marcusUser.name,
      action: 'Finding Approved',
      category: 'REVIEW',
      details: 'Approved finding "Stripe Webhook Concurrency Race Condition on Idempotency Keys".',
      timestamp: '2026-10-28T14:00:00Z',
    },
    {
      id: 'act-seed-10',
      projectId: phoenixProject.id,
      userId: demoUser.id,
      userName: demoUser.name,
      action: 'RAG Knowledge Query',
      category: 'RAG',
      details: 'Queried: "What are the unaddressed blockers preventing production cutover?" (4 citations verified).',
      timestamp: '2026-10-31T15:20:00Z',
    },
  ];

  return {
    users: [demoUser, sarahUser, marcusUser],
    projects: [phoenixProject, telehealthProject],
    projectMembers: members,
    documents: [docArchitecture, docPaymentNotes, docStatusReport],
    findings: findings as any,
    handoverReports: [],
    githubConnections: [github],
    sourceRecords: initialSourceRecords as any,
    sourceConnections: initialSourceConnections as any,
    ragQueries: [],
    activityLogs: activityLogs as any,
  };
}

// ─── JSON File-Based Database Class ──────────────────────────────────────────

export class JsonDatabase implements IKnowbridgeDatabase {
  public readonly mode = 'json' as const;
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(DATA_FILE)) {
      let parsed: DatabaseSchema;
      try {
        parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as DatabaseSchema;
      } catch (error) {
        throw new Error(`Failed to load the persisted project store at ${DATA_FILE}.`, { cause: error });
      }

      if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.projects)) {
        throw new Error(`The persisted project store at ${DATA_FILE} is invalid; refusing to overwrite it.`);
      }

      const fresh = getInitialData();
      if (!parsed.sourceConnections) {
        parsed.sourceConnections = fresh.sourceConnections;
      }
      if (!parsed.sourceRecords) {
        parsed.sourceRecords = fresh.sourceRecords;
      }
      if (!Array.isArray(parsed.projectMembers)) {
        parsed.projectMembers = fresh.projectMembers.filter((member) =>
          parsed.projects.some((project) => project.id === member.projectId)
        );
        parsed.projects.forEach((project) => {
          if (
            !parsed.projectMembers.some(
              (member) => member.projectId === project.id && member.userId === project.ownerId
            )
          ) {
            const owner = parsed.users.find((user) => user.id === project.ownerId);
            if (owner) {
              parsed.projectMembers.push({
                id: `pm-migrated-${project.id}`,
                projectId: project.id,
                userId: owner.id,
                userName: owner.name,
                userEmail: owner.email,
                role: 'OWNER',
                joinedAt: project.createdAt,
              });
            }
          }
        });
      }
      if (!Array.isArray(parsed.documents)) parsed.documents = [];
      if (!Array.isArray(parsed.findings)) parsed.findings = [];
      if (!Array.isArray(parsed.handoverReports)) parsed.handoverReports = [];
      if (!Array.isArray(parsed.githubConnections)) parsed.githubConnections = [];
      if (!Array.isArray(parsed.activityLogs)) parsed.activityLogs = [];
      parsed.ragQueries = parsed.ragQueries || [];
      this.saveDirect(parsed);
      return parsed;
    }

    const fresh = getInitialData();
    this.saveDirect(fresh);
    return fresh;
  }

  private saveDirect(dataToSave: DatabaseSchema) {
    const temporaryFile = `${DATA_FILE}.${process.pid}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporaryFile, JSON.stringify(dataToSave, null, 2), { encoding: 'utf-8', flag: 'wx' });
      fs.renameSync(temporaryFile, DATA_FILE);
    } catch (error) {
      if (fs.existsSync(temporaryFile)) {
        try {
          fs.unlinkSync(temporaryFile);
        } catch (cleanupError) {
          console.error(`Failed to remove incomplete store file ${temporaryFile}:`, cleanupError);
        }
      }
      throw new Error(`Failed to persist the project store at ${DATA_FILE}.`, { cause: error });
    }
  }

  public async save(): Promise<void> {
    this.saveDirect(this.data);
  }

  // --- Users ---
  public async findUserByEmail(email: string) {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public async findUserById(id: string) {
    const user = this.data.users.find((u) => u.id === id);
    if (!user) return null;
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  public async createUser(userData: {
    email: string;
    name: string;
    title: string;
    password: string;
    role?: 'OWNER' | 'ADMIN' | 'MANAGER' | 'LEAD' | 'REVIEWER' | 'MEMBER';
  }) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(userData.password, salt);
    const newUser: User & { passwordHash: string } = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      email: userData.email,
      name: userData.name,
      title: userData.title,
      role: userData.role || 'MEMBER',
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(newUser);
    await this.save();
    const { passwordHash: _, ...safeUser } = newUser;
    return safeUser;
  }

  // --- Projects ---
  public async getProjects() {
    return this.data.projects.map((p) => {
      const docs = this.data.documents.filter((d) => d.projectId === p.id);
      const fnds = this.data.findings.filter((f) => f.projectId === p.id);
      const pendingReviews = fnds.filter((f) => f.reviewStatus === 'PENDING');
      const approved = fnds.filter((f) => f.reviewStatus === 'APPROVED');
      const risks = fnds.filter((f) => f.category === 'RISK' || f.category === 'BLOCKER');

      return {
        ...p,
        documentCount: docs.length,
        findingsCount: fnds.length,
        pendingReviewCount: pendingReviews.length,
        approvedCount: approved.length,
        risksCount: risks.length,
      };
    });
  }

  public async getProjectsForUser(userId: string) {
    const projectIds = new Set(
      this.data.projectMembers.filter((member) => member.userId === userId).map((member) => member.projectId)
    );
    const all = await this.getProjects();
    return all.filter((project) => projectIds.has(project.id));
  }

  public async getProjectById(id: string) {
    const p = this.data.projects.find((proj) => proj.id === id);
    if (!p) return null;
    const docs = this.data.documents.filter((d) => d.projectId === p.id);
    const fnds = this.data.findings.filter((f) => f.projectId === p.id);
    const pendingReviews = fnds.filter((f) => f.reviewStatus === 'PENDING');
    const approved = fnds.filter((f) => f.reviewStatus === 'APPROVED');
    const risks = fnds.filter((f) => f.category === 'RISK' || f.category === 'BLOCKER');

    return {
      ...p,
      documentCount: docs.length,
      findingsCount: fnds.length,
      pendingReviewCount: pendingReviews.length,
      approvedCount: approved.length,
      risksCount: risks.length,
    };
  }

  public async createProject(projectData: Partial<Project> & { name: string; ownerId: string; ownerName: string }) {
    const newProj: Project = {
      id: `proj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: projectData.name,
      code: projectData.code || projectData.name.substring(0, 4).toUpperCase(),
      description: projectData.description || '',
      category: projectData.category || 'General Engineering',
      status: projectData.status || 'ACTIVE',
      ownerId: projectData.ownerId,
      ownerName: projectData.ownerName,
      departingMemberName: projectData.departingMemberName,
      departingMemberRole: projectData.departingMemberRole,
      successorName: projectData.successorName,
      targetHandoverDate: projectData.targetHandoverDate,
      objectives: projectData.objectives,
      startDate: projectData.startDate,
      expectedCompletionDate: projectData.expectedCompletionDate,
      teamMembers: projectData.teamMembers || [],
      techStack: projectData.techStack || [],
      importantDeadlines: projectData.importantDeadlines || [],
      knownRisks: projectData.knownRisks || [],
      existingDependencies: projectData.existingDependencies || [],
      projectDocumentationNotes: projectData.projectDocumentationNotes,
      setupCompleted: projectData.setupCompleted ?? false,
      currentSetupStep: projectData.currentSetupStep ?? 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.projects.push(newProj);
    await this.save();
    return this.getProjectById(newProj.id);
  }

  public async updateProject(id: string, updates: Partial<Project>) {
    const idx = this.data.projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.data.projects[idx] = {
      ...this.data.projects[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.save();
    return this.getProjectById(id);
  }

  // --- Project Members ---
  public async getProjectMembers(projectId: string) {
    return this.data.projectMembers.filter((m) => m.projectId === projectId);
  }

  public async addProjectMember(projectId: string, user: User, role: User['role']) {
    const existing = this.data.projectMembers.find(
      (member) => member.projectId === projectId && member.userId === user.id
    );
    if (existing) {
      existing.role = role;
      existing.userName = user.name;
      existing.userEmail = user.email;
      await this.save();
      return existing;
    }

    const newMember: ProjectMember = {
      id: `pm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      projectId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role,
      joinedAt: new Date().toISOString(),
    };
    this.data.projectMembers.push(newMember);
    await this.save();
    return newMember;
  }

  public async removeProjectMember(projectId: string, userId: string) {
    const previousLength = this.data.projectMembers.length;
    this.data.projectMembers = this.data.projectMembers.filter(
      (member) => !(member.projectId === projectId && member.userId === userId)
    );
    if (this.data.projectMembers.length === previousLength) return false;
    await this.save();
    return true;
  }

  // --- Documents ---
  public async getDocuments(projectId: string) {
    return this.data.documents.filter((d) => d.projectId === projectId);
  }

  public async getDocumentById(id: string) {
    return this.data.documents.find((d) => d.id === id) || null;
  }

  public async addDocument(doc: ProjectDocument) {
    this.data.documents.push(doc);
    await this.save();
    return doc;
  }

  public async ingestDocumentIfAbsent(doc: ProjectDocument, sourceRecords: SourceRecord[]) {
    const existing = this.data.documents.find(
      (document) => document.projectId === doc.projectId && document.contentHash === doc.contentHash,
    );
    if (existing) return { document: existing, inserted: false };

    this.data.documents.push(doc);
    for (const record of sourceRecords) {
      const index = this.data.sourceRecords.findIndex((current) => current.id === record.id);
      if (index >= 0) this.data.sourceRecords[index] = record;
      else this.data.sourceRecords.push(record);
    }
    await this.save();
    return { document: doc, inserted: true };
  }

  public async updateDocument(id: string, updates: Partial<ProjectDocument>) {
    const idx = this.data.documents.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    this.data.documents[idx] = { ...this.data.documents[idx], ...updates };
    await this.save();
    return this.data.documents[idx];
  }

  public async deleteDocument(id: string) {
    const idx = this.data.documents.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    this.data.documents.splice(idx, 1);
    this.data.findings = this.data.findings.filter((f) => f.sourceDocumentId !== id);
    this.data.sourceRecords = this.data.sourceRecords.filter(
      (record) =>
        record.externalSourceId !== id &&
        !record.externalSourceId.startsWith(`${id}#`) &&
        !record.id.startsWith(`sr-doc-${id}-`)
    );
    await this.save();
    return true;
  }

  public async findDocumentByHash(projectId: string, contentHash: string) {
    return this.data.documents.find((d) => d.projectId === projectId && d.contentHash === contentHash) || null;
  }

  // --- Findings ---
  public async getFindings(projectId: string) {
    return this.data.findings.filter((f) => f.projectId === projectId);
  }

  public async getFindingById(id: string) {
    return this.data.findings.find((f) => f.id === id) || null;
  }

  public async addFinding(finding: Finding) {
    const existingIndex = this.data.findings.findIndex((existing) => existing.id === finding.id);
    if (existingIndex >= 0) {
      this.data.findings[existingIndex] = finding;
    } else {
      this.data.findings.push(finding);
    }
    await this.save();
    return finding;
  }

  public async addFindings(newFindings: Finding[]) {
    newFindings.forEach((finding) => {
      const existingIndex = this.data.findings.findIndex((existing) => existing.id === finding.id);
      if (existingIndex >= 0) {
        this.data.findings[existingIndex] = finding;
      } else {
        this.data.findings.push(finding);
      }
    });
    await this.save();
    return newFindings;
  }

  public async replaceAiFindingsForDocument(documentId: string, newFindings: Finding[]) {
    const reviewedFindings = this.data.findings.filter(
      (finding) =>
        finding.sourceDocumentId === documentId &&
        finding.isAiGenerated &&
        finding.reviewStatus !== 'PENDING'
    );
    if (reviewedFindings.length > 0) return false;

    this.data.findings = this.data.findings.filter(
      (finding) => !(finding.sourceDocumentId === documentId && finding.isAiGenerated)
    );
    this.data.findings.push(...newFindings);
    await this.save();
    return true;
  }

  public async updateFinding(id: string, updates: Partial<Finding>) {
    const idx = this.data.findings.findIndex((f) => f.id === id);
    if (idx === -1) return null;
    this.data.findings[idx] = {
      ...this.data.findings[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.save();
    return this.data.findings[idx];
  }

  // --- Handover Reports ---
  public async getHandoverReports(projectId: string) {
    return this.data.handoverReports.filter((r) => r.projectId === projectId);
  }

  public async getHandoverReportById(id: string) {
    return this.data.handoverReports.find((r) => r.id === id) || null;
  }

  public async saveHandoverReport(report: HandoverReport) {
    const idx = this.data.handoverReports.findIndex((r) => r.id === report.id);
    if (idx >= 0) {
      this.data.handoverReports[idx] = report;
    } else {
      this.data.handoverReports.push(report);
    }
    await this.save();
    return report;
  }

  // --- GitHub Integrations ---
  public async getGitHubConnection(projectId: string) {
    return this.data.githubConnections.find((c) => c.projectId === projectId) || null;
  }

  public async saveGitHubConnection(conn: GitHubConnection) {
    const idx = this.data.githubConnections.findIndex((c) => c.projectId === conn.projectId);
    if (idx >= 0) {
      this.data.githubConnections[idx] = conn;
    } else {
      this.data.githubConnections.push(conn);
    }
    await this.save();
    return conn;
  }

  // --- Activity Logs ---
  public async logActivity(log: Omit<ActivityLog, 'id' | 'timestamp'>) {
    const entry: ActivityLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.data.activityLogs.unshift(entry);
    if (this.data.activityLogs.length > 500) {
      this.data.activityLogs = this.data.activityLogs.slice(0, 500);
    }
    await this.save();
    return entry;
  }

  public async getActivityLogs(projectId: string) {
    return this.data.activityLogs.filter((l) => l.projectId === projectId);
  }

  // --- Source Records (Unified Canonical Model) ---
  public async getSourceRecords(projectId: string) {
    return this.data.sourceRecords.filter((r) => r.projectId === projectId);
  }

  public async saveSourceRecords(records: SourceRecord[]) {
    records.forEach((rec) => {
      const idx = this.data.sourceRecords.findIndex((r) => r.id === rec.id);
      if (idx >= 0) {
        this.data.sourceRecords[idx] = rec;
      } else {
        this.data.sourceRecords.push(rec);
      }
    });
    await this.save();
    return records;
  }

  public async deleteSourceRecordsByPlatform(projectId: string, platform: string) {
    this.data.sourceRecords = this.data.sourceRecords.filter(
      (r) => !(r.projectId === projectId && r.sourcePlatform === platform)
    );
    await this.save();
  }

  // --- Source Connections (Connectors Center) ---
  public async getSourceConnections(projectId: string) {
    return this.data.sourceConnections.filter((c) => c.projectId === projectId);
  }

  public async getSourceConnection(projectId: string, service: string) {
    return this.data.sourceConnections.find((c) => c.projectId === projectId && c.service === service) || null;
  }

  public async saveSourceConnection(conn: SourceConnection) {
    const idx = this.data.sourceConnections.findIndex(
      (c) => c.projectId === conn.projectId && c.service === conn.service
    );
    if (idx >= 0) {
      this.data.sourceConnections[idx] = conn;
    } else {
      this.data.sourceConnections.push(conn);
    }
    await this.save();
    return conn;
  }

  public async removeSourceConnection(projectId: string, service: string) {
    this.data.sourceConnections = this.data.sourceConnections.filter(
      (c) => !(c.projectId === projectId && c.service === service)
    );
    await this.save();
  }

  // --- RAG Queries & Audit Trail ---
  public async saveRagQuery(projectId: string, question: string, answer: any, userId?: string) {
    const entry = {
      id: `rag-q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      projectId,
      userId,
      question,
      answer,
      timestamp: new Date().toISOString(),
    };
    this.data.ragQueries.unshift(entry);
    if (this.data.ragQueries.length > 200) {
      this.data.ragQueries = this.data.ragQueries.slice(0, 200);
    }
    await this.save();
    return entry;
  }

  public async getRagQueries(projectId: string) {
    return this.data.ragQueries.filter((q) => q.projectId === projectId);
  }

  // --- Transaction Support ---
  public async withTransaction<T>(fn: (txDb: IKnowbridgeDatabase) => Promise<T>): Promise<T> {
    const snapshot = JSON.stringify(this.data);
    try {
      const result = await fn(this);
      this.saveDirect(this.data);
      return result;
    } catch (err) {
      this.data = JSON.parse(snapshot);
      throw err;
    }
  }

  // Reset or reseed
  public async resetToDefaultSeed(): Promise<boolean> {
    this.data = getInitialData();
    await this.save();
    return true;
  }
}

export const jsonDb = new JsonDatabase();

// ─── Database Mode & Dynamic Selection ───────────────────────────────────────

let activeModeOverride: DatabaseMode | null = null;
let customDatabaseOverride: IKnowbridgeDatabase | null = null;

export function resolveDatabaseMode(): DatabaseMode {
  const envMode = process.env.DATABASE_MODE || process.env.DB_MODE;
  if (envMode) {
    const normalized = envMode.trim().toLowerCase();
    if (normalized === 'postgres' || normalized === 'postgresql') {
      return 'postgres';
    }
    if (normalized === 'json') {
      return 'json';
    }
    throw new Error(
      `[Database] Invalid DATABASE_MODE "${envMode}". Supported values are "postgres" or "json".`
    );
  }

  // If DATABASE_URL is configured, default to postgres mode
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
    return 'postgres';
  }

  // Safe fallback for local development when PostgreSQL is not configured
  return 'json';
}

export function getDatabaseMode(): DatabaseMode {
  if (activeModeOverride) return activeModeOverride;
  return resolveDatabaseMode();
}

export function setDatabaseModeForTesting(mode: DatabaseMode | null): void {
  activeModeOverride = mode;
}

export function setCustomDatabaseForTesting(customDb: IKnowbridgeDatabase | null): void {
  customDatabaseOverride = customDb;
}

export function getActiveDatabase(): IKnowbridgeDatabase {
  if (customDatabaseOverride) {
    return customDatabaseOverride;
  }
  const mode = getDatabaseMode();
  if (mode === 'postgres') {
    if (!isPostgresConfigured()) {
      throw new Error(
        '[Database] DATABASE_MODE is set to "postgres", but DATABASE_URL is not configured and no PostgreSQL pool is available. Refusing to silently fall back to JSON store.'
      );
    }
    return pgDb;
  }
  return jsonDb;
}

/**
 * Universal Database Facade
 * Transparently delegates every call to the active database mode (PostgreSQL or JSON).
 */
export const db: IKnowbridgeDatabase = new Proxy({} as IKnowbridgeDatabase, {
  get(_target, prop) {
    const active = getActiveDatabase();
    const value = (active as any)[prop];
    if (typeof value === 'function') {
      return value.bind(active);
    }
    return value;
  },
});

export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  const mode = getDatabaseMode();
  if (mode === 'postgres') {
    if (!isPostgresConfigured()) {
      return {
        status: 'DOWN',
        mode: 'postgres',
        error: 'DATABASE_URL is not configured',
      };
    }
    const pgHealth = await checkPostgresHealth();
    return {
      status: pgHealth.status,
      mode: 'postgres',
      latencyMs: pgHealth.latencyMs,
      error: pgHealth.error,
    };
  } else {
    const start = Date.now();
    try {
      await jsonDb.getProjects();
      return {
        status: 'UP',
        mode: 'json',
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        status: 'DOWN',
        mode: 'json',
        error: err?.message || 'JSON database store error',
      };
    }
  }
}

export async function initDatabase(): Promise<void> {
  const mode = getDatabaseMode();
  if (mode === 'postgres') {
    console.log('[Database] Initializing PostgreSQL runtime...');
    const health = await getDatabaseHealth();
    if (health.status !== 'UP') {
      throw new Error(
        `[Database] PostgreSQL connection failed: ${health.error}. Halted to avoid silent fallback.`
      );
    }
    await runMigrations();
    console.log('[Database] PostgreSQL connection verified and migrations applied.');
  } else {
    console.log(`[Database] JSON store active (Local development mode: ${DATA_FILE}).`);
  }
}

export async function closeDatabase(): Promise<void> {
  const mode = getDatabaseMode();
  if (mode === 'postgres') {
    await closePool();
    console.log('[Database] PostgreSQL connection pool terminated.');
  }
}
