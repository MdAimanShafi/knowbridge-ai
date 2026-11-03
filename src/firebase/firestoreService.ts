import {
  collection,
  doc,
  setDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config.ts';
import { Finding, HandoverReport } from '../types/index.ts';

/**
 * Syncs an approved or updated finding into Firestore
 */
export async function syncFindingToFirestore(projectId: string, finding: Finding): Promise<boolean> {
  const path = `projects/${projectId}/findings/${finding.id}`;
  try {
    const findingRef = doc(db, 'projects', projectId, 'findings', finding.id);
    await setDoc(
      findingRef,
      {
        ...finding,
        syncedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Syncs a generated handover report to Firestore
 */
export async function syncHandoverReportToFirestore(projectId: string, report: HandoverReport): Promise<boolean> {
  const path = `projects/${projectId}/handoverReports/${report.id}`;
  try {
    const reportRef = doc(db, 'projects', projectId, 'handoverReports', report.id);
    await setDoc(
      reportRef,
      {
        ...report,
        syncedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Retrieves synced findings from Firestore for a given project
 */
export async function getFirestoreFindings(projectId: string): Promise<Finding[]> {
  const path = `projects/${projectId}/findings`;
  try {
    const snap = await getDocs(collection(db, 'projects', projectId, 'findings'));
    return snap.docs.map((d) => d.data() as Finding);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}
