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
        
        # -> Navigate to the 'Agents workshop' page by going to /agents/workshop and inspect the workshop UI.
        await page.goto("http://localhost:3000/agents/workshop")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Fill 'Identity Name' with a test name, fill 'What does this system do?' with a brief description, then open the 'Primary Chain' dropdown to reveal options.
        # e.g. YieldHunter-02 text field
        elem = page.locator('[id="name"]')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("TestAgent-01")
        
        # -> Fill 'Identity Name' with a test name, fill 'What does this system do?' with a brief description, then open the 'Primary Chain' dropdown to reveal options.
        # e.g. DeFi yield farming script text field
        elem = page.locator('[id="role"]')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Test DeFi trading bot")
        
        # -> Fill 'Identity Name' with a test name, fill 'What does this system do?' with a brief description, then open the 'Primary Chain' dropdown to reveal options.
        # Ethereum ▼ button
        elem = page.locator('[id="base-ui-_R_j1lfiv5uviiv53b_"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Create API Identity' button to submit the configured API identity and observe the confirmation or created-agent UI.
        # Create API Identity button
        elem = page.get_by_role('button', name='Create API Identity', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify a new agent preview or confirmation is displayed
        # Assert: Expected the notifications area to show an API Identity created confirmation.
        await expect(page.locator("xpath=/html/body/div[2]/section").nth(0)).to_contain_text("API Identity created", timeout=15000), "Expected the notifications area to show an API Identity created confirmation."
        # Assert: Expected the Create API Identity button to show a created/success state.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[3]/button").nth(0)).to_contain_text("Created", timeout=15000), "Expected the Create API Identity button to show a created/success state."
        
        # --> Verify the workshop shows the created or updated agent state
        # Assert: Expected the notifications area to show a success message confirming the API identity was created.
        await expect(page.locator("xpath=/html/body/div[2]/section").nth(0)).to_contain_text("API identity created", timeout=15000), "Expected the notifications area to show a success message confirming the API identity was created."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    