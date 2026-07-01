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
        
        # -> Open the PromptOS terminal page and confirm a terminal interface and interactive prompt are present on the page.
        await page.goto("http://localhost:3000/os")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'show me active agents' starter prompt button to run a test command and confirm the terminal prompt is interactive.
        # show me active agents button
        elem = page.locator('xpath=/html/body/div[2]/div/main/main/div/div/div/div/div[2]/div/div[2]/button')
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify a terminal interface is displayed
        await page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[2]/div[1]/div/div/div[2]/div[1]").nth(0).scroll_into_view_if_needed()
        # Assert: The terminal output area is visible on the page.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[2]/div[1]/div/div/div[2]/div[1]").nth(0)).to_be_visible(timeout=15000), "The terminal output area is visible on the page."
        await page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[2]/div[2]/div[2]/button[1]").nth(0).scroll_into_view_if_needed()
        # Assert: A starter prompt button ('show me active agents') is visible, indicating the terminal UI is displayed.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[2]/div[2]/div[2]/button[1]").nth(0)).to_be_visible(timeout=15000), "A starter prompt button ('show me active agents') is visible, indicating the terminal UI is displayed."
        
        # --> Verify an interactive prompt is available
        # Assert: The terminal displays the prompt 'cognivern os >', confirming an interactive prompt is available.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[2]/div[1]/div/div/div[2]/div[2]/div").nth(0)).to_contain_text("cognivern os >", timeout=15000), "The terminal displays the prompt 'cognivern os >', confirming an interactive prompt is available."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    