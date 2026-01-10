#!/usr/bin/env node
/**
 * Example: Bulk cleanup of process groups
 *
 * This script demonstrates a real-world scenario:
 * - Remove all archived processes
 * - Remove unassigned processes
 * - Reorder remaining processes alphabetically
 * - Update the group with a change description
 *
 * Usage:
 *   node example_bulk_cleanup.js <group-url>
 *
 * Example:
 *   node example_bulk_cleanup.js "https://demo.promapp.com/93555.../Process/Edit/Group/af8b..."
 */

import fetch from 'node-fetch';
import { extractAll, displayExtraction } from './extract_form_data.js';
import { buildProcessGroupXml, encodeProcedureXml } from './decode_procedure_xml.js';

// Configuration
const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to dry run for safety
const VERBOSE = process.env.VERBOSE === 'true';

/**
 * Cleanup criteria
 */
const cleanupRules = {
    removeArchived: true,
    removeUnassigned: true,
    sortAlphabetically: true,
    deduplicate: false
};

/**
 * Apply cleanup rules to process links
 */
function applyCleanup(processLinks, rules) {
    let cleaned = [...processLinks];
    const changes = [];

    // Rule 1: Remove archived processes
    if (rules.removeArchived) {
        const before = cleaned.length;
        cleaned = cleaned.filter(link => {
            const isArchived = link.linkedProcessDisplayName.toLowerCase().includes('archived');
            if (isArchived && VERBOSE) {
                console.log(`  ✗ Removing archived: ${link.linkedProcessName}`);
            }
            return !isArchived;
        });
        const removed = before - cleaned.length;
        if (removed > 0) {
            changes.push(`Removed ${removed} archived process(es)`);
        }
    }

    // Rule 2: Remove unassigned processes
    if (rules.removeUnassigned) {
        const before = cleaned.length;
        cleaned = cleaned.filter(link => {
            const isUnassigned = link.ownerships.every(o =>
                o.name.toUpperCase() === 'UNASSIGNED'
            );
            if (isUnassigned && VERBOSE) {
                console.log(`  ✗ Removing unassigned: ${link.linkedProcessName}`);
            }
            return !isUnassigned;
        });
        const removed = before - cleaned.length;
        if (removed > 0) {
            changes.push(`Removed ${removed} unassigned process(es)`);
        }
    }

    // Rule 3: Remove duplicates
    if (rules.deduplicate) {
        const before = cleaned.length;
        const seen = new Set();
        cleaned = cleaned.filter(link => {
            if (seen.has(link.linkedProcessUniqueId)) {
                if (VERBOSE) {
                    console.log(`  ✗ Removing duplicate: ${link.linkedProcessName}`);
                }
                return false;
            }
            seen.add(link.linkedProcessUniqueId);
            return true;
        });
        const removed = before - cleaned.length;
        if (removed > 0) {
            changes.push(`Removed ${removed} duplicate(s)`);
        }
    }

    // Rule 4: Sort alphabetically
    if (rules.sortAlphabetically) {
        const wasReordered = !cleaned.every((link, i) =>
            i === 0 || link.linkedProcessName >= cleaned[i - 1].linkedProcessName
        );

        if (wasReordered) {
            cleaned.sort((a, b) =>
                a.linkedProcessName.localeCompare(b.linkedProcessName)
            );
            changes.push('Reordered alphabetically');
        }
    }

    // Update order numbers
    cleaned.forEach((link, index) => {
        link.order = index.toString();
    });

    return { cleaned, changes };
}

/**
 * Perform cleanup on a process group
 */
async function cleanupProcessGroup(groupUrl, sessionCookie = null) {
    console.log(`\n🔍 Fetching process group from: ${groupUrl}\n`);

    // Fetch current data
    const headers = sessionCookie ? { Cookie: sessionCookie } : {};
    const response = await fetch(groupUrl, {
        headers,
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Extract data
    console.log('📊 Extracting current data...\n');
    const data = extractAll(html);

    console.log('=== Current State ===');
    displayExtraction(data);

    // Apply cleanup
    console.log('\n\n🧹 Applying cleanup rules...\n');
    const { cleaned, changes } = applyCleanup(data.processLinks, cleanupRules);

    console.log('\n=== Changes ===');
    if (changes.length === 0) {
        console.log('✓ No changes needed - group is already clean!');
        return { success: true, changes: [] };
    }

    changes.forEach(change => console.log(`  • ${change}`));

    console.log(`\n=== Result ===`);
    console.log(`Before: ${data.processLinks.length} process links`);
    console.log(`After:  ${cleaned.length} process links`);
    console.log(`Removed: ${data.processLinks.length - cleaned.length}`);

    if (VERBOSE) {
        console.log('\n=== Remaining Processes ===');
        cleaned.forEach((link, i) => {
            console.log(`  ${i + 1}. ${link.linkedProcessName}`);
        });
    }

    // Prepare update
    const newXml = buildProcessGroupXml({ processLinks: cleaned });
    data.formData.ProcedureXml = encodeProcedureXml(newXml);
    data.formData.SaveChangeDescription = changes.join('; ');

    if (DRY_RUN) {
        console.log('\n⚠️  DRY RUN MODE - No changes will be submitted');
        console.log('Set DRY_RUN=false to actually submit changes');
        return { success: true, changes, dryRun: true };
    }

    // Submit update
    console.log('\n📤 Submitting update...\n');

    const params = new URLSearchParams(data.formData);
    const postResponse = await fetch(groupUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...headers
        },
        body: params.toString(),
        credentials: 'include'
    });

    if (!postResponse.ok) {
        throw new Error(`Failed to update: ${postResponse.status} ${postResponse.statusText}`);
    }

    console.log('✅ Successfully updated process group!');
    console.log(`Change description: "${data.formData.SaveChangeDescription}"`);

    return { success: true, changes, dryRun: false };
}

/**
 * Process multiple groups
 */
async function cleanupMultipleGroups(groupUrls, sessionCookie = null) {
    const results = [];

    for (let i = 0; i < groupUrls.length; i++) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`Processing group ${i + 1} of ${groupUrls.length}`);
        console.log('='.repeat(80));

        try {
            const result = await cleanupProcessGroup(groupUrls[i], sessionCookie);
            results.push({ url: groupUrls[i], ...result });

            // Rate limiting - wait 1 second between requests
            if (i < groupUrls.length - 1) {
                console.log('\n⏱️  Waiting 1 second before next group...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error(`\n❌ Error processing group: ${error.message}`);
            results.push({ url: groupUrls[i], success: false, error: error.message });
        }
    }

    return results;
}

/**
 * Display summary of results
 */
function displaySummary(results) {
    console.log('\n\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const changed = successful.filter(r => r.changes && r.changes.length > 0);
    const unchanged = successful.filter(r => !r.changes || r.changes.length === 0);

    console.log(`\nTotal groups processed: ${results.length}`);
    console.log(`  ✅ Successful: ${successful.length}`);
    console.log(`  ❌ Failed: ${failed.length}`);
    console.log(`  📝 Changed: ${changed.length}`);
    console.log(`  ⊘ No changes needed: ${unchanged.length}`);

    if (changed.length > 0) {
        console.log('\n📝 Groups with changes:');
        changed.forEach(result => {
            console.log(`\n  ${result.url}`);
            result.changes.forEach(change => console.log(`    • ${change}`));
        });
    }

    if (failed.length > 0) {
        console.log('\n❌ Failed groups:');
        failed.forEach(result => {
            console.log(`\n  ${result.url}`);
            console.log(`    Error: ${result.error}`);
        });
    }

    if (DRY_RUN) {
        console.log('\n⚠️  This was a DRY RUN - no actual changes were made');
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
Usage: node example_bulk_cleanup.js <group-url> [group-url2] [group-url3] ...

Environment variables:
  DRY_RUN=false    Actually submit changes (default: true for safety)
  VERBOSE=true     Show detailed output (default: false)

Examples:
  # Dry run on single group
  node example_bulk_cleanup.js "https://demo.promapp.com/.../Process/Edit/Group/..."

  # Actually submit changes
  DRY_RUN=false node example_bulk_cleanup.js "https://demo.promapp.com/..."

  # Multiple groups with verbose output
  VERBOSE=true node example_bulk_cleanup.js "url1" "url2" "url3"

  # With session cookie
  COOKIE="session=..." node example_bulk_cleanup.js "url"
        `);
        process.exit(1);
    }

    const groupUrls = args;
    const sessionCookie = process.env.COOKIE || null;

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           PROMAPP PROCESS GROUP BULK CLEANUP                  ║
╚═══════════════════════════════════════════════════════════════╝

Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be submitted)'}
Verbose: ${VERBOSE ? 'Yes' : 'No'}
Groups: ${groupUrls.length}

Rules:
  • Remove archived processes: ${cleanupRules.removeArchived}
  • Remove unassigned processes: ${cleanupRules.removeUnassigned}
  • Sort alphabetically: ${cleanupRules.sortAlphabetically}
  • Remove duplicates: ${cleanupRules.deduplicate}
    `);

    try {
        const results = await cleanupMultipleGroups(groupUrls, sessionCookie);
        displaySummary(results);

        const failed = results.filter(r => !r.success);
        process.exit(failed.length > 0 ? 1 : 0);
    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        if (VERBOSE) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

export {
    cleanupProcessGroup,
    cleanupMultipleGroups,
    applyCleanup,
    cleanupRules
};
