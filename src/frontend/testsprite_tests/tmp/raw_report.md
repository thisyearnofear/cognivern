
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** frontend
- **Date:** 2026-07-01
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 Open the landing page and enter the dashboard
- **Test Code:** [TC001_Open_the_landing_page_and_enter_the_dashboard.py](./TC001_Open_the_landing_page_and_enter_the_dashboard.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/17148197-c3c3-4ff4-9e79-1775d72f3f6a
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 Open the dashboard from the landing page
- **Test Code:** [TC002_Open_the_dashboard_from_the_landing_page.py](./TC002_Open_the_dashboard_from_the_landing_page.py)
- **Test Error:** TEST FAILURE

Signing in did not succeed — the sign-in flow returned a network error and the dashboard overview was not shown.

Observations:
- The sign-in modal remained open and displayed the error message: 'Network error. Please try again.'
- The page did not navigate to a dashboard overview; the URL stayed on the landing page (http://localhost:3000/).

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/37ab29df-1e20-4839-b70f-f579bf17e3d1
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 Submit an action for governance review
- **Test Code:** [TC003_Submit_an_action_for_governance_review.py](./TC003_Submit_an_action_for_governance_review.py)
- **Test Error:** TEST BLOCKED

The test could not be run — a required prerequisite (an API identity) is missing from the UI, and submit attempts return invalid JSON from the backend.

Observations:
- The API Identity dropdown expands but shows no identity options (the listbox is empty).
- Submitting the spend shows the error: "Unexpected token 'I', "Internal S"... is not valid JSON" (policy evaluation did not complete).
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/f7c18069-4df3-45f0-a762-ca191ca18491
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004 Enter the product from the landing page
- **Test Code:** [TC004_Enter_the_product_from_the_landing_page.py](./TC004_Enter_the_product_from_the_landing_page.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/cb88a2be-830f-41f8-b082-511bf4842ebb
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005 Enter the dashboard from the landing page
- **Test Code:** [TC005_Enter_the_dashboard_from_the_landing_page.py](./TC005_Enter_the_dashboard_from_the_landing_page.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/fa7e92e7-5504-4ede-a8a6-fefc5c405c18
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006 Browse the agents list and open an agent detail page
- **Test Code:** [TC006_Browse_the_agents_list_and_open_an_agent_detail_page.py](./TC006_Browse_the_agents_list_and_open_an_agent_detail_page.py)
- **Test Error:** TEST BLOCKED

The test could not be run — no registered agents were visible on the Agents list page, so an agent detail view could not be opened.

Observations:
- The 'Governed API Identities' page loaded and displays skeleton placeholder cards (no agent names or entries visible)
- An 'Error' badge is shown near the 'Create API Identity' button
- The 'Create API Identity' button is present (creating an agent would be a setup step but was not part of this test)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/5e448e0b-824b-4586-9714-d448fdb062e3
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 View dashboard overview data and navigate to other sections
- **Test Code:** [TC007_View_dashboard_overview_data_and_navigate_to_other_sections.py](./TC007_View_dashboard_overview_data_and_navigate_to_other_sections.py)
- **Test Error:** TEST FAILURE

The dashboard UI renders but backend data is unavailable and key summaries and the agents list are not displayed as expected.

Observations:
- Dashboard shows banner 'Unable to reach API' and summary cards display placeholder/zero values; Quick Check spend input displays value '500'.
- Navigating to 'Agents' shows a large error card: 'Failed to load agents' with the message 'API error 500: Internal Server Error' and action buttons 'Try Again', 'View Docs', 'Report Issue'.
- Repeated attempts to load the Agents list did not resolve the error — the agents list was not accessible and remained unavailable.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/47bdc1f9-441d-46ac-af46-134dd7f344c2
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 Browse policies and open a policy detail
- **Test Code:** [TC008_Browse_policies_and_open_a_policy_detail.py](./TC008_Browse_policies_and_open_a_policy_detail.py)
- **Test Error:** TEST FAILURE

The policies list could not be loaded — the UI shows an error and no policy entries were accessible.

Observations:
- The Policies page shows the message 'Failed to load policies' and a visible 'Retry' button.
- Clicking the 'Retry' button multiple times did not load any policy cards or reveal policy details.
- No policy entries or version/change history were present on the page to inspect.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/e418915b-410f-4b42-8696-2db2562ab70a
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009 Browse the agents list and inspect an agent
- **Test Code:** [TC009_Browse_the_agents_list_and_inspect_an_agent.py](./TC009_Browse_the_agents_list_and_inspect_an_agent.py)
- **Test Error:** TEST FAILURE

Agent creation failed — the API returned a 500 Internal Server Error preventing creation of an agent and therefore preventing opening an agent detail view for inspection.

Observations:
- The Create API Identity form shows a visible error: 'API error 500: Internal Server Error'.
- No agent entries are present in the Agents list and the page did not navigate to any agent detail view after submission.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/2ef736b4-2f4c-4180-9262-35f9fd0044ad
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010 Evaluate a governance action and review the decision
- **Test Code:** [TC010_Evaluate_a_governance_action_and_review_the_decision.py](./TC010_Evaluate_a_governance_action_and_review_the_decision.py)
- **Test Error:** TEST BLOCKED

The test could not be run — the backend returned an error preventing access to required API identities, so a governance submission cannot be completed.

Observations:
- The Agents page displays 'Failed to load agents' with 'API error 500: Internal Server Error' visible in the error panel.
- The Agents list failed to load and the API Identity combobox had no options, preventing selection of an identity for Governance Check.
- Previous Governance Check submissions returned a JSON parse error ('Unexpected token ... is not valid JSON'), consistent with missing/invalid identity data required by the flow.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/3f1b554e-bf0d-40d5-ad36-eb1266af49ec
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC011 Review dashboard overview data
- **Test Code:** [TC011_Review_dashboard_overview_data.py](./TC011_Review_dashboard_overview_data.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/402172c8-f354-4fdb-a7a8-4d8704abb6c9
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC012 Open audit trail and inspect evidence for a record
- **Test Code:** [TC012_Open_audit_trail_and_inspect_evidence_for_a_record.py](./TC012_Open_audit_trail_and_inspect_evidence_for_a_record.py)
- **Test Error:** TEST BLOCKED

Audit records could not be inspected because the audit listing failed to load.

Observations:
- The Audit Logs page shows the message 'Failed to load audit logs' and 'The backend may be unavailable'.
- No audit record entries or 'View/Details' links were present on the page.
- A search for 'Evidence' returned no matches, so evidence details could not be verified.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/3258d70c-5107-4147-87f3-3d18431c9eec
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC013 Manage workspace settings and save changes
- **Test Code:** [TC013_Manage_workspace_settings_and_save_changes.py](./TC013_Manage_workspace_settings_and_save_changes.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/9c1ff909-64d7-4e87-b58d-c1226f54026e
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC014 Inspect the audit trail and open related evidence
- **Test Code:** [TC014_Inspect_the_audit_trail_and_open_related_evidence.py](./TC014_Inspect_the_audit_trail_and_open_related_evidence.py)
- **Test Error:** TEST BLOCKED

The audit logs could not be loaded — the backend appears unavailable, so audit entries cannot be reviewed.

Observations:
- The Audit Logs page displays a prominent 'Failed to load audit logs' message with the note 'The backend may be unavailable'.
- No audit entries or clickable items are visible in the Audit Logs area, so drilling into evidence or linked transaction details is not possible.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/992deefd-030a-42cb-be4a-aed3a05388d6
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC015 Review policy list and browse policy history
- **Test Code:** [TC015_Review_policy_list_and_browse_policy_history.py](./TC015_Review_policy_list_and_browse_policy_history.py)
- **Test Error:** TEST BLOCKED

The Policies page could not be loaded — a backend/network error prevented the policies list from being retrieved, so no policy could be opened and no version history could be inspected.

Observations:
- The Policies page displays 'Failed to load policies' with a visible 'Retry' button (confirmed in the UI and screenshot).
- Two email sign-in attempts earlier produced 'Network error' errors and sign-in did not complete.
- No policy items are present to open; therefore viewing policy details or version history is not possible.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/f2064e9f-96ed-4ee8-80a8-1d0e06e0f280
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC016 Add or edit integration credentials and webhook settings
- **Test Code:** [TC016_Add_or_edit_integration_credentials_and_webhook_settings.py](./TC016_Add_or_edit_integration_credentials_and_webhook_settings.py)
- **Test Error:** TEST FAILURE

Creating an API key failed — the Generate Key action returned an API 404 error and no key was created.

Observations:
- After clicking 'Generate Key' the page displays a red error block containing the text 'API error 404' with raw HTML markup.
- No success confirmation, no displayed API key, and no refreshed integration configuration are visible on the page.
- The Integrate area includes 404 page content indicating the requested API route or page is missing.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/5ed57da9-f7a9-4690-9a99-53302e7d9826
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC017 Review the landing page architecture and integration guidance
- **Test Code:** [TC017_Review_the_landing_page_architecture_and_integration_guidance.py](./TC017_Review_the_landing_page_architecture_and_integration_guidance.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/d19d0fcb-f784-4a73-a79c-4612a7d955c0
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC018 Open a copilot run detail
- **Test Code:** [TC018_Open_a_copilot_run_detail.py](./TC018_Open_a_copilot_run_detail.py)
- **Test Error:** TEST BLOCKED

The test could not be run — the Runs list did not load due to backend unavailability, preventing selection of a copilot run and verification of its timeline.

Observations:
- The page shows the message: 'Failed to load runs' with subtext 'The backend may be unavailable'.
- No run entries or timeline items are visible on the page; only 'Refresh' and 'New Evaluation' buttons are shown.
- Because run data is not present, selecting a copilot run and viewing its execution timeline is not possible.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/6284de70-e0d5-450a-b9d0-01b97c1fc844
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC019 Create a new agent in the workshop
- **Test Code:** [TC019_Create_a_new_agent_in_the_workshop.py](./TC019_Create_a_new_agent_in_the_workshop.py)
- **Test Error:** TEST FAILURE

Attempted to create a new API identity by clicking 'Create API Identity', but the server returned an internal error and the agent was not created.

Observations:
- A red message 'API error 500: Internal Server Error' is visible on the workshop page immediately after submission.
- No confirmation message or agent preview indicating successful creation is present; the Create API Identity action did not produce a created-agent state.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/ffe58e55-3424-4253-823a-02e676d447db
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC020 Review a spend demo decision path
- **Test Code:** [TC020_Review_a_spend_demo_decision_path.py](./TC020_Review_a_spend_demo_decision_path.py)
- **Test Error:** TEST FAILURE

Editable scenario controls for the Spend Flow Demo are not available — the page shows a readonly demo timeline but no inputs to change 'Daily limit' or the spend amount, so the requested adjustable-scenario workflow cannot be executed.

Observations:
- The Spend Flow Demo page displays timeline entries (Policy Created, Agent Requests Spend, Policy Evaluated, Decision, Audit Logged) but these are static text nodes.
- A DOM search returned 0 elements matching input, select, or textarea — no editable controls were found.
- Governance is ON and a decision/explanation timeline is visible, but there is no UI to adjust parameters and re-run evaluation with different values.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/1720d204-85b3-426b-bbb2-ca2ea16549b7
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC021 Open a CRE run detail
- **Test Code:** [TC021_Open_a_CRE_run_detail.py](./TC021_Open_a_CRE_run_detail.py)
- **Test Error:** TEST BLOCKED

The test could not be run — the Runs page cannot load any runs, preventing selection of a CRE run and verification of its detail view or execution timeline.

Observations:
- The page displays 'Failed to load runs' and 'The backend may be unavailable'.
- No runs or run cards are visible to select from the history.
- Clicking the 'New Evaluation' button did not create or surface any runs; the error message remains.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/ee27158a-7095-4e76-bff0-14877de79f59
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC022 Review a run timeline from the runs area
- **Test Code:** [TC022_Review_a_run_timeline_from_the_runs_area.py](./TC022_Review_a_run_timeline_from_the_runs_area.py)
- **Test Error:** TEST BLOCKED

The test could not be run — the backend or authentication service is unavailable, preventing access to runs and the run detail timeline.

Observations:
- The Runs page displayed 'Failed to load runs' and showed skeleton placeholders.
- Clicking 'New Evaluation' did not open the creation UI.
- Submitting the sign-in form returned 'Network error. Please try again.' in the sign-in modal.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/19b45b6e-cafb-431a-9d71-1974991797e5
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC023 View the copilot runs list
- **Test Code:** [TC023_View_the_copilot_runs_list.py](./TC023_View_the_copilot_runs_list.py)
- **Test Error:** TEST FAILURE

The Copilot page opened but no past workflow runs were available for inspection.

Observations:
- The Live trace panel shows 'Awaiting mission' and indicates '0 events'.
- The Preview panel displays 'No preview receipt yet.'
- No list, table, or entries of previous Copilot runs are visible on the page.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/12931ad1-05df-452d-9b10-66aafb8ef7bd
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC024 View the CRE run history list
- **Test Code:** [TC024_View_the_CRE_run_history_list.py](./TC024_View_the_CRE_run_history_list.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/a424d81d-8a16-4d61-a46f-0bfb9616dcd8
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC025 Connect a web3 wallet successfully
- **Test Code:** [TC025_Connect_a_web3_wallet_successfully.py](./TC025_Connect_a_web3_wallet_successfully.py)
- **Test Error:** TEST BLOCKED

The wallet connection flow could not be completed because the application backend is unreachable.

Observations:
- The dashboard displays 'Unable to reach API' and a 'Retry' control.
- Selecting MetaMask and WalletConnect produced an application error page showing 'Something went wrong'.
- Clicking 'Retry' / 'Try again' did not restore API connectivity or open the wallet approval dialog.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/b7193a1e-63da-43e4-9c10-116694be63ed
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC026 Enter a command in PromptOS
- **Test Code:** [TC026_Enter_a_command_in_PromptOS.py](./TC026_Enter_a_command_in_PromptOS.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/9dbc11d3-4d3b-4f61-9c2d-dbd78c3535c7
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC027 Open the PromptOS terminal
- **Test Code:** [TC027_Open_the_PromptOS_terminal.py](./TC027_Open_the_PromptOS_terminal.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/54f209e4-1cc9-4638-bd61-589a25984b45
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC028 Switch the interface theme
- **Test Code:** [TC028_Switch_the_interface_theme.py](./TC028_Switch_the_interface_theme.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/e82f2f2d-42fd-4494-9e33-2f9e205b282b
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC029 Move between core governance sections from the dashboard shell
- **Test Code:** [TC029_Move_between_core_governance_sections_from_the_dashboard_shell.py](./TC029_Move_between_core_governance_sections_from_the_dashboard_shell.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/b7dc6d86-3408-4d3e-a26e-237a8c86cb65
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC030 Use the responsive sidebar on a smaller screen
- **Test Code:** [TC030_Use_the_responsive_sidebar_on_a_smaller_screen.py](./TC030_Use_the_responsive_sidebar_on_a_smaller_screen.py)
- **Test Error:** TEST BLOCKED

The responsive navigation test could not be run because the testing environment does not provide a way to resize the browser viewport or simulate a smaller device.

Observations:
- The Agents page loaded but shows an error banner: 'Failed to load agents — API error 500'.
- The left sidebar navigation (Dashboard, Policies, Agents, etc.) is visible in the current desktop layout.
- No control or capability to change viewport size (mobile/tablet) was available to the test agent, preventing verification of responsive behavior.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/e82a0a8d-a5c5-4f3a-9ead-f3b9f6a37214/331ab501-f066-4cc6-993a-2f47a9cf0579
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **36.67** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---