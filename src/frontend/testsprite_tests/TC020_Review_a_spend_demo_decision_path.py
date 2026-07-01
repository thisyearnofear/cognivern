import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:3000")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Try Live Demo' button to open the spend demo page.
        # Try Live Demo button
        elem = page.get_by_role('button', name='Try Live Demo', exact=True)
        await elem.click(timeout=10000)
        
        # -> Dismiss the welcome modal by clicking 'Dismiss welcome', then click the 'Spend Flow Demo' button in the sidebar to open the spend demo page.
        # Dismiss welcome button
        elem = page.get_by_role('button', name='Dismiss welcome', exact=True)
        await elem.click(timeout=10000)
        
        # -> Dismiss the welcome modal by clicking 'Dismiss welcome', then click the 'Spend Flow Demo' button in the sidebar to open the spend demo page.
        # Spend Flow Demo button
        elem = page.locator('[id="base-ui-_r_9_"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Start Demo' button to begin the spend demo and reveal the scenario parameters.
        # Start Demo button
        elem = page.get_by_role('button', name='Start Demo', exact=True)
        await elem.click(timeout=10000)
        
        # -> Scroll the 'Spend Flow Demo' page to reveal adjustable scenario parameters (for example 'Daily limit' or spend amount controls) so they can be observed and edited.
        await page.mouse.wheel(0, 300)
        
        # -> Scroll to the top of the Spend Flow Demo page to reveal scenario controls (for example the 'Daily limit' or spend amount controls).
        await page.mouse.wheel(0, 300)
        
        # -> Click the 'Governance: ON' toggle to change governance, then click the 'Replay' button to re-run the demo and observe the result.
        # button
        elem = page.locator('xpath=/html/body/div[2]/div/main/main/div/div/div[2]/button')
        await elem.click(timeout=10000)
        
        # -> Click the 'Governance: ON' toggle to change governance, then click the 'Replay' button to re-run the demo and observe the result.
        # Replay button
        elem = page.get_by_role('button', name='Start Demo', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the visible 'Governance' toggle (currently showing 'Governance: OFF') to switch Governance to ON and wait for the UI to update.
        # button
        elem = page.locator('xpath=/html/body/div[2]/div/main/main/div/div/div[2]/button')
        await elem.click(timeout=10000)
        
        # -> Scroll down the Spend Flow Demo page to reveal editable scenario controls such as 'Daily limit' or spend amount.
        await page.mouse.wheel(0, 300)
        
        # --> Assertions to verify final state
        
        # --> Verify a policy decision outcome is displayed
        # Assert: Expected 'Policy Evaluated' to be visible in the policy decision timeline.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[3]/div[3]/div[1]/div[1]").nth(0)).to_contain_text("Policy Evaluated", timeout=15000), "Expected 'Policy Evaluated' to be visible in the policy decision timeline."
        # Assert: Expected 'Decision Audit Logged' to be visible as the audit entry for the policy decision.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[3]/div[5]/div[1]/div").nth(0)).to_contain_text("Decision Audit Logged", timeout=15000), "Expected 'Decision Audit Logged' to be visible as the audit entry for the policy decision."
        # Assert: Expected 'Agent Requests Spend' to be visible in the decision timeline as context for the policy outcome.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[3]/div[2]/div[1]/div[1]").nth(0)).to_contain_text("Agent Requests Spend", timeout=15000), "Expected 'Agent Requests Spend' to be visible in the decision timeline as context for the policy outcome."
        
        # --> Verify an explanation of the decision path is displayed
        # Assert: Expected the decision explanation to include 'FHE comparisons on encrypted values — budget and amount never in plaintext'.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[3]/div[2]/div[1]/div[1]").nth(0)).to_contain_text("FHE comparisons on encrypted values \u2014 budget and amount never in plaintext", timeout=15000), "Expected the decision explanation to include 'FHE comparisons on encrypted values \u2014 budget and amount never in plaintext'."
        # Assert: Expected the decision explanation to include the privacy note about encrypted evaluation and audit evidence.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[3]/div[5]/div[1]/div").nth(0)).to_contain_text("Privacy by design:  Budgets, limits, and spend amounts are evaluated while encrypted \u2014 the policy engine sees compliance, not your numbers.", timeout=15000), "Expected the decision explanation to include the privacy note about encrypted evaluation and audit evidence."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    