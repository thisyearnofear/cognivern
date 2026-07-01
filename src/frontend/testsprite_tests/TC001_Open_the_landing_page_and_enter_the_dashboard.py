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
        
        # -> Click the 'Try Live Demo' button on the landing page to enter the dashboard.
        # Try Live Demo button
        elem = page.get_by_role('button', name='Try Live Demo', exact=True)
        await elem.click(timeout=10000)
        
        # -> Close the 'Welcome to Cognivern' modal by clicking the 'Dismiss welcome' button so the dashboard overview can be inspected.
        # Dismiss welcome button
        elem = page.get_by_role('button', name='Dismiss welcome', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the dashboard is displayed
        # Assert: The URL contains '/dashboard', confirming the dashboard page is open.
        await expect(page).to_have_url(re.compile("/dashboard"), timeout=15000), "The URL contains '/dashboard', confirming the dashboard page is open."
        # Assert: The Dashboard navigation item with text 'Dashboard' is visible.
        await expect(page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[2]/div[2]/ul/li/button").nth(0)).to_have_text("Dashboard", timeout=15000), "The Dashboard navigation item with text 'Dashboard' is visible."
        
        # --> Verify an overview section is displayed
        await page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[2]/div[2]/ul/li/button").nth(0).scroll_into_view_if_needed()
        # Assert: The 'Dashboard' navigation item is visible in the sidebar.
        await expect(page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[2]/div[2]/ul/li/button").nth(0)).to_be_visible(timeout=15000), "The 'Dashboard' navigation item is visible in the sidebar."
        # Assert: The Decision Breakdown shows 'Approved', confirming an overview widget is displayed on the dashboard.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[3]/div[2]/div[2]/div[2]/div[1]/span").nth(0)).to_have_text("Approved", timeout=15000), "The Decision Breakdown shows 'Approved', confirming an overview widget is displayed on the dashboard."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    