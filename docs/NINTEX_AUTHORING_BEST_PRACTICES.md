# Nintex Process Manager — Authoring Best Practices for AI Agents

This guide defines the standards that AI agents MUST follow when creating or updating
processes via the MCP tools. Rules are sourced directly from the
[Nintex Process Writing Guidelines](https://help.nintex.com/en-US/promapp/Processes/ProcessWriting.htm)
and the [Nintex Glossary](https://help.nintex.com/en-US/promapp/Glossary.htm).

---

## Core Principle: Keep It Simple

The goal is to capture how a process runs **90% of the time** — a clean flow of activities
delivering a clear output. Processes that try to document every variation become unreadable.

---

## 1. Start Every Name with a Verb (Technique 3)

**This applies to process names, activity names, AND task names.**

Processes are instructions for "how to do something". Verbs make that explicit.
Ask: *"What is the person expected to do?"*

| Level | Good (starts with verb) | Bad (no verb) |
|---|---|---|
| Process | "Recruit New Staff Member" | "New Staff Member Recruitment" |
| Process | "Onboard New Employee" | "Employee Onboarding" |
| Activity | "Prepare offer documentation" | "Offer documentation" |
| Activity | "Conduct orientation session" | "Orientation" |
| Task | "Issue signed offer letter to new employee" | "Offer letter" |
| Task | "Complete the Privacy Impact Assessment form" | "PIA form" |

---

## 2. Document the Normal Flow — 80% Rule (Technique 1)

Only document the steps that **normally** occur — the steps performed roughly **80% of the time**.

- Covering every variation makes the process too complex to understand
- Ask: *"Is this step normally performed?"*
- If no → it's a variation or exception → capture it as a **note**, not a step

---

## 3. Process Structure and Limits

### Process Name
- Starts with a **verb**, title case (e.g. "Recruit New Staff Member")
- ≤ 80 characters
- Unique within its group

### Objective (required)
- 1–2 sentences stating **WHY** this process exists, not what it does
- Good: *"Ensure new employees are integrated into the organisation efficiently and compliantly from their first day."*
- Bad: *"This process describes the steps involved in onboarding employees."*

### Background (recommended)
- Scope: who/what this process applies to
- Exclusions: what is out of scope
- Related processes or policies if relevant

### Inputs and Outputs
- Link inputs/outputs to the related processes they come from or lead to
- Almost all inputs and outputs connect to other processes — always link them

---

## 4. Activities (Technique 2)

### Limit
- **Maximum 10 activities per process** — if more are needed, break into sub-processes
- Minimum: don't create a process for something with only 2–3 steps (use a document/checklist instead)

### Naming
- Verb-noun phrase, title case, ≤ 60 characters
- Starts with an action verb: *Prepare*, *Review*, *Approve*, *Submit*, *Confirm*, *Conduct*, *Update*

### Grouping rule
- Group tasks that are performed **at the same time** or **by the same role** into one activity
- Activities represent major phases of work, not individual micro-steps

### Owner (OwnerText)
- Use a **role name**, not a person's name — roles are durable; people change
- Good: "HR Coordinator", "Finance Manager", "IT Support"
- Bad: "John Smith", "someone in HR"

---

## 5. Tasks

### Limit
- Aim for **~10 tasks or notes per activity**

### Naming
- Starts with a **verb**, one specific action, ≤ 120 characters
- The action must be independently verifiable as done or not done
- If a task has "and" in it, consider splitting it

### Optional steps — use "If" statements (Technique 5)
- For steps that aren't always performed, use: *"if required"*, *"if needed"*, *"if appropriate"*
- Always supplement an "if" task with a **note** explaining the circumstances
- Good: *"Escalate to Chief Privacy Officer, if required"*
- Bad: Adding a separate activity branch for a 10%-frequency exception

---

## 6. Notes

### When to use notes (not steps)
- Exceptions or variations that occur **less than 20% of the time**
- Low-level decisions that don't affect the main process flow
- Circumstances under which an optional "if" task applies
- Guidance that would clutter the step text

### Note title rule
- **Always phrase the note title as a question**
- Good: *"What if the supplier is based overseas?"*, *"When is escalation required?"*
- Bad: *"Overseas suppliers"*, *"Escalation process"*

### Note body
- Concise answer to the question posed in the title
- If the answer requires more than 2–3 sentences, link to a document instead

---

## 7. Decisions

### Use decision diamonds only for critical flow changes (Technique 7)
- Reserve decisions for points where the **overall process flow** branches significantly
- A decision can lead to another process or a single alternate activity that terminates the process

### Low-level decisions go in notes
- *"What if it's a weekend?"* → note, not a decision diamond
- *"What if it's an Executive Manager we're hiring?"* → note, not a decision diamond
- For complex conditional logic, use a **decision matrix** in a linked document

---

## 8. Documents and Guides (Technique 6)

### When to link a document
- When the task requires the person to use, complete, or reference a specific file
- When detailed step-by-step system instructions would clutter the process map
- Common types: forms, templates, checklists, policy documents, system guides, registers

### How to attach (technical)
- Use `search_documents` to find the document and get its `DocumentUniqueId`
- Set `DocumentUniqueId` and `DocumentName` on the **task** (not the activity)
- One task can link to **one document only** — create separate tasks for separate documents
- `DocumentUniqueId` and `ProcessUniqueId` are **mutually exclusive** per task

### DocumentName
- Use the exact document title as it appears in the system (from search results)

---

## 9. Sub-Processes (Technique 4)

### When to create sub-processes
- When a process exceeds **10 activities**
- When a set of steps is **shared across multiple processes** (avoids duplication)
- When a distinct workflow is well-defined enough to stand alone

### Linking sub-processes
- Link at the **task level** using `ProcessUniqueId` and `ProcessName`
- Task text: start with a verb referencing the sub-process
  - Good: *"Complete the IT Hardware Provisioning process"*
  - Bad: *"See IT for setup"*
- Use `search_processes` or `get_group_hierarchy` to find the sub-process UUID

---

## 10. Process Lifecycle Fields

### StateId
| Value | Meaning |
|---|---|
| 1 | Active / Published |
| 2 | Draft / In Progress |
| 3 | Archived |

### DoPublish vs DoSubmitForApproval
- `DoPublish: true` — immediately publishes (only if no approval workflow is configured)
- `DoSubmitForApproval: true` — routes to approver (preferred for real environments)
- Both `false` — saves as draft (safest default for agent-created content)

---

## 11. What NOT to Do

| Anti-Pattern | Why it's wrong | Fix |
|---|---|---|
| Process name without a verb ("Employee Onboarding") | Not an instruction; hard to find | Start with verb: "Onboard New Employee" |
| Activity name without a verb ("Invoice Processing") | Unclear what the performer does | "Process supplier invoice" |
| Tasks with multiple actions joined by "and" | Can't verify completion independently | Split into separate tasks |
| Decision diamond for a 10%-edge-case | Clutters the process flow | Use a note with a question title |
| Note title as a statement ("Overseas suppliers") | Doesn't guide the reader | Rephrase as question: "What if the supplier is overseas?" |
| > 10 activities in one process | Hard to read; user won't engage | Split into sub-processes |
| ~10 tasks per activity exceeded significantly | Activity is doing too much | Break into two activities |
| Person's name as OwnerText | Breaks when person leaves | Use role name |
| Documenting every exception as a step | Violates the 80% rule | Move exceptions to notes |
| DocumentUniqueId AND ProcessUniqueId on same task | API conflict | One link per task only |
| Missing Objective | Reduces discoverability | Always provide 1–2 sentence objective |

---

## 12. Agent Checklist Before Submitting a Process

- [ ] Process name starts with a verb, title case, ≤ 80 chars
- [ ] Objective is 1–2 sentences stating WHY, not WHAT
- [ ] Background defines scope and exclusions
- [ ] ≤ 10 activities (sub-process links used if more are needed)
- [ ] Each activity uses verb-noun naming, ≤ 60 chars
- [ ] Each task starts with a verb, single action, ≤ 120 chars
- [ ] Each activity has ~10 tasks or fewer
- [ ] Optional steps use "if required/needed/appropriate" + a supporting note
- [ ] Notes are used for < 20%-frequency exceptions (not separate steps)
- [ ] Note titles are phrased as questions
- [ ] Decision diamonds used only for critical flow-impacting branches
- [ ] Document links are at task level with correct UUID from `search_documents`
- [ ] Sub-process links use correct UUID from `search_processes`
- [ ] No task has both `DocumentUniqueId` and `ProcessUniqueId` set
- [ ] Activity/task `OwnerText` uses a role name, not a person's name
- [ ] All new activities/tasks have `Id: 0` and a fresh UUID
- [ ] `ProcessRevisionEditId` taken from a fresh GET (not hardcoded)
