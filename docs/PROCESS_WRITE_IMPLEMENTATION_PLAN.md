# Process Create & Update — Implementation Plan

This document captures the design analysis, data requirements, and examples needed to implement
`create_process` and `update_process_content` MCP tools.

---

## 1. What We're Building

Two new MCP tools that allow AI agents to author and maintain Nintex Process Manager processes:

| Tool | API Method | Endpoint |
|---|---|---|
| `create_process` | POST | `/Api/v1/Processes` |
| `update_process_content` | PUT | `/Api/v1/Processes/{processUniqueId}` |

Both tools must enforce Nintex authoring best practices automatically, and support linking
documents into process steps.

---

## 2. Key API Facts (from Bulk Operations repo)

### 2a. Update Request — Critical Format

`PUT /Api/v1/Processes/{processUniqueId}`

**The `ProcessJson` field must be a JSON-encoded STRING, not an object.**
The full process object is serialized to a string and placed as a value inside the outer request body.

```json
{
  "ProcessJson": "{\"Id\":1476,\"UniqueId\":\"...\",\"Name\":\"...\", ...}",
  "ChangeDescription": "Updated by MCP agent",
  "DoSubmitForApproval": false,
  "DoPublish": false,
  "SuppressChangeNotification": false,
  "SharedActivityCollectionEditModel": {
    "ActivitiesToDelete": [],
    "ActivitiesToShare": [],
    "ActivitiesToUnlink": []
  },
  "VariantConnectionChangeStates": []
}
```

Required headers:
```
Authorization: Bearer {siteToken}
Content-Type: application/json
Accept: application/json
X-Requested-With: XMLHttpRequest
```

### 2b. Workflow for Updating Content

1. `GET /Api/v1/Processes/{processUniqueId}` → retrieve current `processJson` object
2. Extract `ProcessRevisionEditId` from the response (needed for the PUT)
3. Modify the `ProcessProcedures.Activity` array
4. Serialize the modified object → JSON string
5. `PUT /Api/v1/Processes/{processUniqueId}` with the full request body

**Why we must GET before PUT:**
- `ProcessRevisionEditId` is required and changes with every save
- Existing cross-process references in `LinkedStakeholders`, `Inputs`, `Outputs` must be preserved
- The `Id` and `UniqueId` on every activity/task must be preserved or be `0`/new-UUID for new items

---

## 3. Process JSON Structure (Full Schema)

### Top-Level Process Object

```json
{
  "Id": 1476,
  "UniqueId": "f5698de9-1956-4095-9d6f-edaf6e28f022",
  "Name": "Employee Onboarding",
  "StateId": 1,
  "Objective": "Ensure new employees are onboarded efficiently and consistently.",
  "OwnerId": 42,
  "ExpertId": 43,
  "GroupId": 10,
  "GroupUniqueId": "aaaa-bbbb-cccc-dddd",
  "Background": "This process applies to all full-time employees joining the organisation.",
  "Expert": "Jane Smith",
  "Owner": "John Doe",
  "Group": "Human Resources",
  "State": "Active",
  "ProcessRevisionEditId": 8970,
  "ProcessProcedures": {
    "Activity": [ ... ]
  },
  "Inputs": { "Input": [] },
  "Outputs": { "Output": [] },
  "LinkedStakeholders": { "LinkedStakeholder": [] },
  "Version": "4.0"
}
```

### Activity Object (full known structure)

```json
{
  "Id": 0,
  "UniqueId": "new-uuid-here",
  "Number": "1",
  "Text": "Prepare onboarding pack",
  "OwnerId": null,
  "OwnerText": "HR Manager",
  "IsManuallyNamed": false,
  "ChildProcessProcedures": {
    "Task": [
      {
        "Id": 0,
        "UniqueId": "new-uuid-here",
        "Number": "1.1",
        "Text": "Compile welcome letter and policy documents",
        "OwnerId": null,
        "OwnerText": null,
        "DocumentUniqueId": null,
        "DocumentName": null,
        "ProcessUniqueId": null,
        "ProcessName": null,
        "IsManuallyNamed": false,
        "HasNote": false,
        "Note": null,
        "IsDecision": false
      }
    ]
  }
}
```

### Task with Document Reference

```json
{
  "Id": 0,
  "UniqueId": "new-uuid-here",
  "Number": "2.1",
  "Text": "Complete the New Starter Form",
  "DocumentUniqueId": "doc-uuid-from-search",
  "DocumentName": "New Starter Form",
  "ProcessUniqueId": null,
  "ProcessName": null,
  "HasNote": false,
  "Note": null,
  "IsDecision": false
}
```

### Task with Sub-Process Reference

```json
{
  "Id": 0,
  "UniqueId": "new-uuid-here",
  "Number": "3.1",
  "Text": "Complete IT setup process",
  "DocumentUniqueId": null,
  "DocumentName": null,
  "ProcessUniqueId": "linked-process-uuid",
  "ProcessName": "IT New Starter Setup",
  "HasNote": false,
  "Note": null,
  "IsDecision": false
}
```

---

## 4. Official Nintex Writing Rules Summary

Source: https://help.nintex.com/en-US/promapp/Processes/ProcessWriting.htm

| Rule | Detail |
|---|---|
| Verb-first (Technique 3) | **All** process names, activity names, and task names must start with a verb |
| 80% rule (Technique 1) | Only document steps performed ~80% of the time; exceptions go in notes |
| Activity limit (Technique 2) | Maximum **10 activities** per process |
| Task limit | Aim for ~**10 tasks or notes** per activity |
| Optional steps (Technique 5) | Use "if required/needed/appropriate"; always add a note explaining when |
| Note titles | Must be phrased as **a question** (e.g. "What if the supplier is overseas?") |
| Decisions (Technique 7) | Only for critical flow-impacting branches; low-level decisions go in notes |
| Sub-processes (Technique 4) | Break at >10 activities or when steps are shared across processes |
| Documents (Technique 6) | Attach at task level; reduce process map clutter with guides |

**Correction from previous version:** Process names also start with a verb.
"Employee Onboarding" is wrong; "Onboard New Employee" is correct.

---

## 5. Data & Examples Needed

### 5a. Example Files to Create (see `examples/` directory)

| File | Purpose |
|---|---|
| `examples/process-body-example.json` | Complete example of a realistic process body following Nintex best practices |
| `examples/create-process-request.json` | Request body for `POST /Api/v1/Processes` |
| `examples/update-process-request.json` | Request body for `PUT /Api/v1/Processes/{id}` showing the double-serialized format |
| `examples/activity-with-document-link.json` | Activity/task with an embedded document reference |
| `examples/activity-with-subprocess-link.json` | Activity/task that links to another process |

### 5b. TypeScript Types Needed (additions to `config.ts`)

```typescript
// Full Activity with all known fields
interface FullActivity {
  Id: number;                  // 0 for new, existing ID for updates
  UniqueId: string;            // new UUID for new, existing for updates
  Number: string;              // "1", "2", "3"
  Text: string;                // Activity name (verb-noun, ≤ 60 chars)
  OwnerId: number | null;      // User ID if assigning to a person
  OwnerText: string | null;    // Free-text role name (e.g. "HR Manager")
  IsManuallyNamed: boolean;
  ChildProcessProcedures: {
    Task?: FullTask[];
  };
}

// Full Task with all known fields
interface FullTask {
  Id: number;
  UniqueId: string;
  Number: string;              // "1.1", "1.2", "2.1"
  Text: string;                // Task description (specific, actionable)
  OwnerId: number | null;
  OwnerText: string | null;
  DocumentUniqueId: string | null;  // Link to a document
  DocumentName: string | null;
  ProcessUniqueId: string | null;   // Link to another process
  ProcessName: string | null;
  HasNote: boolean;
  Note: string | null;
  IsDecision: boolean;
}

// Create process request
interface CreateProcessRequest {
  Name: string;
  GroupUniqueId: string;
  OwnerId?: number;
  ExpertId?: number;
  Objective?: string;
  Background?: string;
}

// Update process request body
interface UpdateProcessRequest {
  ProcessJson: string;              // JSON-encoded string of the process object!
  ChangeDescription: string;
  DoSubmitForApproval: boolean;
  DoPublish: boolean;
  SuppressChangeNotification: boolean;
  SharedActivityCollectionEditModel: {
    ActivitiesToDelete: string[];   // UniqueIds of removed activities
    ActivitiesToShare: string[];
    ActivitiesToUnlink: string[];
  };
  VariantConnectionChangeStates: any[];
}
```

### 5c. Nintex Best Practices — Agent Instructions

These must be embedded in the MCP tool descriptions so agents follow them automatically.
See `docs/NINTEX_AUTHORING_BEST_PRACTICES.md` for the full guide.

Summary for tool prompts:
- Activity names: verb-noun phrase, ≤ 60 characters (e.g. "Review application", not "Application review")
- Tasks: one specific action per task, ≤ 120 characters, starts with a verb
- Process scope: 5–15 activities is ideal; split into sub-processes if larger
- Document links: attach relevant documents/forms at the task level, not activity level
- Sub-process links: use task-level process links for well-defined sub-workflows
- Objective: 1–2 sentences stating WHY the process exists (not WHAT it does)
- Background: context, scope limitations, who it applies to

---

## 6. New Tool Specifications

### Tool: `create_process`

```
Name:        create_process
Description: Create a new process in Process Manager within a specified group.
             The process is created as a draft with the provided name, objective,
             owner, and optionally an initial set of activities and tasks.
             Follows Nintex authoring best practices automatically.

Input Schema:
  name            string   required  Process name (≤ 80 chars, title case)
  groupUniqueId   string   required  The group to create the process in
  objective       string   optional  1-2 sentence description of why this process exists
  background      string   optional  Scope, context, who it applies to
  ownerEmail      string   optional  Email of the process owner (looked up via SCIM)
  expertEmail     string   optional  Email of the process expert (looked up via SCIM)
  activities      array    optional  Initial activities (see FullActivity schema)
  doPublish       boolean  optional  Whether to immediately publish (default: false)

Returns: processUniqueId, processId, editUrl
```

### Tool: `update_process_content`

```
Name:        update_process_content
Description: Update the activities, tasks, and document/process links within an
             existing process. Performs a GET to fetch current state, merges your
             changes, and PUTs the result back. Preserves all cross-process references.

             IMPORTANT: All activities and tasks must follow Nintex best practices:
             - Activity names: verb-noun, ≤ 60 chars
             - Tasks: one action per task, starts with a verb, ≤ 120 chars
             - Attach document links at the task level
             - Use process links for defined sub-workflows

Input Schema:
  processUniqueId   string   required  UUID of the process to update
  activities        array    required  Full replacement activity list (FullActivity[])
  changeDescription string   optional  Description of what changed (logged in history)
  doPublish         boolean  optional  Whether to submit for approval/publish (default: false)
  doSubmitForApproval boolean optional

Returns: success, processUniqueId, changeDescription applied
```

---

## 7. Gaps — What Needs Investigation

The following require a live API call against a real Process Manager instance
(or documentation) to confirm before finalising the implementation:

| Gap | How to Resolve |
|---|---|
| Full Activity/Task JSON schema — are there more fields beyond what's typed? | `GET /Api/v1/Processes/{id}` on a complex real process and inspect full response |
| `POST /Api/v1/Processes` request body format | Try creating a minimal process and capture the request |
| Does `DoPublish: true` publish directly or submit for approval? | Test both paths |
| Can activities be assigned to a Role (not just a User)? | Check if `OwnerId` accepts role IDs or only user IDs |
| Document link format — is `DocumentUniqueId` the same as the search `DocumentUniqueId`? | Cross-reference `search_documents` results against a real process doc link |
| How are decisions (branching activities) represented? | Inspect a process with decision nodes via GET |
| Numbering — does the API auto-renumber or must we supply correct `Number` values? | Test submitting with `Number: "0"` on new items |

---

## 8. Implementation Order

1. **Create example files and type definitions** — unblocks agent testing
2. **Add `update_process_content` tool** — simpler (no create flow, reuses existing GET)
3. **Verify gaps via live API testing** — fill in unknown schema fields
4. **Add `create_process` tool** — depends on confirmed POST endpoint format
5. **Embed best practices in tool descriptions** — tie in `NINTEX_AUTHORING_BEST_PRACTICES.md`
6. **Update copilot-instructions.md** — document new tool patterns for future agents
