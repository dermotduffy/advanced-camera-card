// Triage automation for "The ACC Project Board" (user-owned Projects v2 #3).
//
// Runs in CI only. Two independent phases (phase 2 failing never blocks phase 1):
//   1. fixed-pending-release labelling: find open issues whose fix is already
//      merged to `dev` but not yet in any release, and label them so the real
//      backlog is distinguishable from work that is done-but-awaiting-release.
//   2. Board sync: mirror the open backlog onto the board and map curated
//      `P0`..`P3` priority labels onto the board's "Priority" field.
//
// Tokens (see .github/workflows/project-triage.yml):
//   GITHUB_TOKEN - repo-scoped (issues: write); used for REST + repo GraphQL.
//   PROJECT_PAT  - classic `project` scope; required because the default
//                  GITHUB_TOKEN cannot write a *user-owned* Projects v2 board.

const OWNER = 'dermotduffy';
const REPO = 'advanced-camera-card';
const PROJECT_OWNER = 'dermotduffy';
const PROJECT_NUMBER = 3;
const DEV_BRANCH = 'dev';

const FIXED_PENDING_LABEL = 'fixed-pending-release';
const RELEASED_NEXT_LABEL = 'released on @next';
const PRIORITY_LABELS = ['P0', 'P1', 'P2', 'P3'];

// Only issues carrying one of these labels are placed on the board.
const BOARD_LABELS = new Set(['bug', ...PRIORITY_LABELS, FIXED_PENDING_LABEL]);

// Board "Status" option name -> the issue label that should select it. Only
// applied when the board already defines an option with that exact name, so an
// incomplete Status field is silently tolerated rather than erroring.
const STATUS_BY_LABEL = [
  [FIXED_PENDING_LABEL, 'Fixed (pending release)'],
  [RELEASED_NEXT_LABEL, 'Fixed (pending release)'],
];

const DRY_RUN = process.env.DRY_RUN !== 'false';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PROJECT_PAT = process.env.PROJECT_PAT;

const log = (...a) => console.log(...a);
const plan = (...a) => console.log(DRY_RUN ? '[DRY]' : '[RUN]', ...a);

async function rest(method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`REST ${method} ${path} -> ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

async function graphql(token, query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

// All open issues (excluding PRs), with their labels and node ids.
async function openIssues() {
  const out = [];
  for (let page = 1; ; page++) {
    const batch = await rest(
      'GET',
      `/repos/${OWNER}/${REPO}/issues?state=open&per_page=100&page=${page}`,
    );
    for (const it of batch) {
      if (it.pull_request) continue;
      out.push({
        number: it.number,
        nodeId: it.node_id,
        labels: it.labels.map((l) => (typeof l === 'string' ? l : l.name)),
      });
    }
    if (batch.length < 100) break;
  }
  return out;
}

// Issue numbers that a merged-to-dev PR closes (via "Closes #" references).
async function devClosedIssueNumbers() {
  const closed = new Set();
  let cursor = null;
  // Recent merged PRs only; ordered newest-first so a few pages cover the
  // window since the last release without walking the entire history.
  for (let page = 0; page < 5; page++) {
    const data = await graphql(
      GITHUB_TOKEN,
      `query($owner:String!,$repo:String!,$cursor:String){
        repository(owner:$owner,name:$repo){
          pullRequests(states:MERGED,first:100,after:$cursor,
                       orderBy:{field:UPDATED_AT,direction:DESC}){
            nodes{ baseRefName closingIssuesReferences(first:20){ nodes{ number } } }
            pageInfo{ hasNextPage endCursor }
          }
        }
      }`,
      { owner: OWNER, repo: REPO, cursor },
    );
    const prs = data.repository.pullRequests;
    for (const pr of prs.nodes) {
      if (pr.baseRefName !== DEV_BRANCH) continue;
      for (const ref of pr.closingIssuesReferences.nodes) closed.add(ref.number);
    }
    if (!prs.pageInfo.hasNextPage) break;
    cursor = prs.pageInfo.endCursor;
  }
  return closed;
}

async function phaseFixedPendingRelease(issues) {
  log('\n== Phase 1: fixed-pending-release ==');
  const devClosed = await devClosedIssueNumbers();
  let labelled = 0;
  for (const issue of issues) {
    const fixedOnDev = devClosed.has(issue.number);
    const alreadyMarked =
      issue.labels.includes(FIXED_PENDING_LABEL) ||
      issue.labels.includes(RELEASED_NEXT_LABEL);
    if (!fixedOnDev || alreadyMarked) continue;
    plan(`label #${issue.number} '${FIXED_PENDING_LABEL}' (merged to ${DEV_BRANCH}, unreleased)`);
    if (!DRY_RUN) {
      await rest('POST', `/repos/${OWNER}/${REPO}/issues/${issue.number}/labels`, {
        labels: [FIXED_PENDING_LABEL],
      });
    }
    labelled++;
  }
  log(`Phase 1: ${labelled} issue(s) ${DRY_RUN ? 'would be' : ''} labelled.`);
}

async function getProject() {
  const data = await graphql(
    PROJECT_PAT,
    `query($login:String!,$number:Int!){
      user(login:$login){ projectV2(number:$number){
        id title
        fields(first:50){ nodes{
          ... on ProjectV2FieldCommon{ id name }
          ... on ProjectV2SingleSelectField{ id name options{ id name } }
        } }
        items(first:100){ nodes{ id content{ ... on Issue{ number } } }
          pageInfo{ hasNextPage endCursor } }
      } }
    }`,
    { login: PROJECT_OWNER, number: PROJECT_NUMBER },
  );
  const project = data.user?.projectV2;
  if (!project) throw new Error(`Project #${PROJECT_NUMBER} not found for ${PROJECT_OWNER}`);

  // Walk remaining item pages to know exactly what is already on the board.
  const onBoard = new Map(); // issue number -> item id
  let nodes = project.items.nodes;
  let pageInfo = project.items.pageInfo;
  for (;;) {
    for (const n of nodes) if (n.content?.number) onBoard.set(n.content.number, n.id);
    if (!pageInfo.hasNextPage) break;
    const more = await graphql(
      PROJECT_PAT,
      `query($id:ID!,$cursor:String){ node(id:$id){ ... on ProjectV2{
        items(first:100,after:$cursor){ nodes{ id content{ ... on Issue{ number } } }
          pageInfo{ hasNextPage endCursor } } } } }`,
      { id: project.id, cursor: pageInfo.endCursor },
    );
    nodes = more.node.items.nodes;
    pageInfo = more.node.items.pageInfo;
  }
  return { project, onBoard };
}

// Ensure a single-select "Priority" field with P0..P3 options exists.
async function ensurePriorityField(project) {
  const existing = project.fields.nodes.find((f) => f.name === 'Priority' && f.options);
  if (existing) return existing;
  plan('create board field "Priority" (single-select: P0,P1,P2,P3)');
  if (DRY_RUN) return null;
  const data = await graphql(
    PROJECT_PAT,
    `mutation($project:ID!){
      createProjectV2Field(input:{
        projectId:$project, dataType:SINGLE_SELECT, name:"Priority",
        singleSelectOptions:[
          {name:"P0",color:RED,description:""},
          {name:"P1",color:ORANGE,description:""},
          {name:"P2",color:YELLOW,description:""},
          {name:"P3",color:GRAY,description:""}
        ]
      }){ projectV2Field{ ... on ProjectV2SingleSelectField{ id name options{ id name } } } }
    }`,
    { project: project.id },
  );
  return data.createProjectV2Field.projectV2Field;
}

async function addToBoard(projectId, contentNodeId) {
  const data = await graphql(
    PROJECT_PAT,
    `mutation($project:ID!,$content:ID!){
      addProjectV2ItemById(input:{projectId:$project,contentId:$content}){ item{ id } }
    }`,
    { project: projectId, content: contentNodeId },
  );
  return data.addProjectV2ItemById.item.id;
}

async function setSingleSelect(projectId, itemId, fieldId, optionId) {
  await graphql(
    PROJECT_PAT,
    `mutation($project:ID!,$item:ID!,$field:ID!,$option:String!){
      updateProjectV2ItemFieldValue(input:{
        projectId:$project,itemId:$item,fieldId:$field,
        value:{singleSelectOptionId:$option}
      }){ projectV2Item{ id } }
    }`,
    { project: projectId, item: itemId, field: fieldId, option: optionId },
  );
}

async function phaseBoardSync(issues) {
  log('\n== Phase 2: board sync ==');
  if (!PROJECT_PAT) {
    log('Phase 2: skipped (PROJECT_PAT not set).');
    return;
  }
  const { project, onBoard } = await getProject();
  log(`Board: "${project.title}" (${onBoard.size} item(s) currently).`);

  const priorityField = await ensurePriorityField(project);
  const statusField = project.fields.nodes.find((f) => f.name === 'Status' && f.options);

  // Phase 1 may have just added the label in a live run; reflect it locally so
  // a freshly-fixed issue lands on the board in the same pass.
  const targets = issues.filter((i) => i.labels.some((l) => BOARD_LABELS.has(l)));
  let added = 0;
  let prioritised = 0;
  for (const issue of targets) {
    let itemId = onBoard.get(issue.number);
    if (!itemId) {
      plan(`add #${issue.number} to board`);
      added++;
      if (!DRY_RUN) itemId = await addToBoard(project.id, issue.nodeId);
    }

    const pLabel = issue.labels.find((l) => PRIORITY_LABELS.includes(l));
    if (pLabel && priorityField) {
      const opt = priorityField.options.find((o) => o.name === pLabel);
      if (opt) {
        plan(`set #${issue.number} Priority=${pLabel}`);
        prioritised++;
        if (!DRY_RUN && itemId) await setSingleSelect(project.id, itemId, priorityField.id, opt.id);
      }
    }

    if (statusField && itemId && !DRY_RUN) {
      const map = STATUS_BY_LABEL.find(([lbl]) => issue.labels.includes(lbl));
      const opt = map && statusField.options.find((o) => o.name === map[1]);
      if (opt) await setSingleSelect(project.id, itemId, statusField.id, opt.id);
    }
  }
  log(`Phase 2: ${added} add(s), ${prioritised} priority set(s) ${DRY_RUN ? '(planned)' : ''}.`);
}

async function main() {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required');
  log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  const issues = await openIssues();
  log(`Fetched ${issues.length} open issue(s).`);
  await phaseFixedPendingRelease(issues);
  try {
    await phaseBoardSync(issues);
  } catch (err) {
    // Board sync is best-effort: never fail the run (and thus phase 1) on it.
    console.error('Phase 2 failed (continuing):', err.message);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
