import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowbridge-security-test-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-jwt-secret-with-more-than-32-characters';
process.env.GEMINI_API_KEY = '';
process.env.CORS_ORIGINS = 'https://trusted.example';
process.env.KNOWBRIDGE_DATA_FILE = path.join(temporaryDirectory, 'security-test-store.json');

let server;
let baseUrl;
let db;
let tokens;
let ids;

async function request(method, route, token, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data };
}

async function upload(route, token, filename, mimeType, content) {
  const form = new FormData();
  form.set('file', new Blob([content], { type: mimeType }), filename);
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data };
}

before(async () => {
  const [{ app }, database, auth] = await Promise.all([
    import('../server.ts'),
    import('../src/server/db.ts'),
    import('../src/server/auth.ts'),
  ]);
  db = database.db;
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const makeUser = async (name, email) => {
    const result = await request('POST', '/api/auth/register', null, {
      name,
      email,
      password: 'a-secure-test-password',
    });
    assert.equal(result.response.status, 201);
    return result.data;
  };
  const [owner, member, outsider, reviewer, admin, manager] = await Promise.all([
    makeUser('Project Owner', 'owner@example.test'),
    makeUser('Project Member', 'member@example.test'),
    makeUser('Unrelated User', 'outsider@example.test'),
    makeUser('Project Reviewer', 'reviewer@example.test'),
    makeUser('Project Admin', 'admin@example.test'),
    makeUser('Project Manager', 'manager@example.test'),
  ]);
  tokens = {
    owner: owner.token,
    member: member.token,
    outsider: outsider.token,
    reviewer: reviewer.token,
    admin: admin.token,
    manager: manager.token,
  };
  ids = {
    member: member.user.id,
    reviewer: reviewer.user.id,
    admin: admin.user.id,
    manager: manager.user.id,
  };

  const projectResult = await request('POST', '/api/projects', tokens.owner, {
    name: 'Isolated Security Test Project',
  });
  assert.equal(projectResult.response.status, 201);
  ids.project = projectResult.data.project.id;

  for (const [userId, role] of [
    [ids.member, 'MEMBER'],
    [ids.reviewer, 'REVIEWER'],
    [ids.admin, 'ADMIN'],
    [ids.manager, 'MANAGER'],
  ]) {
    const added = await request('POST', `/api/projects/${ids.project}/members`, tokens.owner, { userId, role });
    assert.equal(added.response.status, 201);
  }

  const documentResult = await request('POST', `/api/projects/${ids.project}/documents`, tokens.owner, {
    title: 'handover-notes.txt',
    text: 'DECISION: Keep the audit log immutable. The current task is pending review.',
  });
  assert.equal(documentResult.response.status, 201);
  ids.document = documentResult.data.document.id;

  const findingResult = await request('POST', `/api/projects/${ids.project}/findings`, tokens.owner, {
    title: 'Immutable audit log',
    description: 'The audit log should not be modified after creation.',
    category: 'DECISION',
    sourceDocumentId: ids.document,
    evidenceExcerpt: 'Keep the audit log immutable.',
  });
  assert.equal(findingResult.response.status, 201);
  ids.finding = findingResult.data.finding.id;

  const handoverResult = await request('POST', `/api/projects/${ids.project}/handover`, tokens.owner, {});
  assert.equal(handoverResult.response.status, 201);
  ids.handover = handoverResult.data.report.id;

  ids.expiredToken = jwt.sign(
    { id: owner.user.id, email: owner.user.email, name: owner.user.name, role: 'OWNER' },
    process.env.JWT_SECRET,
    { expiresIn: -1 }
  );
  ids.invalidToken = 'not-a-valid-jwt';
  ids.directToken = auth.generateToken({
    id: 'missing-user',
    email: 'gone@example.test',
    name: 'Deleted User',
    role: 'OWNER',
  });
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('users can only list and access projects they belong to', async () => {
  const ownList = await request('GET', '/api/projects', tokens.owner);
  assert.equal(ownList.response.status, 200);
  assert.equal(ownList.data.projects.some((project) => project.id === ids.project), true);

  const ownerAccess = await request('GET', `/api/projects/${ids.project}`, tokens.owner);
  const memberAccess = await request('GET', `/api/projects/${ids.project}`, tokens.member);
  const outsiderAccess = await request('GET', `/api/projects/${ids.project}`, tokens.outsider);
  assert.equal(ownerAccess.response.status, 200);
  assert.equal(memberAccess.response.status, 200);
  assert.equal(outsiderAccess.response.status, 403);
});

test('project members can read project documents and findings, outsiders cannot', async () => {
  for (const pathName of [
    `/api/projects/${ids.project}/documents`,
    `/api/documents/${ids.document}`,
    `/api/projects/${ids.project}/findings`,
    `/api/findings/${ids.finding}`,
    `/api/projects/${ids.project}/activity`,
    `/api/projects/${ids.project}/connectors`,
    `/api/projects/${ids.project}/source-records`,
    `/api/projects/${ids.project}/onboarding`,
    `/api/integrations/github/status/${ids.project}`,
  ]) {
    assert.equal((await request('GET', pathName, tokens.member)).response.status, 200, pathName);
    assert.equal((await request('GET', pathName, tokens.outsider)).response.status, 403, pathName);
  }
});

test('successor onboarding plan is generated from project evidence and remains membership-protected', async () => {
  const memberPlan = await request('GET', `/api/projects/${ids.project}/onboarding`, tokens.member);
  assert.equal(memberPlan.response.status, 200);
  assert.equal(memberPlan.data.onboarding.readinessScore >= 0, true);
  assert.deepEqual(memberPlan.data.onboarding.phases.map((phase) => phase.days), ['0-30', '31-60', '61-90']);
  assert.equal(memberPlan.data.onboarding.phases[0].items.some((item) => item.category === 'DOCUMENTATION'), true);

  const outsiderPlan = await request('GET', `/api/projects/${ids.project}/onboarding`, tokens.outsider);
  assert.equal(outsiderPlan.response.status, 403);
});

test('parallel identical uploads create only one document and one canonical source record set', async () => {
  const content = 'DECISION: Keep one canonical copy of identical onboarding notes.';
  const uploads = await Promise.all([
    request('POST', `/api/projects/${ids.project}/documents`, tokens.owner, {
      title: 'duplicate-notes-a.txt',
      text: content,
    }),
    request('POST', `/api/projects/${ids.project}/documents`, tokens.owner, {
      title: 'duplicate-notes-b.txt',
      text: content,
    }),
  ]);
  assert.deepEqual(uploads.map((uploadResult) => uploadResult.response.status).sort(), [200, 201]);
  assert.equal(uploads.filter((uploadResult) => uploadResult.data.isDuplicate).length, 1);

  const documents = await request('GET', `/api/projects/${ids.project}/documents`, tokens.owner);
  const duplicates = documents.data.documents.filter((document) => document.contentHash === uploads[0].data.document.contentHash);
  assert.equal(duplicates.length, 1);

  const records = await request('GET', `/api/projects/${ids.project}/source-records?platform=DOCUMENT`, tokens.owner);
  const canonicalRecords = records.data.records.filter(
    (record) => record.externalSourceId.startsWith(`${duplicates[0].id}#page-`),
  );
  assert.ok(canonicalRecords.length > 0);
  assert.equal(new Set(canonicalRecords.map((record) => record.id)).size, canonicalRecords.length);
});

test('members cannot modify project settings, manage integrations, or delete project documents', async () => {
  assert.equal(
    (await request('PUT', `/api/projects/${ids.project}`, tokens.member, { name: 'Changed by member' })).response.status,
    403
  );
  assert.equal(
    (await request('POST', `/api/projects/${ids.project}/connectors/SLACK/connect`, tokens.member, {})).response.status,
    403
  );
  assert.equal(
    (await request('DELETE', `/api/documents/${ids.document}`, tokens.member)).response.status,
    403
  );
  assert.equal(
    (await request('POST', `/api/projects/${ids.project}/members`, tokens.member, {
      userId: ids.reviewer,
      role: 'ADMIN',
    })).response.status,
    403
  );
  assert.equal(
    (await request('POST', '/api/integrations/github/connect', tokens.outsider, {
      projectId: ids.project,
      repoOwner: 'octocat',
      repoName: 'hello-world',
    })).response.status,
    403
  );
  assert.equal(
    (await request('POST', `/api/projects/${ids.project}/connectors/SLACK/connect`, tokens.reviewer, {})).response.status,
    403
  );
});

test('OWNER, ADMIN, and MANAGER may update settings; MEMBER and REVIEWER may not', async () => {
  for (const role of ['owner', 'admin', 'manager']) {
    const result = await request('PUT', `/api/projects/${ids.project}`, tokens[role], {
      description: `Updated by ${role}`,
    });
    assert.equal(result.response.status, 200, role);
  }
  for (const role of ['member', 'reviewer']) {
    const result = await request('PUT', `/api/projects/${ids.project}`, tokens[role], {
      description: `Rejected ${role} update`,
    });
    assert.equal(result.response.status, 403, role);
  }
});

test('reviewing findings and exporting handovers require project review permissions', async () => {
  const outsiderReview = await request('POST', `/api/findings/${ids.finding}/review`, tokens.outsider, {
    reviewStatus: 'APPROVED',
  });
  const memberReview = await request('POST', `/api/findings/${ids.finding}/review`, tokens.member, {
    reviewStatus: 'APPROVED',
  });
  const reviewerReview = await request('POST', `/api/findings/${ids.finding}/review`, tokens.reviewer, {
    reviewStatus: 'APPROVED',
    reviewerNotes: 'Reviewed for test.',
  });
  assert.equal(outsiderReview.response.status, 403);
  assert.equal(memberReview.response.status, 403);
  assert.equal(reviewerReview.response.status, 200);

  assert.equal((await request('GET', `/api/handover/${ids.handover}/pdf`, tokens.outsider)).response.status, 403);
  assert.equal((await request('GET', `/api/handover/${ids.handover}`, tokens.member)).response.status, 403);
  assert.equal((await request('GET', `/api/handover/${ids.handover}`, tokens.reviewer)).response.status, 200);
  assert.equal((await request('GET', `/api/projects/${ids.project}/handover`, tokens.member)).response.status, 403);
  assert.equal((await request('GET', `/api/handover/${ids.handover}/pdf`, tokens.reviewer)).response.status, 200);
  assert.equal((await request('GET', `/api/handover/${ids.handover}/pdf`, tokens.member)).response.status, 403);
  assert.equal(
    (await request('POST', `/api/handover/${ids.handover}/signoff`, tokens.outsider, {})).response.status,
    403
  );
  const projectFindings = await request('GET', `/api/projects/${ids.project}/findings`, tokens.reviewer);
  for (const finding of projectFindings.data.findings.filter((item) => item.reviewStatus === 'PENDING')) {
    const approval = await request('POST', `/api/findings/${finding.id}/review`, tokens.reviewer, {
      reviewStatus: 'APPROVED',
      reviewerNotes: 'Reviewed for sign-off integration test.',
    });
    assert.equal(approval.response.status, 200);
  }
  const signoff = await request('POST', `/api/handover/${ids.handover}/signoff`, tokens.reviewer, {
    notes: 'Test sign-off.',
  });
  assert.equal(signoff.response.status, 200);
});

test('unauthorized users cannot access document content, RAG results, or project history', async () => {
  assert.equal((await request('GET', `/api/documents/${ids.document}`, tokens.outsider)).response.status, 403);
  assert.equal((await request('GET', `/api/projects/${ids.project}/rag/history`, tokens.outsider)).response.status, 403);
  assert.equal((await request('GET', `/api/projects/${ids.project}/rag/suggested`, tokens.outsider)).response.status, 403);
  assert.equal(
    (await request('POST', `/api/projects/${ids.project}/rag/query`, tokens.outsider, {
      question: 'What is in this project?',
    })).response.status,
    403
  );
  assert.equal((await request('GET', `/api/projects/${ids.project}/activity`, tokens.outsider)).response.status, 403);
});

test('invalid, expired, and revoked-user JWTs are rejected by real endpoints', async () => {
  for (const token of [ids.invalidToken, ids.expiredToken, ids.directToken]) {
    assert.equal((await request('GET', `/api/projects/${ids.project}`, token)).response.status, 401);
  }
  assert.equal((await request('GET', `/api/projects/${ids.project}`)).response.status, 401);
});

test('project membership changes take effect immediately', async () => {
  const removed = await request('DELETE', `/api/projects/${ids.project}/members/${ids.member}`, tokens.owner);
  assert.equal(removed.response.status, 200);
  assert.equal((await request('GET', `/api/projects/${ids.project}`, tokens.member)).response.status, 403);
});

test('security headers are set and production CORS enforces its origin allowlist', async () => {
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.headers.get('x-powered-by'), null);
  assert.ok(health.headers.get('x-content-type-options'));

  process.env.NODE_ENV = 'production';
  const allowed = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://trusted.example' } });
  const denied = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://untrusted.example' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://trusted.example');
  assert.equal(denied.status, 403);
  process.env.NODE_ENV = 'test';
});

test('uploads validate file signatures and sanitize path-like filenames', async () => {
  const invalidPdf = await upload(
    `/api/projects/${ids.project}/documents`,
    tokens.owner,
    'malware.pdf',
    'application/pdf',
    'this is not a PDF'
  );
  assert.equal(invalidPdf.response.status, 415);

  const unsafeName = await upload(
    `/api/projects/${ids.project}/documents`,
    tokens.owner,
    '../audit-notes.txt',
    'text/plain',
    'The uploaded file name must not create a path.'
  );
  assert.equal(unsafeName.response.status, 201);
  assert.equal(unsafeName.data.document.filename, 'audit-notes.txt');

  const outsiderUpload = await upload(
    `/api/projects/${ids.project}/documents`,
    tokens.outsider,
    'private.txt',
    'text/plain',
    'Should not be accepted.'
  );
  assert.equal(outsiderUpload.response.status, 403);
});

test('multipart uploads exceeding the configured size limit return 413', async () => {
  const tooLarge = await upload(
    `/api/projects/${ids.project}/documents`,
    tokens.owner,
    'too-large.txt',
    'text/plain',
    Buffer.alloc(30 * 1024 * 1024 + 1, 0x61)
  );
  assert.equal(tooLarge.response.status, 413);
});

test('malformed bodies are rejected and do not reveal internal error details', async () => {
  const invalidQuestion = await request('POST', `/api/projects/${ids.project}/rag/query`, tokens.owner, {
    question: { nested: true },
  });
  assert.equal(invalidQuestion.response.status, 400);
  assert.equal(invalidQuestion.data.error, 'Question must be between 1 and 2,000 characters.');

  const malformedResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid',
  });
  assert.equal(malformedResponse.status, 400);
  assert.deepEqual(await malformedResponse.json(), { error: 'Invalid request body.' });
});

test('AI query endpoints are rate limited before invoking RAG processing', async () => {
  let finalStatus = 0;
  for (let attempt = 0; attempt < 62; attempt += 1) {
    const result = await request('POST', `/api/projects/${ids.project}/rag/query`, tokens.owner, {
      question: 'Which audit decision is recorded?',
    });
    finalStatus = result.response.status;
  }
  assert.equal(finalStatus, 429);
});

test('authentication endpoints apply the configured request rate limit', async () => {
  let finalStatus = 0;
  for (let attempt = 0; attempt < 22; attempt += 1) {
    const result = await request('POST', '/api/auth/login', null, {
      email: 'unknown@example.test',
      password: 'wrong-password',
    });
    finalStatus = result.response.status;
  }
  assert.equal(finalStatus, 429);
});
