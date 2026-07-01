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
        
        # -> Scroll to reveal the spend demo section and click the 'Try Live Demo' button to enter the dashboard.
        await page.mouse.wheel(0, 300)
        
        # -> Scroll to reveal the spend demo section and click the 'Try Live Demo' button to enter the dashboard.
        # Try Live Demo button
        elem = page.get_by_role('button', name='Try Live Demo', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Dismiss welcome' button on the welcome modal to close it and reveal the dashboard.
        # Dismiss welcome button
        elem = page.get_by_role('button', name='Dismiss welcome', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the landing page presents the product introduction and spend demo
        # Assert: Landing page shows the product introduction header.
        await expect(page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[1]/div[1]/div[1]").nth(0)).to_contain_text("Cognivern AI Governance", timeout=15000), "Landing page shows the product introduction header."
        await page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[6]/div[2]/ul/li/button").nth(0).scroll_into_view_if_needed()
        # Assert: The 'Spend Flow Demo' navigation item (the spend demo) is visible.
        await expect(page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[2]/div[6]/div[2]/ul/li/button").nth(0)).to_be_visible(timeout=15000), "The 'Spend Flow Demo' navigation item (the spend demo) is visible."
        # Assert: The demo/sample data label 'Sample data' is visible on the page.
        await expect(page.locator("xpath=/html/body/div[2]/div/div[1]/div[2]/div/div[1]/div[3]/div[2]/span[2]").nth(0)).to_have_text("Sample data", timeout=15000), "The demo/sample data label 'Sample data' is visible on the page."
        
        # --> Verify the dashboard is displayed
        # Assert: The URL contains 'dashboard', confirming the dashboard route is open.
        await expect(page).to_have_url(re.compile("dashboard"), timeout=15000), "The URL contains 'dashboard', confirming the dashboard route is open."
        # Assert: The dashboard shows the approval rate '67%'.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[2]/div/div[3]/div[1]/div[2]/div[1]/span").nth(0)).to_have_text("67%", timeout=15000), "The dashboard shows the approval rate '67%'. "
        # Assert: The Quick Check amount input is present with value '500', indicating dashboard controls are rendered.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[4]/div[3]/div/input").nth(0)).to_have_value("500", timeout=15000), "The Quick Check amount input is present with value '500', indicating dashboard controls are rendered."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    