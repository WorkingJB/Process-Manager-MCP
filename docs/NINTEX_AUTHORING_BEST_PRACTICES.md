# Nintex Process Manager — Authoring Best Practices for AI Agents

This guide defines the standards that AI agents MUST follow when creating or updating
processes via the MCP tools. These rules are derived from Nintex Process Manager best
practices and are embedded in tool descriptions to enforce compliance automatically.

---

## 1. Process Structure

### Overall Shape
- **5–15 activities** per process is the ideal range
- If a process exceeds 15 activities, split it into a parent process with sub-process links
- If a process has fewer than 3 activities, consider whether it should be a checklist document instead
- Each process must have a clear **start trigger** (what kicks it off) and **end state** (what done looks like)

### Process Name
- Title case, noun-phrase format: "Employee Onboarding", "Supplier Invoice Approval"
- Must be unique within its group
- ≤ 80 characters
- No acronyms unless universally understood within the organisation

### Objective (required)
- 1–2 sentences stating **WHY** this process exists, not what it does
- Good: *"Ensure new employees are integrated into the organisation efficiently, compliantly, and with a positive experience from day one."*
- Bad: *"This process describes the steps involved in onboarding employees."*

### Background (recommended)
- State the **scope**: who/what this process applies to
- State **exclusions**: what is out of scope
- Reference **related processes or policies** if relevant
- Good: *"Applies to all permanent and fixed-term employees. Contractors follow a separate onboarding checklist. Begins once an offer letter is signed."*

---

## 2. Activities

### Naming Convention
- **Verb-noun phrase**, title case
- The verb describes the action performed: *Prepare*, *Review*, *Approve*, *Submit*, *Confirm*, *Conduct*, *Update*
- ≤ 60 characters
- Good examples:
  - "Prepare onboarding documentation"
  - "Review invoice for accuracy"
  - "Obtain management approval"
  - "Update customer record"
- Bad examples:
  - "Onboarding documentation" (missing verb)
  - "Documentation preparation and review of all relevant onboarding materials for new starters" (too long)
  - "DO THE REVIEW" (incorrect casing and tone)

### Activity Owner (OwnerText)
- Assign a **role name**, not a person's name (roles are more durable than individuals)
- Good: "HR Coordinator", "Finance Manager", "IT Support"
- Bad: "John Smith", "Someone in HR"
- If genuinely unowned, leave `OwnerText: null`

### Activity Ordering
- Activities should flow logically — each activity is a meaningful phase of work
- Avoid "Admin" catch-all activities; break them into specific named phases
- Parallel activities (things done simultaneously) can be presented in sequence; note parallelism in task text or notes

---

## 3. Tasks

### Naming Convention
- Specific, actionable statement starting with a **verb**
- Describes **one action** that can be independently verified as complete
- ≤ 120 characters
- Good examples:
  - "Issue signed offer letter to new employee"
  - "Complete the Privacy Impact Assessment form"
  - "Confirm start date with hiring manager"
  - "File invoice in the accounts payable folder"
- Bad examples:
  - "Paperwork" (not specific, no verb)
  - "Review and update and file all relevant documentation" (multiple actions — split into separate tasks)
  - "Do this" (meaningless)

### Task Granularity
- One action per task — if a task has "and" in it, consider splitting
- Tasks should be testable: a reviewer should be able to determine whether it's done
- Avoid duplicating the activity name in every task name

### Task Notes
- Use `Note` field for conditional logic, exceptions, or guidance that doesn't fit in the task name
- Good note: *"If the supplier is overseas, escalate to the Chief Privacy Officer before proceeding."*
- Notes should be concise — if a note requires more than 2 sentences, consider whether a linked document is more appropriate

---

## 4. Document References

### When to Link a Document
- Link a document when the task **requires** the person to use, complete, or reference a specific file
- Common link types: forms, templates, checklists, policy documents, guides, registers

### How to Reference (technical)
- Use `search_documents` tool to find the document by name
- Extract the `DocumentUniqueId` from the search result
- Place it in the task's `DocumentUniqueId` field along with `DocumentName`
- **Documents link at the TASK level**, not the activity level
- One task can link to **one document only** — if multiple documents are needed, create a task per document

### Naming the Link
- `DocumentName` should match the actual document title as found in search
- Do not paraphrase or abbreviate — use the exact document name from the system

---

## 5. Sub-Process References

### When to Link a Sub-Process
- When the task triggers a **separate, well-defined process** that exists (or should exist) in Process Manager
- Common patterns: IT provisioning, contract execution, procurement approval

### How to Reference (technical)
- Use `search_processes` or `get_group_hierarchy` to find the process UUID
- Place in `ProcessUniqueId` and `ProcessName` on the task
- `ProcessUniqueId` and `DocumentUniqueId` are **mutually exclusive** — a task links to one or the other, not both

### Task Text with Sub-Process Links
- The task name should start with "Complete the [Process Name] process"
- Good: "Complete the IT Hardware Provisioning process"
- Bad: "See IT for setup" (vague, no explicit link)

---

## 6. Process Lifecycle Fields

### StateId
| Value | Meaning |
|---|---|
| 1 | Active / Published |
| 2 | Draft / In Progress |
| 3 | Archived |

When creating new processes, they start as Draft (StateId 2) unless `DoPublish: true`.

### DoPublish vs DoSubmitForApproval
- `DoPublish: true` — immediately publishes (use only if no approval workflow configured)
- `DoSubmitForApproval: true` — sends to process owner/approver for review (preferred for real environments)
- Both `false` — saves as draft (safest default for agent-created content)

---

## 7. What NOT to Do

| Anti-Pattern | Issue | Fix |
|---|---|---|
| Activities named as nouns only ("Invoice Processing") | Unclear who does what | Use verb-noun: "Process supplier invoice" |
| Tasks with multiple actions joined by "and" | Hard to track completion | Split into separate tasks |
| Task text = Activity text | Redundant, no additional value | Make tasks more specific than the activity |
| Linking document at activity level | Not supported by the API | Link only at task level |
| PersonName as OwnerText | Breaks when person leaves | Use role name instead |
| Missing Objective | Reduces process discoverability and usefulness | Always provide a 1–2 sentence objective |
| More than 15 activities in one process | Hard to read, hard to maintain | Split using sub-process links |
| Duplicate UUIDs | API will reject or corrupt data | Always generate a new UUID per activity/task |

---

## 8. Agent Checklist Before Submitting a Process

- [ ] Process name is title case, ≤ 80 chars, verb-free noun phrase
- [ ] Objective is 1–2 sentences stating WHY, not WHAT
- [ ] Background defines scope and exclusions
- [ ] 5–15 activities (or sub-process links used if more needed)
- [ ] Each activity uses verb-noun naming, ≤ 60 chars
- [ ] Each task is a single action starting with a verb, ≤ 120 chars
- [ ] Document links are at task level with correct UUID from `search_documents`
- [ ] Sub-process links use correct UUID from `search_processes`
- [ ] No task has both `DocumentUniqueId` and `ProcessUniqueId` set
- [ ] Activity/task `OwnerText` uses a role name, not a person's name
- [ ] All new activities/tasks have `Id: 0` and a fresh UUID
- [ ] `ProcessRevisionEditId` is taken from the current GET response (not hardcoded)
