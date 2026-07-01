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
        
        # -> Click the 'Try Live Demo' button to enter the dashboard and begin the dashboard overview verification.
        # Try Live Demo button
        elem = page.get_by_role('button', name='Try Live Demo', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Dismiss welcome' control to close the welcome modal and reveal the dashboard overview.
        # Dismiss welcome button
        elem = page.get_by_role('button', name='Dismiss welcome', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the dashboard overview is displayed
        # Assert: Decision breakdown showing 'Approved' is visible in the dashboard overview.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[3]/div[1]/div[2]/div[2]/button[1]").nth(0)).to_contain_text("Approved", timeout=15000), "Decision breakdown showing 'Approved' is visible in the dashboard overview."
        # Assert: Activity Volume timeframe control '7d' is visible on the dashboard overview.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[3]/div[2]/div[1]/div[2]/button[1]").nth(0)).to_have_text("7d", timeout=15000), "Activity Volume timeframe control '7d' is visible on the dashboard overview."
        # Assert: Agent Status count '332' is visible on the dashboard overview.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[3]/div[3]/div[2]/div[2]/span[2]").nth(0)).to_have_text("332", timeout=15000), "Agent Status count '332' is visible on the dashboard overview."
        # Assert: A Recent Activity entry showing 'held' is visible in the dashboard overview.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[6]/div[2]/div[1]/div[2]/span[2]").nth(0)).to_have_text("held", timeout=15000), "A Recent Activity entry showing 'held' is visible in the dashboard overview."
        
        # --> Verify core dashboard content is visible
        await page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[3]/div[2]/ul/li[1]/button").nth(0).scroll_into_view_if_needed()
        # Assert: The Policies navigation button is visible on the dashboard.
        await expect(page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[3]/div[2]/ul/li[1]/button").nth(0)).to_be_visible(timeout=15000), "The Policies navigation button is visible on the dashboard."
        await page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[3]/div[2]/ul/li[2]/button").nth(0).scroll_into_view_if_needed()
        # Assert: The Agents navigation button is visible on the dashboard.
        await expect(page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[3]/div[2]/ul/li[2]/button").nth(0)).to_be_visible(timeout=15000), "The Agents navigation button is visible on the dashboard."
        await page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[3]/div[2]/ul/li[3]/button").nth(0).scroll_into_view_if_needed()
        # Assert: The Governance Check navigation button is visible on the dashboard.
        await expect(page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[3]/div[2]/ul/li[3]/button").nth(0)).to_be_visible(timeout=15000), "The Governance Check navigation button is visible on the dashboard."
        await page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[3]/div[2]/ul/li[4]/button").nth(0).scroll_into_view_if_needed()
        # Assert: The Copilot navigation button is visible on the dashboard.
        await expect(page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[3]/div[2]/ul/li[4]/button").nth(0)).to_be_visible(timeout=15000), "The Copilot navigation button is visible on the dashboard."
        await page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[4]/div[2]/ul/li[1]/button").nth(0).scroll_into_view_if_needed()
        # Assert: The Audit navigation button is visible on the dashboard.
        await expect(page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[4]/div[2]/ul/li[1]/button").nth(0)).to_be_visible(timeout=15000), "The Audit navigation button is visible on the dashboard."
        await page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[4]/div[2]/ul/li[2]/button").nth(0).scroll_into_view_if_needed()
        # Assert: The Runs navigation button is visible on the dashboard.
        await expect(page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[4]/div[2]/ul/li[2]/button").nth(0)).to_be_visible(timeout=15000), "The Runs navigation button is visible on the dashboard."
        await page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[6]/div[2]/ul/li/button").nth(0).scroll_into_view_if_needed()
        # Assert: The Spend Flow Demo navigation button is visible on the dashboard.
        await expect(page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[6]/div[2]/ul/li/button").nth(0)).to_be_visible(timeout=15000), "The Spend Flow Demo navigation button is visible on the dashboard."
        await page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[3]/ul/li[1]/button").nth(0).scroll_into_view_if_needed()
        # Assert: The Settings button is visible in the dashboard navigation.
        await expect(page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[3]/ul/li[1]/button").nth(0)).to_be_visible(timeout=15000), "The Settings button is visible in the dashboard navigation."
        # Assert: A governed identity (Alpha Trader) is visible in the Governed Identities list.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[5]/div[2]/div[1]").nth(0)).to_contain_text("Alpha Trader", timeout=15000), "A governed identity (Alpha Trader) is visible in the Governed Identities list."
        await page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[1]/div[2]/button[3]").nth(0).scroll_into_view_if_needed()
        # Assert: The Governance Check action button is visible on the dashboard overview.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[1]/div[2]/button[3]").nth(0)).to_be_visible(timeout=15000), "The Governance Check action button is visible on the dashboard overview."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    